"use client"

import { useQuery } from "@tanstack/react-query"
import { useEnsName, useAccount } from "wagmi"
import { createPublicClient, http, toCoinType, getAddress } from "viem"
import { base, mainnet } from "viem/chains"
import { sdk } from "@farcaster/miniapp-sdk"
import { MiniKit } from "@worldcoin/minikit-js"
import { isMiniApp, isWorldApp } from "@/lib/miniapp-flag"

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
  /** World ID orb verification: true = orb verified (own address in World App), or has World username (others) */
  isWorldVerified: boolean
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

  // ── World ID (World App — any address) ───────────────────────────────────────
  const inWorldApp = isWorldApp()
  const { data: worldUser } = useQuery({
    queryKey: ["world-user", addr],
    queryFn: async () => {
      // For own address, MiniKit.user is already populated after wallet auth
      if (isOwn && MiniKit.user?.username) return MiniKit.user
      return MiniKit.getUserByAddress(addr!)
    },
    enabled: !!addr && inWorldApp,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
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
  // Guard: only use cached Farcaster data for the connected address.
  // The query key ["farcaster-ctx"] is global — React Query returns cached data
  // even when the query is disabled, which would leak the connected user's
  // identity to every other address (e.g. leaderboard rows).
  const farcasterUsername = isOwn ? (farcasterCtx?.user?.username ?? null) : null
  const farcasterPfp = isOwn ? (farcasterCtx?.user?.pfpUrl ?? null) : null

  // World ID identity — available for any address in World App
  const worldUsername = worldUser?.username ?? null
  const worldAvatarUrl = worldUser?.profilePictureUrl ?? null

  // World ID orb verification:
  // - Own address in World App: use MiniKit.user.verificationStatus.isOrbVerified
  // - Other addresses: use presence of worldUsername as proxy (has World ID account)
  const isWorldVerified = inWorldApp
    ? (isOwn
        ? !!(MiniKit.user?.verificationStatus?.isOrbVerified)
        : !!worldUsername)
    : false

  return {
    displayName: worldUsername || farcasterUsername || strippedBase || strippedEns || shortAddr,
    walletName: worldUsername || strippedBase || strippedEns || shortAddr,
    avatarUrl: worldAvatarUrl || farcasterPfp || baseAvatar || ensAvatar || null,
    farcasterUsername,
    baseName: baseName ?? null,
    ensName: ensName ?? null,
    isWorldVerified,
  }
}
