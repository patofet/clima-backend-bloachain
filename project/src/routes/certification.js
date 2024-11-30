// routes/certificationRoutes.js
const express = require('express');
const { initCertificationContract } = require('../contracts/certification');

// Inicialización del contrato
const certificationContract = initCertificationContract();

const router = express.Router();

// Rutas
router.post('/certify', async (req, res) => {
    const { certifiedString, description } = req.body;
    try {
        const tx = await certificationContract.certify(certifiedString, description);
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

router.get('/isCertified/:data', async (req, res) => {
    const { data } = req.params;
    try {
        const isCertified = await certificationContract.isCertified(data);
        res.json({ data, isCertified });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/getCertificateDetails/:data', async (req, res) => {
    const { data } = req.params;
    try {
        const details = await certificationContract.getCertificateDetails(data);
        res.json({
            data,
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
