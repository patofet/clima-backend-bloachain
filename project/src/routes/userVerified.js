// routes/usersVerifiedRoutes.js
const express = require("express");
const { initUsersVerifiedContract } = require("../contracts/UsersVerified"); // Asegúrate de ajustar la ruta
const { authenticate, isAdmin } = require("../middleware/authMiddleware");

// Inicialización del contrato
const usersVerifiedContract = initUsersVerifiedContract();

const router = express.Router();

// Endpoint para agregar un usuario verificado (solo el propietario)
router.post("/add-user", authenticate, isAdmin, async (req, res) => {
  const { userAddress } = req.body;
  try {
    const tx = await usersVerifiedContract.addUser(userAddress);
    const receipt = await tx.wait();
    res.json({
      message: `Usuario ${userAddress} verificado con éxito.`,
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para eliminar un usuario verificado (solo el propietario)
router.delete("/remove-user", authenticate, isAdmin, async (req, res) => {
  const { userAddress } = req.body;
  try {
    const tx = await usersVerifiedContract.removeUser(userAddress);
    const receipt = await tx.wait();
    res.json({
      message: `Usuario ${userAddress} eliminado de la lista de verificados con éxito.`,
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para agregar una petición de verificación de usuario
router.post("/add-petition", authenticate, async (req, res) => {
  try {
    const tx = await usersVerifiedContract.addPetition(
      req.authentication.address
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.eventName === "AddedPetition");
    const user = event.args[0];
    const index = event.args[1].toString();
    res.json({
      message: `Petición de verificación para ${req.authentication.address} añadida con éxito.`,
      transactionHash: receipt.transactionHash,
      user,
      index,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener un usuario pendiente por índice
router.get("/pending-user/:index", async (req, res) => {
  const { index } = req.params;
  try {
    const userAddress = await usersVerifiedContract.getPendingUser(index);
    res.json({ userAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para verificar si un usuario está verificado
router.get("/is-verified/:userAddress", async (req, res) => {
  const { userAddress } = req.params;
  try {
    const isVerified = await usersVerifiedContract.isVerified(userAddress);
    res.json({ userAddress, isVerified });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
