"use client"

import { useAccount, useDisconnect } from "wagmi"
import { useReadContract } from "wagmi"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { MiniKit } from "@worldcoin/minikit-js"
import { isWorldApp } from "@/lib/miniapp-flag"
import { WORLD_BOOZTORY_ADDRESS, WORLD_USDC_ADDRESS, WORLD_TOKEN_ADDRESS, WORLD_BOOZTORY_ABI, WORLD_WLD_ADDRESS } from "@/lib/contractWorld"
import { WORLD_CHAIN } from "@/lib/wagmi"
import { Copy, Check, ExternalLink, Ticket, Loader2 } from "lucide-react"
import { WorldVerifiedBadge } from "@/components/world/WorldVerifiedBadge"
import { HiBolt, HiOutlinePower, HiCube, HiFire, HiStar, HiHeart, HiTrophy } from "react-icons/hi2"
import { RiExchangeFundsLine } from "react-icons/ri"
import Link from "next/link"
import { FaCoins, FaRankingStar } from "react-icons/fa6"
import { useIdentity } from "@/hooks/useIdentity"
import { ERC20_ABI, USDC_ADDRESS, TOKEN_ADDRESS, BOOZTORY_ADDRESS, BOOZTORY_ABI } from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"
import { cache } from "@/lib/cache"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { TxItem, TxType } from "@/app/api/profile/[address]/route"

// ── Address-based avatar ──────────────────────────────────────────────────────
const AVATARS = [
  ...Array.from({ length: 20 }, (_, i) => `/avatars/boy${i + 1}.webp`),
  ...Array.from({ length: 20 }, (_, i) => `/avatars/girl${i + 1}.webp`),
]

function addressAvatar(addr: string): string {
  if (!addr) return AVATARS[0]
  let hash = 0
  for (let i = 2; i < addr.length; i++) {
    hash = (addr.charCodeAt(i) + ((hash << 5) - hash)) | 0
  }
  return AVATARS[Math.abs(hash) % AVATARS.length]
}

// ── Transaction helpers ───────────────────────────────────────────────────────
const basescanHost = (APP_CHAIN.id as number) === 8453 ? "basescan.org" : "sepolia.basescan.org"

const TX_LABEL: Record<TxType, string> = {
  mint:     "Mint",
  gm:       "Daily GM",
  points:   "Points Earned",
  donated:  "Donated",
  received: "Donation Received",
  won:      "Won Raffle",
  tickets:  "Tickets Converted",
  entered:  "Entered Raffle",
}

const TX_COLORS: Record<TxType, string> = {
  mint:     "text-blue-500",
  gm:       "text-orange-500",
  points:   "text-amber-400",
  donated:  "text-pink-500",
  received: "text-purple-500",
  won:      "text-yellow-500",
  tickets:  "text-indigo-500",
  entered:  "text-teal-500",
}

const TX_ICONS: Record<TxType, React.ElementType> = {
  mint:     HiCube,
  gm:       HiFire,
  points:   HiBolt,
  donated:  HiHeart,
  received: HiStar,
  won:      HiTrophy,
  tickets:  RiExchangeFundsLine,
  entered:  Ticket,
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)    return `${diff}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

// ── Balance formatting helpers ────────────────────────────────────────────────
function formatWld(raw: bigint | undefined): string {
  if (raw === undefined) return "—"
  const val = Number(raw) / 1e18
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatUsdc(raw: bigint | undefined): string {
  if (raw === undefined) return "—"
  const val = Number(raw) / 1_000_000
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatBooz(raw: bigint | undefined): string {
  if (raw === undefined) return "—"
  const val = Number(raw) / 1e18
  return val.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

// ─────────────────────────────────────────────────────────────────────────────

export function WalletDropdownContent({ onClose }: { onClose?: () => void }) {
  const { address: wagmiAddress } = useAccount()
  const { disconnect, isPending: isDisconnecting } = useDisconnect()
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)
  const inWorldApp = isWorldApp()

  // In World App there is no injected wagmi provider — fall back to session address.
  const address = wagmiAddress ?? (session?.user?.walletAddress as `0x${string}` | undefined)

  // MiniKit.user.username / profilePictureUrl are populated after walletAuth().
  const miniKitUsername   = inWorldApp ? (MiniKit.user?.username           ?? undefined) : undefined
  const miniKitAvatarUrl  = inWorldApp ? (MiniKit.user?.profilePictureUrl  ?? undefined) : undefined

  const identity = useIdentity(address)
  const { avatarUrl: identityAvatar, displayName: identityName } = identity
  const avatarUrl   = miniKitAvatarUrl || identityAvatar
  const displayName = miniKitUsername || identityName || session?.user?.username || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "")
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""

  // ── Balances — World App reads from World Chain, Base reads from Base ─────────
  const { data: usdcBalance } = useReadContract({
    address: inWorldApp ? WORLD_USDC_ADDRESS : USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: inWorldApp ? WORLD_CHAIN.id : APP_CHAIN.id,
    query: { enabled: !!address },
  })

  const { data: wldBalance } = useReadContract({
    address: WORLD_WLD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: WORLD_CHAIN.id,
    query: { enabled: !!address && inWorldApp },
  })

  const { data: boozBalance } = useReadContract({
    address: inWorldApp ? WORLD_TOKEN_ADDRESS : TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: inWorldApp ? WORLD_CHAIN.id : APP_CHAIN.id,
    query: {
      enabled: !!address && (inWorldApp
        ? WORLD_TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000"
        : TOKEN_ADDRESS       !== "0x0000000000000000000000000000000000000000"),
    },
  })

  const { data: pointsBalance } = useReadContract({
    address: inWorldApp ? WORLD_BOOZTORY_ADDRESS : BOOZTORY_ADDRESS,
    abi: inWorldApp ? WORLD_BOOZTORY_ABI : BOOZTORY_ABI,
    functionName: "points",
    args: address ? [address] : undefined,
    chainId: inWorldApp ? WORLD_CHAIN.id : APP_CHAIN.id,
    query: { enabled: !!address },
  })

  // Recent transactions — fetch from subgraph (Base or World Chain)
  const [recentTxs, setRecentTxs] = useState<TxItem[]>([])
  const [txsLoading, setTxsLoading] = useState(false)

  useEffect(() => {
    if (!address) return
    setTxsLoading(true)
    // Call isWorldApp() fresh inside the effect — not from the render-time closure.
    // Child useEffects run before parent (MiniKitClientProvider) useEffects, so
    // capturing inWorldApp from the render scope could be stale on first mount.
    const isWorld = isWorldApp()
    const url = isWorld
      ? `/api/profile/${address.toLowerCase()}?chain=world`
      : `/api/profile/${address.toLowerCase()}`
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then((d: { transactions?: TxItem[] } | null) => {
        setRecentTxs(d?.transactions?.slice(0, 5) ?? [])
      })
      .catch(() => setRecentTxs([]))
      .finally(() => setTxsLoading(false))
  }, [address])

  const handleCopy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDisconnect = async () => {
    cache.clear("user_profile")
    await signOut({ redirect: false })
    if (!inWorldApp) disconnect() // no wagmi session in World App
    onClose?.()
  }

  if (!address) return null

  return (
    <div className="flex flex-col w-full">
      {/* ── Profile ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <img
          src={avatarUrl || addressAvatar(address ?? "")}
          alt="avatar"
          className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
        />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 truncate">
            {inWorldApp && <WorldVerifiedBadge verified={identity.isWorldVerified} />}
            {displayName}
          </span>
          {!inWorldApp && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-gray-500 font-mono">{shortAddress}</span>
            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded"
              aria-label="Copy address"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          )}
        </div>
        <Link href="/reward" onClick={onClose} title="Points" className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-full px-2 py-1 hover:bg-orange-100 transition-colors">
          <FaCoins className="text-orange-500 flex-shrink-0" size={11} />
          <span className="text-xs font-black text-orange-900 leading-none">{pointsBalance !== undefined ? Number(pointsBalance).toLocaleString() : "—"}</span>
        </Link>
        <Link href="/leaderboard" onClick={onClose} title="Leaderboard">
          <FaRankingStar className="w-5 h-5 text-amber-500 hover:text-amber-600 transition-colors" />
        </Link>
      </div>

      <div className="mx-4 border-t border-gray-200" />

      {/* ── Balances ── */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        {/* WLD — World App only */}
        {inWorldApp && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-3 md:py-2.5">
            <img src="/world.svg" alt="WLD" width={22} height={22} className="flex-shrink-0 md:w-5 md:h-5" />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide leading-none mb-0.5">$WLD</span>
              <span className="text-sm md:text-xs font-black text-gray-900 leading-tight truncate">{formatWld(wldBalance as bigint | undefined)}</span>
            </div>
          </div>
        )}
        {/* USDC */}
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-3 md:py-2.5">
          <img src="/usdc.svg" alt="USDC" width={22} height={22} className="flex-shrink-0 md:w-5 md:h-5" />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-semibold text-blue-600 uppercase tracking-wide leading-none mb-0.5">$USDC</span>
            <span className="text-sm md:text-xs font-black text-blue-900 leading-tight truncate">{formatUsdc(usdcBalance as bigint | undefined)}</span>
          </div>
        </div>
        {/* BOOZ */}
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-2.5 py-3 md:py-2.5">
          <img src="/booz.svg" alt="BOOZ" width={22} height={22} className="flex-shrink-0 md:w-5 md:h-5" />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-semibold text-[#E63946] uppercase tracking-wide leading-none mb-0.5">$BOOZ</span>
            <span className="text-sm md:text-xs font-black text-red-900 leading-tight truncate">{formatBooz(boozBalance as bigint | undefined)}</span>
          </div>
        </div>
        {/* Points — Base only */}
        {!inWorldApp && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-2.5 py-3 md:py-2.5">
            <FaCoins className="text-orange-500 flex-shrink-0" size={20} />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-semibold text-orange-600 uppercase tracking-wide leading-none mb-0.5">Points</span>
              <span className="text-sm md:text-xs font-black text-orange-900 leading-tight truncate">{pointsBalance !== undefined ? Number(pointsBalance).toLocaleString() : "—"}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mx-4 border-t border-gray-200" />

      {/* ── Recent Transactions ── */}
      <>
          <div className="px-4 pt-3 pb-2">
            <span className="text-xs font-bold text-gray-700">Recent activity</span>

            <div className="mt-2">
              {txsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0" />
                      <Skeleton className="flex-1 h-3.5 bg-gray-100" />
                      <Skeleton className="w-8 h-3 bg-gray-100" />
                    </div>
                  ))}
                </div>
              ) : recentTxs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No transactions yet</p>
              ) : (
                <div className="space-y-1">
                  {recentTxs.map(tx => {
                    const Icon = TX_ICONS[tx.type]
                    const explorerHost = inWorldApp ? "worldscan.org" : basescanHost
                    return (
                      <div key={tx.id} className="flex items-center gap-2 py-1">
                        <Icon size={12} className={cn("flex-shrink-0", TX_COLORS[tx.type])} />
                        <span className="flex-1 text-xs text-gray-700 truncate">{TX_LABEL[tx.type]}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(tx.timestamp)}</span>
                        <a
                          href={`https://${explorerHost}/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Link
              href={`/profile/${address?.toLowerCase()}`}
              onClick={onClose}
              className="block w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 mt-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              View All Transactions
            </Link>
          </div>

          <div className="mx-4 border-t border-gray-200" />
      </>

      {/* ── Disconnect ── */}
      <div className="px-4 py-3">
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDisconnecting
            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Disconnecting...</span></>
            : <><HiOutlinePower className="w-4 h-4" /><span>Disconnect</span></>
          }
        </button>
      </div>
    </div>
  )
}
