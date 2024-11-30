// routes/certificationRoutes.js
const express = require('express');
const { initCertificationContract } = require('../contracts/certification');
const authenticate = require('../middleware/authMiddleware');

// Inicialización del contrato
const certificationContract = initCertificationContract();

const router = express.Router();

// Rutas
router.post('/certify', authenticate, async (req, res) => {
    const { certifiedString, description } = req.body;
    const { address, timestamp, message } =  req.authentication;
    try {
        const tx = await certificationContract.certify(certifiedString, description, address, message, timestamp);
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
            dataCertified: data,
            description: details[5],
            certificate:{
                certifier: details[0],
                timestamp: details[4].toString()
            },
            proof:{
                requester: details[1],
                signature: details[2],
                timestamp: details[3].toString()
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
