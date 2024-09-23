const express = require('express');
const { ethers, JsonRpcProvider } = require('ethers');
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('ignition/deployments/chain-1714/deployed_addresses.json', 'utf8'));

const app = express();
const PORT = 3000;

// Middleware para analizar JSON
app.use(express.json());

// Dirección del contrato desplegado
const contractAddress = data['DeployModule#Storage'];  // Reemplaza con la dirección de tu contrato
console.log(contractAddress);
// ABI del contrato (esto lo obtienes tras compilar el contrato)
const abi = [
    "function store(uint256 num) public",
    "function retrieve() public view returns (uint256)"
];

// Proveedor de la blockchain (tu nodo Besu o cualquier nodo compatible)
const provider = new JsonRpcProvider("http://localhost:8545"); // Cambia según la URL de tu nodo Besu

// Cuenta que interactuará con el contrato (debe tener ETH para gas)
const privateKey = "0xa06dbd15968133e7493b8aca3479afa9305b981ae3bc3be3e1bcc3895f3c0786";  // Reemplaza con la clave privada de la cuenta con la que interactuarás
// 0x220cf77b111aB04f3B2EA51A109BedEBd6a06964
const wallet = new ethers.Wallet(privateKey, provider);

// Conectar con el contrato
const contract = new ethers.Contract(contractAddress, abi, wallet);

// Endpoint para almacenar un valor
app.post('/store', async (req, res) => {
    const { number } = req.body;

    try {
        const tx = await contract.store(number);
        const transaction = await tx.wait();  // Espera a que se mine la transacción
        res.json({
            message: `Stored value: ${number}`,
            transaction
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para recuperar el valor
app.get('/retrieve', async (req, res) => {
    try {
        const value = await contract.retrieve();
        res.json({ value: value.toString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
