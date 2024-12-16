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
        const tx = await certificationContract.contract.certify(certifiedString, description, address, message, timestamp);
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
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

router.post('/certify-async', authenticate, async (req, res) => {
    const { certifiedString, description } = req.body;
    const { address, timestamp, message } = req.authentication;

    const maxRetries = 5; // Número máximo de reintentos
    const retryDelay = 300; // Tiempo de espera entre reintentos en milisegundos
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            // Obtener el nonce actualizado
            const nonce = await certificationContract.wallet.getNonce();
            console.log(`Intento ${attempt + 1}: Nonce = ${nonce}`);

            // Enviar la transacción con el nonce
            const tx = await certificationContract.contract.certify(certifiedString, description, address, message, timestamp, { nonce });

            // Responder al cliente inmediatamente con el hash
            res.json({
                message: `Transacción enviada para certificar la cadena: ${certifiedString}`,
                transactionHash: tx.hash,
            });

            // Manejo asíncrono de la confirmación
            tx.wait()
                .then(receipt => {
                    console.log(`Transacción confirmada: ${receipt.transactionHash}`);
                })
                .catch(error => {
                    console.error(`Error confirmando la transacción: ${error.message}`);
                });

            return; // Salir del bucle si la transacción se envió con éxito
        } catch (error) {
            console.error(`Error en el intento ${attempt + 1}: ${error.message}`);

            // Verificar si el error es relacionado con el nonce
            if (error.message.includes("nonce has already been used")) {
                attempt++; // Incrementar el contador de reintentos
                console.log(`Reintentando después de ${retryDelay} ms...`);
                await sleep(retryDelay); // Esperar antes de reintentar
                continue;  // Intentar nuevamente con un nonce actualizado
            }

            // Si el error no es relacionado con el nonce, salir con un error
            return res.status(500).json({ error: error.message });
        }
    }

    // Si se alcanzó el máximo de reintentos, devolver un error al cliente
    res.status(500).json({
        error: `No se pudo enviar la transacción después de ${maxRetries} intentos.`,
    });
});



router.get('/isCertified/:data', async (req, res) => {
    const { data } = req.params;
    try {
        const isCertified = await certificationContract.contract.isCertified(data);
        res.json({ data, isCertified });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/getCertificateDetails/:data', async (req, res) => {
    const { data } = req.params;
    try {
        const details = await certificationContract.contract.getCertificateDetails(data);
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
