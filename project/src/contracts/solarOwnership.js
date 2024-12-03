// contracts/certification.js
const { ethers, JsonRpcProvider } = require('ethers');
const { ADDRESSES_PATH } = require('../config/constants');

// Función para inicializar el contrato
const initSolarOwnershipContract = () => {
    const fs = require('fs');
    const addressesPath = ADDRESSES_PATH
    const storageInfoPath = 'artifacts/contracts/SolarOwnership.sol/SolarOwnership.json';
    const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
    const solarOwnershipInfo = JSON.parse(fs.readFileSync(storageInfoPath, 'utf8'));

    const provider = new JsonRpcProvider(process.env.JSON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const solarOwnershipAddress = addresses['DeployModule#SolarOwnership'];
    const solarOwnershipAbi = solarOwnershipInfo['abi'];

    if (!solarOwnershipAddress) {
        throw new Error('La dirección del contrato de storage no se ha encontrado.');
    }
    if (!solarOwnershipAbi) {
        throw new Error('El ABI del contrato de storage no se ha encontrado.');
    }

    return new ethers.Contract(solarOwnershipAddress, solarOwnershipAbi, wallet);
};

// Exporta el contrato inicializado
module.exports = { initSolarOwnershipContract };
