// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DeployModule = buildModule("DeployModule", (m) => {

  const doubleMappingStorage = m.contract("DoubleMappingStorage", [], {});

  const certification = m.contract("Certification", [], {});

  const solarOwnership = m.contract("SolarOwnership", [], {});

  return { doubleMappingStorage, certification, solarOwnership };
});

export default DeployModule;
