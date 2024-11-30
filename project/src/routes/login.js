const express = require("express");
const { ethers } = require('ethers');
const CryptoJS = require('crypto-js');
const authenticate = require("../middleware/authMiddleware");

const SERVER_SECRET = process.env.PRIVATE_KEY;

const router = express.Router();

router.get("", (req, res) => {
    const { address } = req.query;
    const timestamp = Math.floor(Date.now() / 1000); // Marca de tiempo en segundos
    const rawMessage = `${address}:${timestamp}`;
    const hash = CryptoJS.HmacSHA256(rawMessage, SERVER_SECRET).toString();

    res.json({
        address,
        timestamp,
        hash
    });
});

router.post("/signMessage", async (req, res) => {
    const {message, key} = req.body;
    const wallet = new ethers.Wallet(key);
    const signature = await wallet.signMessage(message);

    res.send(signature);
});

router.post("/testAuthenticate", authenticate, async (req, res) => {
    res.json({
        message: 'Autenticación exitosa',
        authentication: req.authentication
    });
});

module.exports = router;