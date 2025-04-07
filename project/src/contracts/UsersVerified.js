// contracts/users.js
const { ethers } = require("ethers");
const fs = require("fs");
const { ADDRESSES_PATH } = require("../config/constants");
const { getSigner } = require("../sharedSigner");

const initUsersVerifiedContract = () => {
  const addressesPath = ADDRESSES_PATH;
  const storageInfoPath =
    "artifacts/contracts/UsersVerified.sol/UsersVerified.json";
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const storageInfo = JSON.parse(fs.readFileSync(storageInfoPath, "utf8"));
  const storageAddress = addresses["DeployModule#UsersVerified"];
  const storageAbi = storageInfo["abi"];

  if (!storageAddress || !storageAbi) {
    throw new Error("Falta dirección o ABI para UsersVerified");
  }

  const sharedManagedSigner = getSigner();

  const contract = new ethers.Contract(
    storageAddress,
    storageAbi,
    sharedManagedSigner
  );

  return contract;
};

module.exports = { initUsersVerifiedContract };
