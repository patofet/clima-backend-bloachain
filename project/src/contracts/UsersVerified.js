// contracts/certification.js
const { ethers, JsonRpcProvider } = require("ethers");
const { ADDRESSES_PATH } = require("../config/constants");

// Función para inicializar el contrato
const initUsersVerifiedContract = () => {
  const fs = require("fs");
  const addressesPath = ADDRESSES_PATH;
  const storageInfoPath =
    "artifacts/contracts/UsersVerified.sol/UsersVerified.json";
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const storageInfo = JSON.parse(fs.readFileSync(storageInfoPath, "utf8"));

  const provider = new JsonRpcProvider(process.env.JSON_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const storageAddress = addresses["DeployModule#UsersVerified"];
  const storageAbi = storageInfo["abi"];

  if (!storageAddress) {
    throw new Error(
      "La dirección del contrato de storage no se ha encontrado."
    );
  }
  if (!storageAbi) {
    throw new Error("El ABI del contrato de storage no se ha encontrado.");
  }

  return new ethers.Contract(storageAddress, storageAbi, wallet);
};

// Exporta el contrato inicializado
module.exports = { initUsersVerifiedContract };
