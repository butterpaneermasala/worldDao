import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    worldchain: {
      url: process.env.WORLDCHAIN_RPC_URL || "https://worldchain-mainnet.g.alchemy.com/v2/" + (process.env.ALCHEMY_API_KEY || ""),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 480,
      gasPrice: 20000000000, // 20 gwei
    },
    worldchainSepolia: {
      url: process.env.WORLDCHAIN_SEPOLIA_RPC_URL || "https://worldchain-sepolia.g.alchemy.com/v2/" + (process.env.ALCHEMY_API_KEY || ""),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 4801,
      gasPrice: 5000000000, // 5 gwei (reduced from 20 gwei)
    },
  },
  etherscan: {
    apiKey: {
      worldchain: process.env.WORLDSCAN_API_KEY || "abc123abc123abc123abc123abc123abc1",
      worldchainSepolia: process.env.WORLDSCAN_API_KEY || "abc123abc123abc123abc123abc123abc1",
    },
    customChains: [
      {
        network: "worldchain",
        chainId: 480,
        urls: {
          apiURL: "https://worldchain-mainnet.explorer.alchemy.com/api",
          browserURL: "https://worldchain-mainnet.explorer.alchemy.com",
        },
      },
      {
        network: "worldchainSepolia",
        chainId: 4801,
        urls: {
          apiURL: "https://worldchain-sepolia.explorer.alchemy.com/api",
          browserURL: "https://worldchain-sepolia.explorer.alchemy.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;
