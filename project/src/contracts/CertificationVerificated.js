// contracts/certification.js
const { ethers, JsonRpcProvider, NonceManager } = require("ethers");
const { ADDRESSES_PATH } = require("../config/constants");
const fs = require("fs");

// Función para inicializar el contrato
const initCertificationVerificatedContract = () => {
  const addressesPath = ADDRESSES_PATH;
  const certificationInfoPath =
    "artifacts/contracts/CertificationVerificated.sol/CertificationVerificated.json"; // Ruta correcta a tu ABI JSON
  const data = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const certificationInfo = JSON.parse(
    fs.readFileSync(certificationInfoPath, "utf8")
  );

  const provider = new JsonRpcProvider(process.env.JSON_RPC_URL);
  // Guarda la wallet base SIN NonceManager
  const baseWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const certificationAddress = data["DeployModule#CertificationVerificated"]; // Asegúrate que esta key es correcta
  const abiCertification = certificationInfo["abi"];

  if (!certificationAddress) {
    throw new Error(
      "La dirección del contrato de certificación no se ha encontrado."
    );
  }
  if (!abiCertification) {
    throw new Error(
      "El ABI del contrato de certificación no se ha encontrado."
    );
  }

  // --- Estado Mutable Interno ---
  let currentManagedSigner = new NonceManager(baseWallet);
  let currentContractInstance = new ethers.Contract(
    certificationAddress,
    abiCertification,
    currentManagedSigner // Conectar contrato al NonceManager
  );
  // --- Fin Estado Mutable ---

  const getState = () => ({
    // Función para obtener el estado actual
    contract: currentContractInstance,
    wallet: currentManagedSigner, // Exporta el NonceManager actual
    provider,
  });

  // Función para obtener detalles de la transacción
  const getTransactionDetails = async (transactionHash) => {
    try {
      // Obtener el recibo de la transacción
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return {
          status: "pending",
          message: "La transacción todavía está pendiente.",
        };
      }

      // Analizar el estado de la transacción
      const status = receipt.status === 1 ? "success" : "failed";

      // Obtener la transacción completa para decodificar la data
      const transaction = await provider.getTransaction(transactionHash);

      let functionName = "No se pudo decodificar";
      let functionParams = "No se pudo decodificar";

      if (
        transaction &&
        transaction.to === certificationAddress &&
        transaction.data !== "0x"
      ) {
        try {
          const contractInterface = new ethers.Interface(abiCertification);
          const decodedData = contractInterface.parseTransaction({
            data: transaction.data,
          });
          const { inputs } = contractInterface.getFunction(decodedData.name);
          const decodedParamsData = {};
          // inputs.forEach((input, index) => {
          //   decodedParams[input.name] = decodedData.args[index];
          // });
          for (let i = 0; i < inputs.length; i++) {
            decodedParamsData[inputs[i].name] = String(decodedData.args[i]);
          }
          functionName = decodedData.name;
          functionParams = decodedParamsData;
        } catch (decodeError) {
          console.error(
            "Error al decodificar la data de la transacción:",
            decodeError
          );
          functionName = "Decodificación fallida";
          functionParams = "Decodificación fallida";
        }
      } else {
        functionName = "No es llamada a contrato";
        functionParams = "No es llamada a contrato";
      }

      return {
        status,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        confirmations: receipt.confirmations,
        functionName: functionName,
        functionParams: functionParams,
      };
    } catch (error) {
      console.error(
        `Error al obtener el estado de la transacción: ${error.message}`
      );
      return {
        status: "error",
        message: "Error al consultar el estado de la transacción.",
        error: error.message,
      };
    }
  };

  const restartNonceManagerInternal = () => {
    console.warn("Reiniciando NonceManager y la instancia del Contrato...");
    // Crea NUEVO NonceManager usando la wallet BASE
    currentManagedSigner = new NonceManager(baseWallet);
    // Crea NUEVA instancia de Contrato conectada al NUEVO NonceManager
    currentContractInstance = new ethers.Contract(
      certificationAddress,
      abiCertification,
      currentManagedSigner
    );
    console.log("NonceManager y Contrato reiniciados.");
  };
  return {
    getState,
    restartNonceManager: restartNonceManagerInternal, // Renombrado para claridad
    getTransactionDetails,
  };
};

// Exporta el contrato inicializado
module.exports = {
  initCertificationVerificatedContract,
};
