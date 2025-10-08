const express = require("express");
const { Web3 } = require("web3");

const nodes = [
  { name: "Melchor", url: "http://84.88.154.163:8545" },
  { name: "Gaspar", url: "http://84.88.154.219:8545" },
  { name: "Baltazar", url: "http://84.88.154.252:8545" },
];
async function getNodeStatus(node) {
  try {
    const web3 = new Web3(new Web3.providers.HttpProvider(node.url, { timeout: 5000 }));
    const [blockNumber, isSyncing, peerCount, networkId, gasPrice, hashrate, coinbase, clientVersion] = await Promise.all([web3.eth.getBlockNumber(), web3.eth.isSyncing(), web3.eth.net.getPeerCount(), web3.eth.net.getId(), web3.eth.getGasPrice(), web3.eth.getHashrate(), web3.eth.getCoinbase().catch(() => "No disponible"), web3.eth.getNodeInfo().catch(() => "No disponible")]);
    const response = await fetch(`http://magiinterface.udg.edu:3000/login?address=0xbb678ed4adb678bad4b8f7203135ae1854463a7f&message=44`);
    const data = await response.json();
    const timestampAPI = data.timestamp;
    return {
      name: node.name,
      url: node.url,
      isOnline: true,
      blockNumber: blockNumber.toString(),
      isSyncing: isSyncing === true ? "Sí" : isSyncing ? `Sincronizando... bloque actual: ${isSyncing.currentBlock}` : "No",
      peerCount: peerCount.toString(),
      networkId: networkId.toString(),
      gasPrice: web3.utils.fromWei(gasPrice, "gwei"),
      hashrate: `${(Number(hashrate) / 1000000).toFixed(2)} MH/s`,
      coinbase: coinbase,
      clientVersion: clientVersion,
      timestampAPI: timestampAPI,
    };
  } catch (error) {
    return {
      name: node.name,
      url: node.url,
      isOnline: false,
      error: error.message.includes("timeout") ? "Tiempo de espera agotado." : "No se pudo conectar al nodo.",
    };
  }
}

const router = express.Router();

router.get("/estado-red", async (req, res) => {
  try {
    const nodePromises = nodes.map((node) => getNodeStatus(node));
    const nodesData = await Promise.all(nodePromises);
    res.render("nodeStatus", { nodes: nodesData });
  } catch (error) {
    console.error("Error al obtener el estado de la red:", error);
    res.status(500).send("Error al cargar la información de la red");
  }
});
router.get("/api/estado-red", async (req, res) => {
  try {
    const nodePromises = nodes.map((node) => getNodeStatus(node));
    const nodesData = await Promise.all(nodePromises);
    res.json(nodesData);
  } catch (error) {
    console.error("Error en la API de estado de red:", error);
    res.status(500).json({ error: "Error al obtener la información de los nodos" });
  }
});
module.exports = router;
