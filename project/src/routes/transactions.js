const express = require("express");
const { ethers } = require("ethers");

const router = express.Router();

// Configuración del proveedor
const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);

// Endpoint para obtener el estado de la transacción
router.get("/:transactionHash", async (req, res) => {
  const { transactionHash } = req.params;

  if (!transactionHash) {
    return res
      .status(400)
      .json({ error: "El parámetro transactionHash es obligatorio." });
  }

  try {
    // Obtener el recibo de la transacción
    const receipt = await provider.getTransactionReceipt(transactionHash);

    if (!receipt) {
      return res.json({
        status: "pending",
        message: "La transacción todavía está pendiente.",
      });
    }

    // Analizar el estado de la transacción
    const status = receipt.status === 1 ? "success" : "failed";

    return res.json({
      status,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      confirmations: receipt.confirmations,
    });
  } catch (error) {
    console.error(
      `Error al obtener el estado de la transacción: ${error.message}`
    );
    return res
      .status(500)
      .json({ error: "Error al consultar el estado de la transacción." });
  }
});

module.exports = router;
