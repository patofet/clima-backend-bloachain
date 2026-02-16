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
    // Create FallbackProvider with multiple nodes for redundancy and load distribution
    const providerConfigs = rpcUrls.map((url, index) => ({
      provider: new JsonRpcProvider(url),
      priority: index + 1,
      stallTimeout: 2000,
      weight: 1,
    }));
    provider = new FallbackProvider(
      providerConfigs,
      undefined,
      { quorum: 1 }
    );
    console.log(`✅ FallbackProvider inicializado con ${rpcUrls.length} nodos: ${rpcUrls.join(", ")}`);
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
