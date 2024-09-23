// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DeployModule = buildModule("DeployModule", (m) => {

  const lock = m.contract("Lock", [m.getParameter("unlockTime", 1893456000)], {
    value: m.getParameter("lockedAmount", 1_000_000_000n),
  });

  const storage = m.contract("Storage", [], {});

  return { storage, lock };
});

export default DeployModule;
