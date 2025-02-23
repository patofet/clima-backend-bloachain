// routes/certificationRoutes.js
const express = require("express");
const { initCertificationContract } = require("../contracts/certification");
const authenticate = require("../middleware/authMiddleware");

// Inicialización del contrato
const certificationContract = initCertificationContract();
const router = express.Router();

// Rutas
router.post("/certify", authenticate, async (req, res) => {
  const { certifiedString, description } = req.body;
  const { address, timestamp, message } = req.authentication;
  const maxRetries = 5;
  const retryDelay = 500;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const nonce = await certificationContract.wallet.getNonce("pending");
      const tx = await certificationContract.contract.certify(
        certifiedString,
        description,
        address,
        message,
        timestamp,
        { nonce: nonce }
      );
      const receipt = await tx.wait();
      console.log("Transacción confirmada");
      return res.json({
        message: `Cadena certificada con éxitooo: ${certifiedString}`,
        transaction: JSON.stringify(receipt),
      });
    } catch (error) {
      console.error(error);
      if (error.message.includes("nonce has already been used")) {
        attempt++;
        await sleep(retryDelay);
        continue;
      }
      return res.status(500).json({ error: error.message, object: error });
    }
  }
});
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.post("/certify-async", authenticate, async (req, res) => {
  const { certifiedString, description } = req.body;
  const { address, timestamp, message } = req.authentication;

  const maxRetries = 5;
  const retryDelay = 300;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const nonce = await certificationContract.wallet.getNonce("pending");
      const tx = await certificationContract.contract.certify(
        certifiedString,
        description,
        address,
        message,
        timestamp,
        { nonce: nonce }
      );
      res.json({
        message: `Transacción enviada para certificar la cadena: ${certifiedString}`,
        transactionHash: tx.hash,
      });
      tx.wait()
        .then((receipt) => {
          console.log(`Transacción confirmada: ${receipt}`);
        })
        .catch((error) => {
          console.error(`Error confirmando la transacción: ${error.message}`);
        });

      return;
    } catch (error) {
      if (error.message.includes("nonce has already been used")) {
        attempt++;
        await sleep(retryDelay);
        continue;
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // Si se alcanzó el máximo de reintentos, devolver un error al cliente
  res.status(500).json({
    error: `No se pudo enviar la transacción después de ${maxRetries} intentos.`,
  });
});

router.get("/isCertified/:data", async (req, res) => {
  const { data } = req.params;
  try {
    const isCertified = await certificationContract.contract.isCertified(data);
    res.json({ data, isCertified });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/getCertificateDetails/:data", async (req, res) => {
  const { data } = req.params;
  try {
    const details = await certificationContract.contract.getCertificateDetails(
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
