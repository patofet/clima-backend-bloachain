const { ethers } = require("ethers");
const CryptoJS = require("crypto-js");

const SERVER_SECRET = process.env.PRIVATE_KEY;

function authenticate(req, res, next) {
  try {
    // Extrae el header Authorization
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing authorization header" });
    }

    // Decodifica las credenciales del header
    const [type, credentials] = authorization.split(" ");
    if (type !== "Basic" || !credentials) {
      return res
        .status(401)
        .json({ error: "Header Authorization must be of type Basic" });
    }
    const credentials_data_decoded = Buffer.from(credentials, "base64")
      .toString()
      .split(":");
    const signed = credentials_data_decoded.pop();
    const encodedMessage = credentials_data_decoded.join(":");
    const [address, timestamp, message] = encodedMessage.toString().split("/");

    if (!address) {
      return res.status(401).json({ error: "Unauthorized: Missing address" });
    }
    if (!timestamp) {
      return res.status(401).json({ error: "Unauthorized: Missing timestamp" });
    }
    if (Math.abs(Date.now() / 1000 - timestamp) > 60) {
      return res.status(401).json({ error: "Unauthorized: Timestamp expired" });
    }
    if (!message) {
      return res.status(401).json({ error: "Unauthorized: Missing message" });
    }
    if (!signed) {
      return res.status(401).json({ error: "Unauthorized: Missing signed" });
    }

    const expectedHash = CryptoJS.HmacSHA256(
      encodedMessage,
      SERVER_SECRET
    ).toString();

    // Verifica la firma del cliente
    const recoveredAddress = ethers.verifyMessage(expectedHash, signed);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: "Unauthorized: Invalid signature" });
    }

    // Autenticación exitosa, almacena el usuario en la request
    req.authentication = {
      address,
      timestamp,
      message,
      signed,
    };
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
}

module.exports = authenticate;
