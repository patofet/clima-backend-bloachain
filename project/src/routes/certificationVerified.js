const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { ethers } = require("ethers");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const createCertificationRouter = (certificationVerifiedContract, restartNonceManager, getTransactionDetails) => {
  const router = express.Router();
  let certificationAbi;
  let certificationAddress;
  try {
    certificationAbi = certificationVerifiedContract.interface.format();
    certificationAddress = certificationVerifiedContract.target;
    if (!certificationAbi || !certificationAddress) {
      throw new Error("No se pudo cargar ABI o dirección para decodificación.");
    }
    console.log(`✅ ABI y Dirección de CertificationVerificated cargados.`);
  } catch (e) {
    console.error("💥 Error ABI/Dirección para certificationRoutes:", e);
  }

  router.post("/certify", authenticate, async (req, res) => {
    const { certifiedString, description } = req.body;
    const { address, timestamp, message, signed, expectedHash } = req.authentication;
    const idOfRequest = req.id;
    const maxRetries = 5;
    const retryDelay = 1000;
    let attempt = 0;
    console.info(
      JSON.stringify({
        address,
        description,
        message,
      })
    );
    if (!certifiedString || !description) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (message !== certifiedString) {
      return res.status(400).json({ error: "Invalid message." });
    }

    while (attempt < maxRetries) {
      const attemptStartTime = Date.now();
      const at = attempt + 1;
      try {
        const signature = signed.slice(2);
        console.info(JSON.stringify({ idOfRequest, attempt, address }));
        const actualTimestamp = Math.floor(Date.now() / 1000);
        console.log(`${at}: Llamando a certify... with address: ${address} and message: ${message}, actualTimestamp: ${actualTimestamp}`);
        const tx = await certificationVerifiedContract.certify(certifiedString, description, address, expectedHash, "0x" + signature, timestamp);
        console.info(JSON.stringify({ idOfRequest, attempt, address, transactionHash: tx.hash }));

        console.log(`${at}: Transacción enviada, hash: ${tx.hash}`);
        const confirmationStartTime = Date.now();
        const receipt = await tx.wait();
        console.log(`${at}: Transacción confirmada with address: ${address} and message: ${message}, actualTimestamp: ${actualTimestamp}.`);
        const confirmationDurationMs = Date.now() - confirmationStartTime;
        console.info(
          JSON.stringify({
            idOfRequest,
            attempt,
            address,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            confirmationDurationMs,
          })
        );
        const totalDurationMs = Date.now() - startTime;
        console.info(JSON.stringify({ idOfRequest, totalDurationMs }));
        return res.json({
          message: `Cadena certificada con éxito: ${certifiedString}`,
          transactionHash: receipt.hash,
        });
      } catch (error) {
        const attemptDurationMs = Date.now() - attemptStartTime;
        console.error(
          JSON.stringify({
            idOfRequest,
            attempt,
            address,
            attemptDurationMs,
            err: {
              message: error.message,
              code: error.code,
              reason: error.reason,
              stack: error.stack,
            },
          })
        );
        console.error(`${at} falló: ${error.reason}`);
        attempt++;
        const nonceErrorCodes = ["NONCE_EXPIRED"];
        const nonceErrorMessages = ["nonce has already been used", "nonce too low", "Transaction nonce is too distant"];
        if (nonceErrorCodes.includes(error.code) || nonceErrorMessages.some((msg) => error.message?.includes(msg))) {
          if (attempt >= maxRetries) {
            console.error("Máximo de reintentos alcanzado saliendo.");
            console.error(JSON.stringify({ idOfRequest, address }));
            return res.status(500).json({
              error: "Error de nonce persistente tras reintentos.",
              details: error.message,
            });
          }
          console.warn(JSON.stringify({ idOfRequest, attempt, retryDelay }));
          console.warn(`Error de Nonce detectado (${error.message}). Esperando ${retryDelay}ms y reiniciando NonceManager...`);
          restartNonceManager();
          await sleep(retryDelay);
          console.warn("NonceManager reiniciado. Reintentando...");
          continue;
        } else if (error.code === "CALL_EXCEPTION") {
          console.warn("Transaction revertida o fallida detectada on-chain.");
          restartNonceManager();
          return res.status(500).json({
            error: `Error en la transacción: ${error.message}`,
            details: error.reason,

            code: error.code,
          });
        } else {
          console.error("Error no relacionado con nonce:", error);
          return res.status(500).json({
            error: `Error en la transacción: ${error.message}`,
            code: error.code,
          });
        }
      }
    }
    console.error(JSON.stringify({ idOfRequest, address, attempts: maxRetries }));
    return res.status(500).json({ error: "Se alcanzó el límite de reintentos sin éxito." });
  });

  router.post("/certify-async", authenticate, async (req, res) => {
    const { certifiedString, description } = req.body;
    const { address, timestamp, message, signed, expectedHash } = req.authentication;
    const maxRetries = 5;
    const retryDelay = 1000;
    let attempt = 0;

    if (!certifiedString || !description) {
      return res.status(400).json({ error: "..." });
    }
    if (message !== certifiedString) {
      return res.status(400).json({ error: "..." });
    }

    while (attempt < maxRetries) {
      try {
        const signature = signed.slice(2);
        console.log(`Intento ${attempt + 1}: [Async] Llamando a certify...`);
        const tx = await certificationVerifiedContract.certify(certifiedString, description, address, expectedHash, "0x" + signature, timestamp);
        console.log(`Intento ${attempt + 1}: [Async] Transacción enviada via NonceManager, hash: ${tx.hash}`);
        return res.status(202).json({
          message: "Transacción enviada con éxito. Pendiente de confirmación por la red.",
          status: "pending",
          transactionHash: tx.hash,
        });
      } catch (error) {
        console.error(`${at} falló: ${error.reason}`);
        attempt++;
        const nonceErrorCodes = ["NONCE_EXPIRED"];
        const nonceErrorMessages = ["nonce has already been used", "nonce too low", "Transaction nonce is too distant"];
        if (nonceErrorCodes.includes(error.code) || nonceErrorMessages.some((msg) => error.message?.includes(msg))) {
          if (attempt >= maxRetries) {
            console.error("Máximo de reintentos alcanzado.");
            return res.status(500).json({
              error: "Error de nonce persistente tras reintentos.",
              details: error.message,
            });
          }
          console.warn(`Error de Nonce detectado (${error.message}). Esperando ${retryDelay}ms y reiniciando NonceManager...`);
          await sleep(retryDelay);
          restartNonceManager();
          console.log("NonceManager reiniciado. Reintentando...");
          continue;
        } else if (error.code === "CALL_EXCEPTION") {
          console.warn("Transaction revertida o fallida detectada on-chain.");
          restartNonceManager();
          return res.status(500).json({
            error: `Error en la transacción: ${error.message}`,
            details: error.reason,

            code: error.code,
          });
        } else {
          console.error("Error no relacionado con nonce:", error);
          return res.status(500).json({
            error: `Error en la transacción: ${error.message}`,
            code: error.code,
          });
        }
      }
    }
    return res.status(500).json({
      error: "Se alcanzó el límite de reintentos sin poder enviar la transacción.",
    });
  });

  router.get("/getCertificate/:TransactionHash", async (req, res) => {
    const { TransactionHash } = req.params;
    if (!TransactionHash || !/^0x[a-fA-F0-9]{64}$/.test(TransactionHash)) {
      return res.status(400).json({ error: "Formato de hash inválido." });
    }

    try {
      const txDetails = await getTransactionDetails(TransactionHash, certificationAbi);
      if (txDetails.status === "error") {
        return res.status(500).json({ error: txDetails.message || "Error al obtener detalles." });
      }
      console.log(`Detalles de transacción obtenidos: ${JSON.stringify(txDetails)}`);
      return res.render("certificateDetails", {
        status: txDetails.status,
        blockNumber: txDetails.blockNumber,
        dateBlock: new Date(txDetails.block.timestamp * 1000).toLocaleString(),
        transactionHash: txDetails.transaction.hash,
        functionName: txDetails.functionName,
        params: txDetails.functionParams,
        from: txDetails.from,
        to: txDetails.to,
        gasUsed: txDetails.gasUsed,
      });
    } catch (error) {
      console.error(`Error en GET /getCertificate/${TransactionHash}:`, error);
      return res.status(500).json({
        error: "Error interno al procesar la solicitud.",
        details: error.message,
      });
    }
  });
  router.get("/getCertificateData/:TransactionHash", async (req, res) => {
    const { TransactionHash } = req.params;
    if (!TransactionHash || !/^0x[a-fA-F0-9]{64}$/.test(TransactionHash)) {
      return res.status(400).json({ error: "Formato de hash inválido." });
    }

    try {
      const txDetails = await getTransactionDetails(TransactionHash, certificationAbi);
      if (txDetails.status === "error") {
        return res.status(500).json({ error: txDetails.message || "Error al obtener detalles." });
      }
      return res.status(200, {
        status: txDetails.status,
        blockNumber: txDetails.blockNumber,
        transactionHash: txDetails.transactionHash,
        functionName: txDetails.functionName,
        params: txDetails.functionParams,
        from: txDetails.from,
        to: txDetails.to,
        gasUsed: txDetails.gasUsed,
      });
    } catch (error) {
      console.error(`Error en GET /getCertificate/${TransactionHash}:`, error);
      return res.status(500).json({
        error: "Error interno al procesar la solicitud.",
        details: error.message,
      });
    }
  });
  return router;
};

module.exports = createCertificationRouter;
