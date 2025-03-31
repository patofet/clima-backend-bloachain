// routes/ownershipRoutes.js
const express = require("express");
const { initSolarOwnershipContract } = require("../contracts/solarOwnership");
const { authenticate } = require("../middleware/authMiddleware");

// Inicialización del contrato
const ownershipContract = initSolarOwnershipContract();

const router = express.Router();

// Rutas

// Asignar porcentaje a un usuario (solo para el owner del contrato)
router.post("/assign", authenticate, async (req, res) => {
  const { percentage } = req.body;
  try {
    const tx = await ownershipContract.assignOwnership(
      req.authentication.address,
      percentage
    );
    const receipt = await tx.wait(); // Esperar confirmación
    res.json({
      message: `Porcentaje asignado con éxito a ${userAddress}`,
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Transferir porcentaje del usuario autenticado a otro
router.post("/transfer", authenticate, async (req, res) => {
  const { toAddress, percentage } = req.body;
  const { address } = req.authentication; // Asumimos que `authenticate` agrega `address` del usuario autenticado
  try {
    const tx = await ownershipContract.transferOwnership(
      toAddress,
      percentage,
      { from: address }
    );
    const receipt = await tx.wait(); // Esperar confirmación
    res.json({
      message: `Porcentaje transferido con éxito a ${toAddress}`,
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Transferir porcentaje entre usuarios (solo para el owner del contrato)
router.post("/transferByOwner", authenticate, async (req, res) => {
  const { fromAddress, toAddress, percentage } = req.body;
  const { address } = req.authentication; // Asumimos que `authenticate` agrega `address` del usuario autenticado
  try {
    // Verificar si el usuario es el propietario del contrato
    const contractOwner = await ownershipContract.owner();
    if (address !== contractOwner) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para realizar esta acción" });
    }

    const tx = await ownershipContract.transferOwnershipByOwner(
      fromAddress,
      toAddress,
      percentage
    );
    const receipt = await tx.wait(); // Esperar confirmación
    res.json({
      message: `Porcentaje transferido de ${fromAddress} a ${toAddress} con éxito`,
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener porcentaje de un usuario
router.get("/percentage/:userAddress", async (req, res) => {
  const { userAddress } = req.params;
  try {
    const percentage = await ownershipContract.getUserPercentage(userAddress);
    res.json({ userAddress, percentage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener porcentaje disponible
router.get("/available", async (req, res) => {
  try {
    const availablePercentage =
      await ownershipContract.getAvailablePercentage();
    res.json({ availablePercentage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
