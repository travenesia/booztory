import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { createAppKit } from "@reown/appkit/react"
import type { AppKitNetwork } from "@reown/appkit/networks"
import { http, fallback } from "wagmi"
import { base as baseChain, baseSepolia, mainnet } from "wagmi/chains"

// Toggle this to switch between testnet and mainnet.
// Change to `APP_CHAIN = base` when deploying to production.
export const APP_CHAIN = baseSepolia

// Extend base chain with ENS universal resolver so wagmi can resolve Basenames
const base = {
  ...baseChain,
  contracts: {
    ...baseChain.contracts,
    ensUniversalResolver: {
      address: "0xC6d566A56A1aFf6508b41f6c90ff131615583C07" as `0x${string}`,
    },
  },
} as const

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

const networks = [APP_CHAIN, base, mainnet] as [AppKitNetwork, ...AppKitNetwork[]]

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  transports: {
    [baseSepolia.id]: fallback([
      http(`https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`),
      http("https://sepolia.base.org"),
    ]),
    [baseChain.id]: fallback([
      http(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`),
      http("https://mainnet.base.org"),
    ]),
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`),
  },
  ssr: true,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  defaultNetwork: APP_CHAIN,
  features: {
    analytics: false,
    email: false,
    socials: [],
    emailShowWallets: false,
  },
  themeMode: "light",
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
