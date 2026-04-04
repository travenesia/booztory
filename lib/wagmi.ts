import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http, fallback } from "wagmi"
import { base } from "wagmi/chains"
import { Attribution } from "ox/erc8021"

// ==============================
// ENV VALIDATION
// ==============================
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!alchemyKey) {
  throw new Error("Missing NEXT_PUBLIC_ALCHEMY_API_KEY")
}

if (!projectId) {
  throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID")
}

// ==============================
// CHAIN CONFIG (BASE MAINNET)
// ==============================
export const APP_CHAIN = base

// Always use Base Mainnet for NFT reads
export const NFT_CHAIN_ID = base.id

// ==============================
// BUILDER CODE ATTRIBUTION (ERC-8021)
// ==============================
// Base Builder Code: bc_qaqhzzqp
// Viem 2.45.0+ supports dataSuffix on writeContract/sendTransaction.
// Wagmi doesn't expose it at config level — add to each writeContractAsync call.
// Export and spread DATA_SUFFIX_PARAM into every writeContractAsync call.
export const DATA_SUFFIX_PARAM = {
  dataSuffix: Attribution.toDataSuffix({ codes: ["bc_qaqhzzqp"] }),
} as const

// ==============================
// WAGMI CONFIG
// ==============================
export const wagmiConfig = getDefaultConfig({
  appName: "Booztory",
  projectId,

  // Base-only (clean + accurate attribution)
  chains: [base],

  transports: {
    [base.id]: fallback([
      // Primary RPC (Alchemy)
      http(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`),

      // Fallback RPC (Base public)
      http("https://mainnet.base.org"),
    ]),
  },

  ssr: true,
})
