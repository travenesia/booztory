"use client"

import { useEnsName } from "wagmi"
import { base, mainnet } from "wagmi/chains"
import { getAddress } from "viem"

// 5-minute stale time — prevents repeated RPC calls across re-renders and card lists
const ENS_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 2,
}

/**
 * Resolves a wallet address to its best display name.
 * Priority: Basename (.base.eth) → ENS (.eth) → truncated address
 *
 * Basename resolution works via the ENS universal resolver configured
 * on the base chain in lib/wagmi.ts.
 */
export function useWalletName(address?: string) {
  // Normalize to EIP-55 checksummed address; undefined for missing/invalid input
  let addr: `0x${string}` | undefined
  try {
    addr = address ? getAddress(address) : undefined
  } catch {
    addr = undefined
  }

  const { data: ensName } = useEnsName({
    address: addr,
    chainId: mainnet.id,
    query: { enabled: !!addr, ...ENS_QUERY_OPTIONS },
  })

  const { data: baseName } = useEnsName({
    address: addr,
    chainId: base.id,
    query: { enabled: !!addr, ...ENS_QUERY_OPTIONS },
  })

  if (!addr) return null
  const shortAddress = `${addr.slice(0, 6)}...${addr.slice(-4)}`
  return baseName || ensName || shortAddress
}
