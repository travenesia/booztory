import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http, fallback } from "wagmi"
import { base, baseSepolia, mainnet } from "wagmi/chains"

// Toggle this to switch between testnet and mainnet.
// Change to `APP_CHAIN = base` when deploying to production.
export const APP_CHAIN = baseSepolia

// NFT Pass collections are always read from Base Mainnet regardless of APP_CHAIN.
// At mainnet deployment this will equal APP_CHAIN.id automatically.
export const NFT_CHAIN_ID = base.id


const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

// Base Builder Code: bc_qaqhzzqp
// Appended to all transaction calldata for on-chain attribution
const DATA_SUFFIX = "0x62635f716171687a7a71700b0080218021802180218021802180218021" as `0x${string}`

export const wagmiConfig = getDefaultConfig({
  appName: "Booztory",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [APP_CHAIN, base, mainnet],
  transports: {
    [baseSepolia.id]: fallback([
      http(`https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`),
      http("https://sepolia.base.org"),
    ]),
    [base.id]: fallback([
      http(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`),
      http("https://mainnet.base.org"),
    ]),
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`),
  },
  ssr: true,
  dataSuffix: DATA_SUFFIX,
})
