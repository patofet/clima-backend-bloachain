const { ethers } = require('ethers');
const CryptoJS = require('crypto-js');

const SERVER_SECRET = process.env.PRIVATE_KEY;

function authenticate(req, res, next) {
    try {
        // Extrae el header Authorization
        const { authorization } = req.headers;
        if (!authorization) {
            return res.status(401).json({ error: 'Unauthorized: Missing authorization header' });
        }

        // Decodifica las credenciales del header
        const [type, credentials] = authorization.split(' ');
        if (type !== 'Basic' || !credentials) {
            return res.status(401).json({ error: 'Header Authorization must be of type Basic' });
        }
        const [address, timestamp, message] = Buffer.from(credentials, 'base64').toString().split(':');

        if (!address) {
            return res.status(401).json({ error: 'Unauthorized: Missing address' });
        }
        if (!timestamp) {
            return res.status(401).json({ error: 'Unauthorized: Missing timestamp' });
        }
        if (Math.abs(Date.now() / 1000 - timestamp) > 60) {
            return res.status(401).json({ error: 'Unauthorized: Timestamp expired' });
        }
        if (!message) {
            return res.status(401).json({ error: 'Unauthorized: Missing message' });
        }

        const expectedHash = CryptoJS.HmacSHA256(address + ':' + timestamp, SERVER_SECRET).toString();

        // Verifica la firma del cliente
        const recoveredAddress = ethers.verifyMessage(expectedHash, message);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
        }

        // Autenticación exitosa, almacena el usuario en la request
        req.authentication = {
            address,
            timestamp,
            message
        };
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
}

module.exports = authenticate;
