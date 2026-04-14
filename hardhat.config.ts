import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@nomicfoundation/hardhat-verify"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

// ✅ Safe env handling (no dummy key)
const PRIVATE_KEY =
  process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== ""
    ? process.env.PRIVATE_KEY
    : undefined

// ✅ Single Etherscan V2 API key
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "cancun",
          viaIR: true,
        },
      },
    ],
    overrides: {
      // ✅ Reduce bytecode size for large contract
      "contracts/world/BooztoryWorld.sol": {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          evmVersion: "cancun",
          viaIR: true,
        },
      },
    },
  },

  networks: {
    "base-sepolia": {
      url: "https://sepolia.base.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 84532,
    },
    base: {
      url: "https://mainnet.base.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 8453,
    },
    "world-chain-sepolia": {
      url: "https://worldchain-sepolia.g.alchemy.com/public",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 4801,
    },
    "world-chain": {
      url: "https://worldchain-mainnet.g.alchemy.com/public",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 480,
    },
  },

  etherscan: {
    // ✅ REQUIRED for Etherscan V2
    apiKey: ETHERSCAN_API_KEY,

    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "world-chain-sepolia",
        chainId: 4801,
        urls: {
          // ⚠️ Not fully supported yet (may fail verification)
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://worldchain-sepolia.explorer.alchemy.com",
        },
      },
      {
        network: "world-chain",
        chainId: 480,
        urls: {
          // ✅ Etherscan V2 endpoint (Hardhat injects chainid automatically)
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://worldscan.org",
        },
      },
    ],
  },

  sourcify: {
    enabled: false,
  },
}

export default config