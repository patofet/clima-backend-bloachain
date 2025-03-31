import { HardhatUserConfig } from "hardhat/config";
import "dotenv";
import "@nomicfoundation/hardhat-ignition-ethers";

const config: HardhatUserConfig = {
  networks: {
    localhost: {
      chainId: 1714,
      forking: {
        url: "http://localhost:8545",
        blockNumber: 0,
      },
      gasPrice: 0,
      gas: 0x1ffffffffffffe,
      accounts: [
        "0xa06dbd15968133e7493b8aca3479afa9305b981ae3bc3be3e1bcc3895f3c0786",
      ],
    },
    production: {
      chainId: 1714,
      url: "http://84.88.154.252:8545",
      gasPrice: 0,
      gas: 0x1ffffffffffffe,
      accounts: [
        "0xa06dbd15968133e7493b8aca3479afa9305b981ae3bc3be3e1bcc3895f3c0786",
      ],
    },
  },
  solidity: {
    version: "0.8.27",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};

export default config;
