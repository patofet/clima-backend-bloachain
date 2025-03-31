// routes/certificationRoutes.js
const express = require("express");
const {
  initCertificationVerificatedContract,
} = require("../contracts/CertificationVerificated");
const { authenticate } = require("../middleware/authMiddleware");

// Inicialización del contrato
const certificationVerificatedContract = initCertificationVerificatedContract();
const router = express.Router();

// Rutas
router.post("/certify", authenticate, async (req, res) => {
  const { certifiedString, description } = req.body;
  const { address, timestamp, message, signed, expectedHash } =
    req.authentication;
  const maxRetries = 5;
  const retryDelay = 500;
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
    try {
      const nonce = await certificationVerificatedContract.wallet.getNonce(
        "pending"
      );
      const signature = signed.slice(2);
      const tx = await certificationVerificatedContract.contract.certify(
        certifiedString,
        description,
        address,
        expectedHash,
        "0x" + signature,
        timestamp,
        { nonce: nonce }
      );
      const receipt = await tx.wait();
      return res.json({
        message: `Cadena certificada con éxitooo: ${certifiedString}`,
        transactionHash: receipt.hash,
        transactionInfo: JSON.stringify(receipt),
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
