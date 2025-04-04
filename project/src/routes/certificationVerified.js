// routes/certificationRoutes.js
const express = require("express");
const {
  initCertificationVerificatedContract,
} = require("../contracts/CertificationVerificated");
const { authenticate } = require("../middleware/authMiddleware");

// Inicialización del contrato
const contractManager = initCertificationVerificatedContract();
const router = express.Router();

// Rutas
router.post("/certify", authenticate, async (req, res) => {
  const { certifiedString, description } = req.body;
  const { address, timestamp, message, signed, expectedHash } =
    req.authentication;
  const maxRetries = 5;
  const retryDelay = 1000; // Quizás un poco más de delay
  let attempt = 0;

  if (!certifiedString || !description) {
    return res.status(400).json({
      error: "Los campos certifiedString y description son obligatorios.",
    });
  }
  if (message !== certifiedString) {
    return res.status(400).json({
      error: "El mensaje firmado no coincide con la cadena a certificar.",
    });
  }

  while (attempt < maxRetries) {
    const { contract } = contractManager.getState();
    try {
      const signature = signed.slice(2);
      console.log(`Intento ${attempt + 1}: Llamando a certify`);
      const tx = await contract.certify(
        certifiedString,
        description,
        address,
        expectedHash,
        "0x" + signature,
        timestamp
      );
      console.log(`Intento ${attempt + 1}: Transacción enviada: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Intento ${attempt + 1}: Transacción confirmada.`);

      return res.json({
        message: `Cadena certificada con éxito: ${certifiedString}`,
        transactionHash: receipt.hash,
      });
    } catch (error) {
      console.error(`Intento ${attempt + 1} falló: ${error.message}`);
      attempt++;
      if (
        error.code === "NONCE_EXPIRED" ||
        error.message.includes("nonce has already been used") ||
        error.message.includes("nonce too low") ||
        error.message.includes("replacement transaction underpriced") ||
        error.message.includes("Transaction nonce is too distant")
      ) {
        if (attempt >= maxRetries) {
          console.error(
            "Máximo de reintentos alcanzado después de error de nonce."
          );
          return res.status(500).json({
            error: "Error de nonce persistente tras reintentos.",
            details: error.message,
          });
        }
        console.warn(
          `Error de Nonce detectado (${error.message}). Esperando ${retryDelay}ms y reiniciando NonceManager...`
        );
        await sleep(retryDelay);
        contractManager.restartNonceManager();
        console.log("NonceManager reiniciado. Reintentando...");
        continue;
      } else {
        console.error("Error no relacionado con nonce:", error);
        return res.status(500).json({
          error: `Error en la transacción: ${error.message}`,
          code: error.code,
        });
      }
    }
  }
  // Solo se llega aquí si maxRetries es 0 o hay un fallo lógico en el bucle
  return res
    .status(500)
    .json({ error: "Se alcanzó el límite de reintentos sin éxito." });
});
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.get("/getCertificate/:TransactionHash", async (req, res) => {
  const { TransactionHash } = req.params;

  if (!TransactionHash) {
    return res
      .status(400)
      .json({ error: "El parámetro TransactionHash es obligatorio." });
  }
  try {
    const transaction =
      await certificationVerificatedContract.getTransactionDetails(
        TransactionHash
      );
    const { blockNumber, functionName, functionParams } = transaction;
    return res.render("certificateDetails", {
      blockNumber: blockNumber,
      functionName: functionName,
      params: functionParams,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/getCertificateDetails/:data", async (req, res) => {
  const { data } = req.params;
  try {
    const details =
      await certificationVerificatedContract.contract.getCertificateDetails(
        data
      );
    res.json({
      dataCertified: data,
      description: details[5],
      certificate: {
        certifier: details[0],
        timestamp: details[4].toString(),
      },
      proof: {
        requester: details[1],
        signature: details[2],
        timestamp: details[3].toString(),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
