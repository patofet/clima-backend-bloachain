// routes/certificationRoutes.js
const express = require("express");
const { initStorageContract } = require("../contracts/storage");

// Inicialización del contrato
const storageContract = initStorageContract();

const router = express.Router();

// Endpoint para almacenar datos
router.post("/store-user", async (req, res) => {
  const { userAddress } = req.body;
  try {
    const tx = await storageContract.store("users", userAddress, "");
    const receipt = await tx.wait();
    res.json({
      message: `usuario almacenado con éxito para las claves: "users" -> ${userAddress} -> ''`,
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/store-user-petition", async (req, res) => {
  const { userAddress } = req.body;
  try {
    const tx = await storageContract.store(
      "petition",
      userAddress,
      userAddress
    );
    const receipt = await tx.wait();
    res.json({
      message: `Dato almacenado con éxito para las claves: "petition" -> ${userAddress} -> ${userAddress}`,
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para recuperar datos
router.get("/retrieve", async (req, res) => {
  const { primaryKey, secondaryKey } = req.query;
  try {
    const [value, isSet] = await storageContract.retrieve(
      primaryKey,
      secondaryKey
    );
    res.json({
      primaryKey,
      secondaryKey,
      value,
      isSet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para verificar si existe un dato
router.get("/isSet", async (req, res) => {
  const { primaryKey, secondaryKey } = req.query;
  try {
    const exists = await storageContract.isSet(primaryKey, secondaryKey);
    res.json({
      primaryKey,
      secondaryKey,
      isSet: exists,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para eliminar datos
router.delete("/remove", async (req, res) => {
  const { primaryKey, secondaryKey } = req.body;
  try {
    const tx = await storageContract.remove(primaryKey, secondaryKey);
    const receipt = await tx.wait();
    res.json({
      message: `Dato eliminado con éxito para las claves: ${primaryKey} -> ${secondaryKey}`,
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
