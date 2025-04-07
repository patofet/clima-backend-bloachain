// contracts/certification.js
const { ethers } = require("ethers");
const fs = require("fs");
const { ADDRESSES_PATH } = require("../config/constants");
const { getSigner } = require("../sharedSigner");

const initCertificationVerificatedContract = () => {
  const addressesPath = ADDRESSES_PATH;
  const certificationInfoPath =
    "artifacts/contracts/CertificationVerificated.sol/CertificationVerificated.json";
  const data = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const certificationInfo = JSON.parse(
    fs.readFileSync(certificationInfoPath, "utf8")
  );
  const certificationAddress = data["DeployModule#CertificationVerificated"];
  const abiCertification = certificationInfo["abi"];

  if (!certificationAddress || !abiCertification) {
    throw new Error("Falta dirección o ABI para CertificationVerificated");
  }

  const sharedManagedSigner = getSigner();

  const contract = new ethers.Contract(
    certificationAddress,
    abiCertification,
    sharedManagedSigner
  );

  return contract;
};

module.exports = { initCertificationVerificatedContract };
