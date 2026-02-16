const express = require("express");
const { authenticate, isAdmin } = require("../middleware/authMiddleware");
const ethers = require("ethers");

const createUserRouter = (usersContract, txQueue) => {
  const router = express.Router();

  router.post("/add-user", authenticate, async (req, res) => {
    const { userAddress } = req.body;
    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: "Dirección de usuario inválida o faltante." });
    }

    try {
      console.log(`Llamando a usersContract.addUser(${userAddress})`);
      const { tx, receipt } = await txQueue.sendAndWait((overrides) => usersContract.addUser(userAddress, overrides));
      console.log(`addUser Tx confirmada: ${receipt.hash}`);
      return res.json({
        message: `Usuario ${userAddress} verificado con éxito.`,
        transactionHash: receipt.hash,
      });
    } catch (error) {
      console.error(`addUser falló: ${error.message}`);
      return res.status(500).json({
        error: `Error en la transacción: ${error.message}`,
        details: error.reason,
        code: error.code,
      });
    }
  });

  router.delete("/remove-user", authenticate, isAdmin, async (req, res) => {
    const { userAddress } = req.body;

    try {
      console.log(`Llamando a usersContract.removeUser(${userAddress})`);
      const { tx, receipt } = await txQueue.sendAndWait((overrides) => usersContract.removeUser(userAddress, overrides));
      console.log(`removeUser Tx confirmada: ${receipt.hash}`);
      return res.json({
        message: `Usuario ${userAddress} eliminado de verificados con éxito.`,
        transactionHash: receipt.hash,
      });
    } catch (error) {
      console.error(`removeUser falló: ${error.message}`);
      return res.status(500).json({
        error: `Error en la transacción: ${error.message}`,
        details: error.reason,
        code: error.code,
      });
    }
  });

  router.post("/add-petition", authenticate, async (req, res) => {
    const userAddress = req.authentication.address;

    try {
      console.log(`Llamando a usersContract.addPetition(${userAddress})`);
      const { tx, receipt } = await txQueue.sendAndWait((overrides) => usersContract.addPetition(userAddress, overrides));
      console.log(`addPetition Tx confirmada: ${receipt.hash}`);

      let eventData = {};
      try {
        const eventFragment = usersContract.interface.getEvent("AddedPetition");
        const eventTopic = eventFragment.topicHash;
        const eventLog = receipt.logs?.find((log) => log.topics[0] === eventTopic);
        if (eventLog) {
          const parsed = usersContract.interface.parseLog(eventLog);
          eventData = {
            user: parsed.args[0],
            index: parsed.args[1].toString(),
          };
        } else {
          console.warn("Evento AddedPetition no encontrado en los logs del recibo.");
        }
      } catch (parseError) {
        console.error("Error parseando evento AddedPetition:", parseError);
      }

      return res.json({
        message: `Petición de verificación para ${userAddress} añadida con éxito.`,
        transactionHash: receipt.hash,
        ...eventData,
      });
    } catch (error) {
      console.error(`addPetition falló: ${error.message}`);
      return res.status(500).json({
        error: `Error al añadir petición: ${error.message}`,
        details: error.reason,
        code: error.code,
      });
    }
  });

  router.get("/pending-user/:index", async (req, res) => {
    const { index } = req.params;
    if (isNaN(parseInt(index)) || parseInt(index) < 0) {
      return res.status(400).json({ error: "Índice inválido." });
    }
    try {
      const userAddress = await usersContract.getPendingUser(index);
      res.json({ index: index, userAddress });
    } catch (error) {
      console.error(`Error en GET /pending-user/${index}:`, error);
      if (error.message.includes("index out of bounds")) {
        return res.status(404).json({ error: `Índice ${index} fuera de rango.` });
      }
      res.status(500).json({
        error: "Error al obtener usuario pendiente.",
        details: error.message,
      });
    }
  });

  router.get("/is-verified/:userAddress", async (req, res) => {
    const { userAddress } = req.params;
    try {
      const isVerified = await usersContract.isVerified(userAddress);
      res.json({ userAddress, isVerified });
    } catch (error) {
      console.error(`Error en GET /is-verified/${userAddress}:`, error);
      res.status(500).json({ error: "Error al verificar usuario.", details: error.message });
    }
  });

  return router;
};

module.exports = createUserRouter;
