import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

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
      accounts: ['0xa6111af4d1068a00cdf96abf12f2540bcf531deb3aaae211232059a9c704757e'],
    },
    production: {
      chainId: 1714,
      url: "http://84.88.154.252:8545",
      gasPrice: 0,
      gas: 0x1ffffffffffffe,
      accounts: ['0xa6111af4d1068a00cdf96abf12f2540bcf531deb3aaae211232059a9c704757e'],
    }
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
