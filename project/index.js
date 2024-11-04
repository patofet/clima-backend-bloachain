const express = require('express');
const { ethers, JsonRpcProvider } = require('ethers');
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('ignition/deployments/chain-1714/deployed_addresses.json', 'utf8'));
const app = express();
const PORT = 3000;

app.use(express.json());
const contractsAddresses = {
    storage: data['DeployModule#Storage'],
    certification: data['DeployModule#Certification']
};
console.log(`Contract Addresses: ${JSON.stringify(contractsAddresses)}`);
const abiStore = [
    "function store(uint256 num) public",
    "function retrieve() public view returns (uint256)"
];
const abiCertificator = [
    "function certify(bytes32 hash, string description) public",
    "function certifyString(string certifiedString, string description) public",
    "function isCertified(bytes32 hash) public view returns (bool)",
    "function isStringCertified(string certifiedString) public view returns (bool)",
    "function getCertificateDetails(bytes32 hash) public view returns (address, uint256, string)",
    "function getStringCertificateDetails(string certifiedString) public view returns (address, uint256, string)"
];

const provider = new JsonRpcProvider("http://84.88.154.163:8545");
const privateKey = "0xa06dbd15968133e7493b8aca3479afa9305b981ae3bc3be3e1bcc3895f3c0786"; // 0x220cf77b111aB04f3B2EA51A109BedEBd6a06964
const wallet = new ethers.Wallet(privateKey, provider);
const contracts = {
    storage: new ethers.Contract(contractsAddresses.storage, abiStore, wallet),
    certification: new ethers.Contract(contractsAddresses.certification, abiCertificator, wallet)
};

app.post('/storage/store', async (req, res) => {
    const { number } = req.body;

    try {
        const tx = await contracts.storage.store(number);
        const transaction = await tx.wait();  // Espera a que se mine la transacción
        res.json({
            message: `Stored value: ${number}`,
            transaction
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/storage/retrieve', async (req, res) => {
    try {
        const value = await contracts.storage.retrieve();
        res.json({ value: value.toString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/certification/certify', async (req, res) => {
    const { hash, description } = req.body;

    try {
        const tx = await contracts.certification.certify(hash, description);
        const transaction = await tx.wait(); // Espera a que se mine la transacción
        res.json({
            message: `Hash certificado: ${hash}`,
            transaction
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/certification/certifyString', async (req, res) => {
    const { certifiedString, description } = req.body;

    try {
        const tx = await contracts.certification.certifyString(certifiedString, description);
        const transaction = await tx.wait(); // Espera a que se mine la transacción
        res.json({
            message: `Cadena certificada: ${certifiedString}`,
            transaction
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/certification/isCertified/:hash', async (req, res) => {
    const { hash } = req.params;

    try {
        const isCertified = await contracts.certification.isCertified(hash);
        res.json({ hash, isCertified });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/certification/isStringCertified/:certifiedString', async (req, res) => {
    const { certifiedString } = req.params;

    try {
        const isCertified = await contracts.certification.isStringCertified(certifiedString);
        res.json({ certifiedString, isCertified });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/certification/getCertificateDetails/:hash', async (req, res) => {
    const { hash } = req.params;

    try {
        const details = await contracts.certification.getCertificateDetails(hash);
        res.json({ hash, details });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/certification/getStringCertificateDetails/:certifiedString', async (req, res) => {
    const { certifiedString } = req.params;

    try {
        const details = await contracts.certification.getStringCertificateDetails(certifiedString);
        res.json({ certifiedString, details });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log('Available Endpoints:');
    app._router.stack.forEach((middleware) => {
        if (middleware.route) { // Es un endpoint
            console.log(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
        }
    });
    console.log(`API running on port ${PORT}`);
});
