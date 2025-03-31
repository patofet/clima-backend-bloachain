// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const UsersVerifiedModule = buildModule("UsersVerifiedModule", (m) => {
  const usersVerified = m.contract("UsersVerified", [], {});

  return { usersVerified };
});

export default UsersVerifiedModule;
