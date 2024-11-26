// contracts/certification.js
const { ethers, JsonRpcProvider } = require('ethers');

// ABI del contrato
const abiCertificator = [
    "function certify(string certifiedString, string description) public",
    "function isCertified(string certifiedString) public view returns (bool)",
    "function getCertificateDetails(string certifiedString) public view returns (address, uint256, string)"
];

// Función para inicializar el contrato
const initCertificationContract = () => {
    const fs = require('fs');
    const addressPath = 'ignition/deployments/chain-1714/deployed_addresses.json'
    const data = JSON.parse(fs.readFileSync(addressPath, 'utf8'));

    const provider = new JsonRpcProvider(process.env.JSON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const certificationAddress = data['DeployModule#Certification'];

    if (!certificationAddress) {
        throw new Error('La dirección del contrato de certificación no se ha encontrado.');
    }

    return new ethers.Contract(certificationAddress, abiCertificator, wallet);
};

// Exporta el contrato inicializado
module.exports = {
    initCertificationContract
};
