import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import {
  baseAccount,
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { http, fallback } from "wagmi"
import { sendCalls } from "wagmi/actions"
import { base } from "wagmi/chains"
import { Attribution } from "ox/erc8021"
import type { Abi } from "viem"

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
// BATCH SEND (PAYMASTER PATH)
// ==============================
// Uses wagmi/actions sendCalls — the correct abstraction over EIP-5792 wallet_sendCalls.
// CDP paymaster attribution is tracked at the project/API key level, not in calldata.
export type BatchCall = {
  address: `0x${string}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: Abi | readonly any[]
  functionName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: readonly any[]
  value?: bigint
}

export async function sendBatchWithAttribution(calls: BatchCall[], paymasterUrl: string): Promise<string> {
  const id = await sendCalls(wagmiConfig, {
    calls: calls.map(({ address, abi, functionName, args, value }) => ({
      to: address,
      abi: abi as Abi,
      functionName,
      args: args ?? [],
      ...(value != null ? { value } : {}),
    })),
    capabilities: {
      paymasterService: { url: paymasterUrl },
    },
  })
  return id
}

// ==============================
// WAGMI CONFIG
// ==============================
export const wagmiConfig = getDefaultConfig({
  appName: "Booztory",
  projectId,

  // Explicit wallet list — default only includes baseAccount (smart wallet).
  // Adding coinbaseWallet shows the EOA browser extension option alongside it.
  wallets: [
    {
      groupName: "Popular",
      wallets: [safeWallet, rainbowWallet, coinbaseWallet, baseAccount, metaMaskWallet, walletConnectWallet],
    },
  ],

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
