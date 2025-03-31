// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CertificationVerificatedModule = buildModule(
  "CertificationVerificatedModule",
  (m) => {
    const certificationVerificated = m.contract(
      "CertificationVerificated",
      [],
      {}
    );

    return { certificationVerificated };
  }
);

export default CertificationVerificatedModule;
