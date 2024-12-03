// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SolarOwnershipModule = buildModule("SolarOwnership", (m) => {

  const solarOwnership = m.contract("SolarOwnership", [], {});

  return { solarOwnership };
});

export default SolarOwnershipModule;
