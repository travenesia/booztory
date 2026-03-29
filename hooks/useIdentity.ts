"use client"

import { useQuery } from "@tanstack/react-query"
import { useEnsName, useAccount } from "wagmi"
import { createPublicClient, http, toCoinType, getAddress } from "viem"
import { base, mainnet } from "viem/chains"
import { sdk } from "@farcaster/miniapp-sdk"
import { isMiniApp } from "@/lib/miniapp-flag"

const Q = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, retry: 2 }

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
  ),
})

function strip(name: string | null | undefined, suffix: string): string | null {
  if (!name) return null
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name
}

export interface Identity {
  /** Farcaster username (mini app only) → stripped basename → stripped ens → truncated address */
  displayName: string
  /** Wallet-only: stripped basename → stripped ens → truncated address (no Farcaster) */
  walletName: string
  /** Best available avatar: Farcaster pfp → basename avatar → ens avatar → null */
  avatarUrl: string | null
  /** Farcaster username — only set for connected address inside mini app */
  farcasterUsername: string | null
  /** Full .base.eth name */
  baseName: string | null
  /** Full .eth name */
  ensName: string | null
}

/**
 * Resolves a wallet address to its full identity: name + avatar.
 *
 * In Farcaster / Base mini app (for the connected address only):
 *   Farcaster username / pfp → Basename → ENS → truncated address
 *
 * In regular browser / desktop:
 *   Basename → ENS → truncated address
 *
 * Safe after Base App migration (April 9 2026): Farcaster data is gated
 * behind isMiniApp() + isOwn, so when the SDK is no longer available the
 * code path simply never activates and the hook falls through to Basename/ENS.
 */
export function useIdentity(address?: string): Identity {
  const { address: connectedAddress } = useAccount()

  let addr: `0x${string}` | undefined
  try {
    addr = address ? getAddress(address) : undefined
  } catch {
    addr = undefined
  }

  const isOwn =
    !!(addr && connectedAddress && addr.toLowerCase() === connectedAddress.toLowerCase())

  // ── Farcaster (mini app + connected address only) ────────────────────────────
  const { data: farcasterCtx } = useQuery({
    queryKey: ["farcaster-ctx"],
    queryFn: () => sdk.context,
    enabled: isOwn && isMiniApp(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })

  // ── Basename (ENSIP-19) ──────────────────────────────────────────────────────
  const { data: baseName } = useQuery({
    queryKey: ["basename", addr],
    queryFn: () =>
      mainnetClient.getEnsName({ address: addr!, coinType: toCoinType(base.id) }),
    enabled: !!addr,
    ...Q,
  })

  const { data: baseAvatar } = useQuery({
    queryKey: ["basename-avatar", baseName],
    queryFn: () => mainnetClient.getEnsAvatar({ name: baseName! }),
    enabled: !!baseName,
    ...Q,
  })

  // ── ENS ──────────────────────────────────────────────────────────────────────
  const { data: ensName } = useEnsName({
    address: addr,
    chainId: mainnet.id,
    query: { enabled: !!addr, ...Q },
  })

  const { data: ensAvatar } = useQuery({
    queryKey: ["ens-avatar", ensName],
    queryFn: () => mainnetClient.getEnsAvatar({ name: ensName! }),
    enabled: !!ensName,
    ...Q,
  })

  // ── Compose ──────────────────────────────────────────────────────────────────
  const shortAddr = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ""
  const strippedBase = strip(baseName, ".base.eth")
  const strippedEns = strip(ensName ?? null, ".eth")
  const farcasterUsername = farcasterCtx?.user?.username ?? null
  const farcasterPfp = farcasterCtx?.user?.pfpUrl ?? null

  return {
    displayName: farcasterUsername || strippedBase || strippedEns || shortAddr,
    walletName: strippedBase || strippedEns || shortAddr,
    avatarUrl: farcasterPfp || baseAvatar || ensAvatar || null,
    farcasterUsername,
    baseName: baseName ?? null,
    ensName: ensName ?? null,
  }
}
