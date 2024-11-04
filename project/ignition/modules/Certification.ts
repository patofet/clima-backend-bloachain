// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CertificationModule = buildModule("CertificationModule", (m) => {

  const certification = m.contract("Certification", [], {});

  return { certification };
});

export default CertificationModule;
