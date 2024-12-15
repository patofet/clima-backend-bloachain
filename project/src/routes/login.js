const express = require("express");
const { ethers } = require('ethers');
const CryptoJS = require('crypto-js');
const authenticate = require("../middleware/authMiddleware");

const SERVER_SECRET = process.env.PRIVATE_KEY;

const router = express.Router();

router.get("", (req, res) => {
    const { address, message } = req.query;
    const timestamp = Math.floor(Date.now() / 1000); // Marca de tiempo en segundos
    const encodedMessage = `${address}/${timestamp}/${message}`;
    const hash = CryptoJS.HmacSHA256(encodedMessage, SERVER_SECRET).toString();

    res.json({
        address,
        timestamp,
        message,
        encodedMessage,
        hash
    });
});

router.post("/signMessage", async (req, res) => {
    const {hash, key} = req.body;
    const wallet = new ethers.Wallet(key);
    const signature = await wallet.signMessage(hash);
    res.send(signature);
});

router.post("/testAuthenticate", authenticate, async (req, res) => {
    res.json({
        message: 'Autenticación exitosa',
        authentication: req.authentication
    });
});

module.exports = router;