const { ethers, Wallet } = require("ethers");
const CryptoJS = require("crypto-js");

const SERVER_SECRET = process.env.PRIVATE_KEY;

// get address of the server
const serverAddress = new Wallet(SERVER_SECRET).address;
async function authenticate(req, res, next) {
  try {
    // Extrae el header Authorization
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({ error: "Unauthorized: Missing authorization header" });
    }

    const [type, credentials] = authorization.split(" ");
    if (type !== "Basic" || !credentials) {
      console.error(`Authentication error: Expected Basic type, got ${type}`);
      return res.status(401).json({ error: "Header Authorization must be of type Basic" });
    }
    const credentials_data_decoded = Buffer.from(credentials, "base64").toString().split(":");
    const signed = credentials_data_decoded.pop();
    const encodedMessage = credentials_data_decoded.join(":");
    const [address, timestamp, message] = encodedMessage.toString().split("/");

    if (!address) {
      console.error("Authentication error: Missing address");
      return res.status(401).json({ error: "Unauthorized: Missing address" });
    }
    if (!timestamp) {
      console.error("Authentication error: Missing timestamp");
      return res.status(401).json({ error: "Unauthorized: Missing timestamp" });
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 10 * 60) {
      console.error(`Authentication error: Timestamp expired, ${timestamp}, now: ${now}`);
      return res.status(401).json({ error: "Unauthorized: Timestamp expired" });
    }
    // if (!message) {
    //   return res.status(401).json({ error: "Unauthorized: Missing message" });
    // }
    if (!signed) {
      console.error("Authentication error: Missing signed");
      return res.status(401).json({ error: "Unauthorized: Missing signed" });
    }
    const expectedHash = CryptoJS.HmacSHA256(encodedMessage, SERVER_SECRET).toString();

    const recoveredAddress = ethers.verifyMessage(expectedHash, signed);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      console.error(`Authentication error: Invalid signature, expected: ${address}, got: ${recoveredAddress}`);
      return res.status(401).json({ error: "Unauthorized: Invalid signature" });
    }

    req.authentication = {
      address,
      timestamp,
      message,
      signed,
      expectedHash,
      isAdmin: address === serverAddress,
    };
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
}
function isAdmin(req, res, next) {
  if (req.authentication && req.authentication.isAdmin) {
    return next();
  } else {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
}

module.exports = { authenticate, isAdmin };
