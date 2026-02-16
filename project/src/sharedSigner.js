const { ethers, JsonRpcProvider, FallbackProvider } = require("ethers");
require("dotenv").config();

let provider;
let baseWallet;

const initializeSharedSigner = () => {
  if (baseWallet) {
    return { getSigner, getProvider };
  }

  // Support multiple RPC nodes via JSON_RPC_URLS (comma-separated)
  // Falls back to single JSON_RPC_URL for backwards compatibility
  const rpcUrls = process.env.JSON_RPC_URLS
    ? process.env.JSON_RPC_URLS.split(",").map((url) => url.trim())
    : [process.env.JSON_RPC_URL];

  if (rpcUrls.length > 1) {
    // Create FallbackProvider with multiple nodes
    // IMPORTANT: All nodes get priority=1 so ethers selects RANDOMLY among them (= load balancing)
    // If priorities were different (1, 2, 3), it would always use node 1 first (= failover only)
    const individualProviders = rpcUrls.map((url) => new JsonRpcProvider(url));
    const providerConfigs = individualProviders.map((p) => ({
      provider: p,
      priority: 1,       // Same priority = random selection = load balancing
      stallTimeout: 2000,
      weight: 1,
    }));
    provider = new FallbackProvider(
      providerConfigs,
      undefined,
      { quorum: 1 }
    );
    console.log(`✅ FallbackProvider inicializado con ${rpcUrls.length} nodos (misma prioridad = load balancing):`);

    // Diagnostic: check each node individually at startup
    individualProviders.forEach(async (p, i) => {
      try {
        const blockNumber = await p.getBlockNumber();
        console.log(`   🟢 Nodo ${i + 1} (${rpcUrls[i]}): OK, bloque #${blockNumber}`);
      } catch (err) {
        console.error(`   🔴 Nodo ${i + 1} (${rpcUrls[i]}): ERROR - ${err.message}`);
      }
    });
  } else {
    provider = new JsonRpcProvider(rpcUrls[0]);
    console.log(`✅ Provider inicializado con nodo único: ${rpcUrls[0]}`);
  }

  // Plain wallet, NO NonceManager — nonces managed manually by TransactionQueue
  baseWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`✅ Wallet inicializada: ${baseWallet.address}`);
  return { getSigner, getProvider };
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
  getTransactionDetails,
};
