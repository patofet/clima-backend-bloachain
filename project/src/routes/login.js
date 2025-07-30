const express = require("express");
const { ethers } = require("ethers");
const CryptoJS = require("crypto-js");
const { authenticate } = require("../middleware/authMiddleware");

const SERVER_SECRET = process.env.PRIVATE_KEY;

const router = express.Router();

router.get("/", (req, res) => {
  try {
    const { address, message } = req.query;
    const timestamp = Math.floor(Date.now() / 1000) - 5;
    const encodedMessage = `${address}/${timestamp}/${message}`;
    const hash = CryptoJS.HmacSHA256(encodedMessage, SERVER_SECRET).toString();

    res.json({
      address,
      timestamp,
      message,
      encodedMessage,
      hash,
    });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post("/signMessage", async (req, res) => {
  const { hash, key } = req.body;
  try {
    const wallet = new ethers.Wallet(key);
    const signature = await wallet.signMessage(hash);
    res.send(signature);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post("/testAuthenticate", authenticate, async (req, res) => {
  try {
    res.json({
      message: "Autenticación exitosa",
      authentication: req.authentication,
    });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post("/testHash", async (req, res) => {
  try {
    const { expectedHash, signedHash } = req.body;
    const recoveredAddress = ethers.verifyMessage(expectedHash, signedHash);
    res.json({
      message: "Verificación exitosa",
      authentication: recoveredAddress,
    });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

module.exports = router;
