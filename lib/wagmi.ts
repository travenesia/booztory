import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http, fallback } from "wagmi"
import { getConnectorClient } from "wagmi/actions"
import { base } from "wagmi/chains"
import { Attribution } from "ox/erc8021"
import { encodeFunctionData, type Abi } from "viem"

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
// BATCH SEND WITH ATTRIBUTION
// ==============================
// writeContractsAsync (wagmi experimental) doesn't support dataSuffix.
// This helper encodes each call manually, appends the attribution suffix,
// then sends via wallet_sendCalls directly on the active connector's transport.
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
  const client = await getConnectorClient(wagmiConfig)
  const suffix = DATA_SUFFIX_PARAM.dataSuffix.slice(2) // strip 0x — appended raw

  const encoded = calls.map(({ address, abi, functionName, args, value }) => ({
    to: address,
    data: (encodeFunctionData({ abi: abi as Abi, functionName, args: args ?? [] }) + suffix) as `0x${string}`,
    ...(value != null ? { value: `0x${value.toString(16)}` as `0x${string}` } : {}),
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callsId = await (client as any).request({
    method: "wallet_sendCalls",
    params: [{ version: "2.0.0", calls: encoded, capabilities: { paymasterService: { url: paymasterUrl } } }],
  })

  return callsId as string
}

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
