const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { v4: uuidv4 } = require("uuid");

const createCertificationRouter = (certificationVerifiedContract, txQueue, getTransactionDetails) => {
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
    const startTime = Date.now();
    const { certifiedString, description } = req.body;
    const { address, timestamp, message, signed, expectedHash } = req.authentication;
    const idOfRequest = uuidv4();

    console.info(JSON.stringify({ idOfRequest, address, description, message }));

    if (!certifiedString || !description) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (message !== certifiedString) {
      return res.status(400).json({ error: "Invalid message." });
    }

    try {
      const signature = signed.slice(2);
      const actualTimestamp = Math.floor(Date.now() / 1000);
      console.log(`[${idOfRequest}] Llamando a certify con address: ${address}, message: ${message}, actualTimestamp: ${actualTimestamp}`);

      const { tx, receipt } = await txQueue.sendAndWait(
        (overrides) => certificationVerifiedContract.certify(certifiedString, description, address, expectedHash, "0x" + signature, timestamp, overrides)
      );

      console.info(
        JSON.stringify({
          idOfRequest,
          address,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        })
      );
      const totalDurationMs = Date.now() - startTime;
      console.info(JSON.stringify({ idOfRequest, totalDurationMs }));

      return res.json({
        message: `Cadena certificada con éxito: ${certifiedString}`,
        transactionHash: receipt.hash,
      });
    } catch (error) {
      const totalDurationMs = Date.now() - startTime;
      console.error(
        JSON.stringify({
          idOfRequest,
          address,
          totalDurationMs,
          err: { message: error.message, code: error.code, reason: error.reason },
        })
      );
      return res.status(500).json({
        error: `Error en la transacción: ${error.message}`,
        details: error.reason,
        code: error.code,
      });
    }
  });

  router.post("/certify-async", authenticate, async (req, res) => {
    const { certifiedString, description } = req.body;
    const { address, timestamp, message, signed, expectedHash } = req.authentication;

    if (!certifiedString || !description) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (message !== certifiedString) {
      return res.status(400).json({ error: "Invalid message." });
    }

    try {
      const signature = signed.slice(2);
      console.log(`[Async] Llamando a certify con address: ${address}`);

      const { tx } = await txQueue.sendOnly(
        (overrides) => certificationVerifiedContract.certify(certifiedString, description, address, expectedHash, "0x" + signature, timestamp, overrides)
      );

      console.log(`[Async] Transacción enviada, hash: ${tx.hash}`);
      return res.status(202).json({
        message: "Transacción enviada con éxito. Pendiente de confirmación por la red.",
        status: "pending",
        transactionHash: tx.hash,
      });
    } catch (error) {
      console.error(`[Async] Error: ${error.message}`);
      return res.status(500).json({
        error: `Error en la transacción: ${error.message}`,
        details: error.reason,
        code: error.code,
      });
    }
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
      return res.status(200).json({
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
      console.error(`Error en GET /getCertificateData/${TransactionHash}:`, error);
      return res.status(500).json({
        error: "Error interno al procesar la solicitud.",
        details: error.message,
      });
    }
  });

  return router;
};

module.exports = createCertificationRouter;
