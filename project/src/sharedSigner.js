const { ethers, JsonRpcProvider, NonceManager } = require("ethers");
require("dotenv").config();

let provider;
let baseWallet;
let managedSigner;

const initializeSharedSigner = () => {
  if (managedSigner) {
    return { getSigner, getProvider, getContractInstance };
  }
  provider = new JsonRpcProvider(process.env.JSON_RPC_URL);
  baseWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  managedSigner = new NonceManager(baseWallet);
  return { getSigner, getProvider };
};

const getSigner = () => {
  if (!managedSigner) {
    throw new Error("Signer no inicializado.");
  }
  return managedSigner;
};

const getProvider = () => {
  if (!provider) {
    throw new Error("Provider no inicializado.");
  }
  return provider;
};

const restartSharedNonceManager = () => {
  if (!baseWallet) {
    throw new Error("No se puede reiniciar, baseWallet no inicializado.");
  }
  managedSigner.reset();
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
      status: finalStatus, // success | failed
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
  restartSharedNonceManager,
  getTransactionDetails,
};
