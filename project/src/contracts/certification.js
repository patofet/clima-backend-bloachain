// contracts/certification.js
const { ethers, JsonRpcProvider, NonceManager } = require("ethers");
const { ADDRESSES_PATH } = require("../config/constants");
const fs = require("fs");

// Función para inicializar el contrato
const initCertificationContract = () => {
  const fs = require("fs");
  const addressesPath = ADDRESSES_PATH;
  const certificationInfoPath =
    "artifacts/contracts/Certification.sol/Certification.json";
  const data = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const certificationInfo = JSON.parse(
    fs.readFileSync(certificationInfoPath, "utf8")
  );

  const provider = new JsonRpcProvider(process.env.JSON_RPC_URL);
  const wallet = new NonceManager(
    new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  );
  const certificationAddress = data["DeployModule#Certification"];
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

  return {
    contract: new ethers.Contract(
      certificationAddress,
      abiCertification,
      wallet
    ),
    wallet,
    provider,
  };
};

// Exporta el contrato inicializado
module.exports = {
  initCertificationContract,
};
