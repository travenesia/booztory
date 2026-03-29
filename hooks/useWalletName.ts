"use client"

import { useQuery } from "@tanstack/react-query"
import { useEnsName } from "wagmi"
import { createPublicClient, http, toCoinType, getAddress } from "viem"
import { base, mainnet } from "viem/chains"

// 5-minute stale time — prevents repeated RPC calls across re-renders and card lists
const ENS_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 2,
}

// Mainnet client with private RPC — required for ENSIP-19 Basename resolution
// (computationally expensive; public RPCs often reject these calls)
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
  ),
})

/**
 * Resolves a wallet address to its best display name.
 * Priority: Basename (.base.eth) → ENS (.eth) → truncated address
 *
 * Basename uses ENSIP-19: getEnsName on mainnet with coinType = toCoinType(base.id)
 * as recommended by https://docs.base.org/base-account/framework-integrations/wagmi/basenames
 */
export function useWalletName(address?: string) {
  // Normalize to EIP-55 checksummed address; undefined for missing/invalid input
  let addr: `0x${string}` | undefined
  try {
    addr = address ? getAddress(address) : undefined
  } catch {
    addr = undefined
  }

  // Basename — ENSIP-19: mainnet ENS lookup with coinType for Base
  const { data: baseName } = useQuery({
    queryKey: ["basename", addr],
    queryFn: () =>
      mainnetClient.getEnsName({
        address: addr!,
        coinType: toCoinType(base.id),
      }),
    enabled: !!addr,
    ...ENS_QUERY_OPTIONS,
  })

  // ENS — standard mainnet reverse lookup
  const { data: ensName } = useEnsName({
    address: addr,
    chainId: mainnet.id,
    query: { enabled: !!addr, ...ENS_QUERY_OPTIONS },
  })

  if (!addr) return null
  const shortAddress = `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const strippedBase = baseName?.endsWith(".base.eth") ? baseName.slice(0, -".base.eth".length) : (baseName ?? null)
  const strippedEns = ensName?.endsWith(".eth") ? ensName.slice(0, -".eth".length) : (ensName ?? null)
  return strippedBase || strippedEns || shortAddress
}
