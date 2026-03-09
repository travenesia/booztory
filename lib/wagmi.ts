import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { base, baseSepolia, mainnet } from "wagmi/chains"

// Toggle this to switch between testnet and mainnet.
// Change to `base` when deploying to production.
export const APP_CHAIN = baseSepolia

export const wagmiConfig = getDefaultConfig({
  appName: "Booztory",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [APP_CHAIN, base, mainnet],
  ssr: true,
})
