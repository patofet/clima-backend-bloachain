// routes/certificationRoutes.js
const express = require('express');
const { initCertificationContract } = require('../contracts/certification');

// Inicialización del contrato
const certificationContract = initCertificationContract();

const router = express.Router();

// Rutas
router.post('/certifyString', async (req, res) => {
    const { certifiedString, description } = req.body;
    try {
        const tx = await certificationContract.certifyString(certifiedString, description);
        const receipt = await tx.wait(); // Espera la confirmación
        res.json({
            message: `Cadena certificada con éxito: ${certifiedString}`,
            transactionHash: receipt.transactionHash
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/isStringCertified/:certifiedString', async (req, res) => {
    const { certifiedString } = req.params;
    try {
        const isCertified = await certificationContract.isStringCertified(certifiedString);
        res.json({ certifiedString, isCertified });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/getStringCertificateDetails/:certifiedString', async (req, res) => {
    const { certifiedString } = req.params;
    try {
        const details = await certificationContract.getStringCertificateDetails(certifiedString);
        res.json({
            certifiedString,
            certifier: details[0],
            timestamp: details[1].toString(), // Convierte BigInt a string
            description: details[2]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
