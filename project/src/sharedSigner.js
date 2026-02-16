const { ethers, JsonRpcProvider } = require("ethers");
require("dotenv").config();

let provider;
let baseWallet;
let allProviders = []; // Keep references for health checks

const initializeSharedSigner = () => {
  if (baseWallet) {
    return { getSigner, getProvider };
  }

  // Support multiple RPC nodes via JSON_RPC_URLS (comma-separated)
  // Falls back to single JSON_RPC_URL for backwards compatibility
  const rpcUrls = process.env.JSON_RPC_URLS
    ? process.env.JSON_RPC_URLS.split(",").map((url) => url.trim())
    : [process.env.JSON_RPC_URL];

  // Use the FIRST node as primary provider for sending transactions
  // All txs go through the same node to avoid mempool/nonce desync across nodes
  provider = new JsonRpcProvider(rpcUrls[0]);
  console.log(`✅ Provider primario: ${rpcUrls[0]}`);

  // Create individual providers for all nodes (for health checks)
  allProviders = rpcUrls.map((url) => ({ url, provider: new JsonRpcProvider(url) }));

  if (rpcUrls.length > 1) {
    console.log(`ℹ️  ${rpcUrls.length} nodos configurados. Primario: ${rpcUrls[0]}`);
    console.log(`ℹ️  Nodos backup: ${rpcUrls.slice(1).join(", ")}`);

    // Check connectivity of all nodes at startup (async, non-blocking)
    allProviders.forEach(async ({ url, provider: p }, i) => {
      try {
        const blockNumber = await p.getBlockNumber();
        console.log(`   🟢 Nodo ${i + 1} (${url}): OK, bloque #${blockNumber}`);
      } catch (err) {
        console.error(`   🔴 Nodo ${i + 1} (${url}): ERROR - ${err.message}`);
      }
    });
  }

  // Plain wallet, NO NonceManager — nonces managed manually by TransactionQueue
  baseWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`✅ Wallet inicializada: ${baseWallet.address}`);
  return { getSigner, getProvider };
};

/**
 * Switch the wallet to a different RPC node (for failover).
 * Called by TransactionQueue when the primary node is unresponsive.
 */
const switchProvider = (nodeIndex) => {
  if (nodeIndex >= allProviders.length) {
    console.error(`[Failover] No hay nodo con índice ${nodeIndex}`);
    return false;
  }
  const { url, provider: newProvider } = allProviders[nodeIndex];
  provider = newProvider;
  baseWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.warn(`[Failover] ⚠️ Cambiado a nodo ${nodeIndex + 1}: ${url}`);
  return true;
};

const getSigner = () => {
  if (!baseWallet) {
    throw new Error("Signer no inicializado.");
  }
  return baseWallet;
};

const getProvider = () => {
  if (!provider) {
    throw new Error("Provider no inicializado.");
  }
  return provider;
};

const getNodeCount = () => allProviders.length;

const getTransactionDetails = async (transactionHash, contractAbi) => {
  try {
    const receipt = await provider.getTransactionReceipt(transactionHash);
    const block = await provider.getBlock(receipt.blockNumber);
    const finalStatus = receipt.status === 1 ? "success" : "failed";

    const transaction = await provider.getTransaction(transactionHash);

    const contractInterface = new ethers.Interface(contractAbi);
    const decodedData = contractInterface.parseTransaction({
      data: transaction.data,
      value: transaction.value,
    });

    const functionFragment = contractInterface.getFunction(decodedData.name);
    const decodedParamsData = {};
    functionFragment.inputs.forEach((input, index) => {
      const paramName = input.name || `param_${index}`;
      decodedParamsData[paramName] = decodedData.args[index]?.toString();
    });

    return {
      status: finalStatus,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      from: receipt.from,
      to: receipt.to,
      functionName: decodedData.name,
      functionParams: decodedParamsData,
      transaction,
      block,
    };
  } catch (error) {
    console.error(`getTransactionDetails: Error general para ${transactionHash}:`, error);
    return {
      status: "error",
      message: "Error al consultar estado de la transacción.",
      error: error.message,
      transactionHash,
    };
  }
};

module.exports = {
  initializeSharedSigner,
  getSigner,
  getProvider,
  getNodeCount,
  switchProvider,
  getTransactionDetails,
};
