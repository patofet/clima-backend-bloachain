const express = require("express");
const { authenticate, isAdmin } = require("../middleware/authMiddleware");
const ethers = require("ethers");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const createUserRouter = (usersContract, restartNonceManager) => {
  const router = express.Router();
  const maxRetries = 5;
  const retryDelay = 1000;

  router.post("/add-user", authenticate, isAdmin, async (req, res) => {
    const { userAddress } = req.body;
    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res
        .status(400)
        .json({ error: "Dirección de usuario inválida o faltante." });
    }
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(
          `Intento ${
            attempt + 1
          }: Llamando a usersContract.addUser(${userAddress})`
        );
        const tx = await usersContract.addUser(userAddress);
        console.log(`Intento ${attempt + 1}: addUser Tx enviada: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Intento ${attempt + 1}: addUser Tx confirmada.`);
        return res.json({
          message: `Usuario ${userAddress} verificado con éxito.`,
          transactionHash: receipt.transactionHash,
        });
      } catch (error) {
        console.error(`${at} falló: ${error.reason}`);
        attempt++;
        const nonceErrorCodes = ["NONCE_EXPIRED"];
        const nonceErrorMessages = [
          "nonce has already been used",
          "nonce too low",
          "Transaction nonce is too distant",
        ];
        if (
          nonceErrorCodes.includes(error.code) ||
          nonceErrorMessages.some((msg) => error.message?.includes(msg))
        ) {
          if (attempt >= maxRetries) {
            console.error("Máximo de reintentos alcanzado.");
            return res.status(500).json({
              error: "Error de nonce persistente tras reintentos.",
              details: error.message,
            });
          }
          console.warn(
            `Error de Nonce detectado (${error.message}). Esperando ${retryDelay}ms y reiniciando NonceManager...`
          );
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
      error: "Se alcanzó el límite de reintentos sin éxito al agregar usuario.",
    });
  });

  router.delete("/remove-user", authenticate, isAdmin, async (req, res) => {
    const { userAddress } = req.body;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(
          `Intento ${
            attempt + 1
          }: Llamando a usersContract.removeUser(${userAddress})`
        );
        const tx = await usersContract.removeUser(userAddress);
        console.log(
          `Intento ${attempt + 1}: removeUser Tx enviada: ${tx.hash}`
        );
        const receipt = await tx.wait();
        console.log(`Intento ${attempt + 1}: removeUser Tx confirmada.`);
        return res.json({
          message: `Usuario ${userAddress} eliminado de verificados con éxito.`,
          transactionHash: receipt.transactionHash,
        });
      } catch (error) {
        console.error(`${at} falló: ${error.reason}`);
        attempt++;
        const nonceErrorCodes = ["NONCE_EXPIRED"];
        const nonceErrorMessages = [
          "nonce has already been used",
          "nonce too low",
          "Transaction nonce is too distant",
        ];
        if (
          nonceErrorCodes.includes(error.code) ||
          nonceErrorMessages.some((msg) => error.message?.includes(msg))
        ) {
          if (attempt >= maxRetries) {
            console.error("Máximo de reintentos alcanzado.");
            return res.status(500).json({
              error: "Error de nonce persistente tras reintentos.",
              details: error.message,
            });
          }
          console.warn(
            `Error de Nonce detectado (${error.message}). Esperando ${retryDelay}ms y reiniciando NonceManager...`
          );
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
      error:
        "Se alcanzó el límite de reintentos sin éxito al eliminar usuario.",
    });
  });

  router.post("/add-petition", authenticate, async (req, res) => {
    const userAddress = req.authentication.address;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(
          `Intento ${
            attempt + 1
          }: Llamando a usersContract.addPetition(${userAddress})`
        );
        const tx = await usersContract.addPetition(userAddress);
        console.log(
          `Intento ${attempt + 1}: addPetition Tx enviada: ${tx.hash}`
        );
        const receipt = await tx.wait();
        console.log(`Intento ${attempt + 1}: addPetition Tx confirmada.`);
        let eventData = {};
        try {
          const eventFragment =
            usersContract.interface.getEvent("AddedPetition");
          const eventTopic = eventFragment.topicHash;
          const eventLog = receipt.logs?.find(
            (log) => log.topics[0] === eventTopic
          );
          if (eventLog) {
            const parsed = usersContract.interface.parseLog(eventLog);
            eventData = {
              user: parsed.args[0],
              index: parsed.args[1].toString(),
            };
          } else {
            console.warn(
              "Evento AddedPetition no encontrado en los logs del recibo."
            );
          }
        } catch (parseError) {
          console.error("Error parseando evento AddedPetition:", parseError);
        }

        return res.json({
          message: `Petición de verificación para ${userAddress} añadida con éxito.`,
          transactionHash: receipt.transactionHash,
          ...eventData,
        });
      } catch (error) {
        console.error(
          `Intento ${attempt + 1} addPetition falló: ${error.message}`
        );
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
              "addPetition: Máximo de reintentos alcanzado después de error de nonce."
            );
            return res.status(500).json({
              error:
                "Error de nonce persistente tras reintentos al añadir petición.",
              details: error.message,
            });
          }
          console.warn(
            `addPetition: Error de Nonce detectado (${error.message}). Esperando ${retryDelay}ms y reiniciando...`
          );
          await sleep(retryDelay);
          restartNonceManager();
          console.log("NonceManager reiniciado. Reintentando addPetition...");
          continue;
        } else {
          console.error("addPetition: Error no relacionado con nonce:", error);
          return res.status(500).json({
            error: `Error al añadir petición: ${error.message}`,
            code: error.code,
          });
        }
      }
    }
    return res.status(500).json({
      error: "Se alcanzó el límite de reintentos sin éxito al añadir petición.",
    });
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
        return res
          .status(404)
          .json({ error: `Índice ${index} fuera de rango.` });
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
      res
        .status(500)
        .json({ error: "Error al verificar usuario.", details: error.message });
    }
  });

  return router;
};

module.exports = createUserRouter;
