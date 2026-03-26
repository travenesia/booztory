"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useAccount, useReadContract } from "wagmi"
import { Copy, Check, ExternalLink } from "lucide-react"
import { HiBolt, HiCube, HiFire, HiStar, HiHeart, HiTrophy } from "react-icons/hi2"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { useWalletName } from "@/hooks/useWalletName"
import { APP_CHAIN } from "@/lib/wagmi"
import { cn } from "@/lib/utils"
import { ERC20_ABI, USDC_ADDRESS, TOKEN_ADDRESS } from "@/lib/contract"
import type { ProfileData, TxItem, TxType } from "@/app/api/profile/[address]/route"

// ── Constants ─────────────────────────────────────────────────────────────────
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

const basescanHost = (APP_CHAIN.id as number) === 8453 ? "basescan.org" : "sepolia.basescan.org"

function formatBooz(raw: string | undefined): string {
  if (!raw) return "0"
  const val = Number(BigInt(raw)) / 1e18
  return val.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function formatBoozBigint(raw: bigint | undefined): string {
  if (raw === undefined) return "—"
  return (Number(raw) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function formatUsdcBigint(raw: bigint | undefined): string {
  if (raw === undefined) return "—"
  const val = Number(raw) / 1_000_000
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatUsdc(raw: string | undefined): string {
  if (!raw) return "$0"
  const val = Number(BigInt(raw)) / 1_000_000
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPoints(raw: string | undefined): string {
  if (!raw) return "0"
  return Number(raw).toLocaleString("en-US")
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Tx type config ────────────────────────────────────────────────────────────
const TX_CONFIG: Record<TxType, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  mint:     { label: "Minted Slot",       color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    icon: HiCube   },
  gm:       { label: "Daily GM",          color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: HiFire  },
  points:   { label: "Points Earned",     color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  icon: HiBolt   },
  donated:  { label: "Donated",           color: "text-pink-700",   bg: "bg-pink-50 border-pink-200",    icon: HiHeart  },
  received: { label: "Donation Received", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: HiStar  },
  won:      { label: "Won Raffle",        color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: HiTrophy },
}

function txDescription(tx: TxItem): string {
  switch (tx.type) {
    case "mint":
      return tx.mintType === "free" ? "Free slot (BOOZ burn)" : tx.mintType === "discount" ? "Discount slot" : "Standard slot"
    case "gm":
      return `Streak day ${tx.streakCount}`
    case "points":
      return `+${formatPoints(tx.pointsAmount)} pts`
    case "donated":
      return `${formatUsdc(tx.usdcAmount)} → Token #${tx.tokenId && tx.tokenId !== "0" ? tx.tokenId : "—"}`
    case "received":
      return `${formatUsdc(tx.usdcAmount)} from Token #${tx.tokenId && tx.tokenId !== "0" ? tx.tokenId : "—"}`
    case "won":
      return `Raffle #${Number(tx.raffleId) + 1}`
  }
}

function txAmount(tx: TxItem): string | null {
  switch (tx.type) {
    case "mint":     return null
    case "gm":       return tx.boozAmount ? `+${formatBooz(tx.boozAmount)} $BOOZ` : null
    case "points":   return null
    case "donated":  return formatUsdc(tx.usdcAmount)
    case "received": return formatUsdc(tx.usdcAmount)
    case "won":      return formatUsdc(tx.usdcAmount)
  }
}

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = "activity" | "content" | "donations"

const TABS: { id: Tab; label: string }[] = [
  { id: "activity",  label: "Activity"  },
  { id: "content",   label: "Content"   },
  { id: "donations", label: "Donations" },
]

function filterTxs(txs: TxItem[], tab: Tab): TxItem[] {
  if (tab === "activity")  return txs
  if (tab === "content")   return txs.filter(t => t.type === "mint")
  if (tab === "donations") return txs.filter(t => t.type === "donated" || t.type === "received")
  return txs
}

// ── TxRow ─────────────────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: TxItem }) {
  const cfg = TX_CONFIG[tx.type]
  const Icon = cfg.icon
  const amount = txAmount(tx)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      {/* Type badge */}
      <div className={cn("flex items-center justify-center w-8 h-8 rounded-full border flex-shrink-0", cfg.bg)}>
        <Icon size={14} className={cfg.color} />
      </div>

      {/* Label + description */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className={cn("text-sm font-semibold leading-tight", cfg.color)}>{cfg.label}</span>
        <span className="text-xs text-gray-500 truncate">{txDescription(tx)}</span>
      </div>

      {/* Amount + time + link */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {amount && <span className="text-sm font-bold text-gray-800">{amount}</span>}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400">{timeAgo(tx.timestamp)}</span>
          <a
            href={`https://${basescanHost}/tx/${tx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-gray-500 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const rawAddress = params.address as string
  const address = rawAddress?.toLowerCase() as `0x${string}` | undefined

  const { address: connectedAddress } = useAccount()
  const isOwn = !!(connectedAddress && address && connectedAddress.toLowerCase() === address)

  const displayName = useWalletName(address)
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address },
  })

  const { data: boozBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address && TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000" },
  })

  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<Tab>("activity")
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${address}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as ProfileData
      setData(json)
    } catch (err) {
      setError("Failed to load profile")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const handleCopy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  const wallet = data?.wallet
  const txs = data?.transactions ?? []
  const filtered = filterTxs(txs, tab)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <main className="min-h-screen pt-12">
      <PageTopbar title={isOwn ? "My Profile" : "Profile"} />

      <section className="pt-4 pb-[80px] md:pb-[56px] px-4 max-w-[650px] mx-auto w-full">

        {/* ── Profile hero card ── */}
        <div
          className="relative rounded-2xl overflow-hidden text-white mb-4 shadow-sm"
          style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)" }}
        >
          {/* Radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(255,255,255,0.12) 0%, transparent 60%)" }}
          />

          {/* You badge — top right */}
          {isOwn && (
            <span className="absolute top-3 right-3 text-[10px] font-bold text-blue-100 bg-white/15 border border-white/25 rounded-full px-2.5 py-1">
              You
            </span>
          )}

          <div className="relative px-5 pt-5 pb-4">
            {/* Avatar + name + balances row */}
            <div className="flex items-center gap-4">
              <img
                src={address ? addressAvatar(address) : AVATARS[0]}
                alt="avatar"
                className="w-14 h-14 rounded-full border-2 border-white/30 shadow-md object-cover flex-shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-base font-black text-white truncate leading-tight">
                  {displayName || shortAddress}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 mb-2">
                  <span className="text-xs text-blue-200 font-mono">{shortAddress}</span>
                  <button
                    onClick={handleCopy}
                    className="text-blue-300 hover:text-white transition-colors p-0.5 rounded"
                    aria-label="Copy address"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                {/* USDC + BOOZ balances */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg px-2 py-1">
                    <img src="/usdc.svg" alt="USDC" width={13} height={13} className="opacity-90" />
                    <span className="text-[11px] font-bold text-white leading-none">{formatUsdcBigint(usdcBalance as bigint | undefined)}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg px-2 py-1">
                    <img src="/booz.svg" alt="BOOZ" width={13} height={13} className="opacity-90" />
                    <span className="text-[11px] font-bold text-white leading-none">{formatBoozBigint(boozBalance as bigint | undefined)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 border-t border-white/15">
            {[
              { label: "Slots",   value: loading ? null : String(wallet?.totalSlots ?? 0)         },
              { label: "Streak",  value: loading ? null : String(wallet?.bestStreak ?? 0)          },
              { label: "Points",  value: loading ? null : formatPoints(wallet?.totalPoints)        },
              { label: "Donated", value: loading ? null : formatUsdc(wallet?.totalDonated ?? "0") },
            ].map(({ label, value }, i) => (
              <div key={label} className={cn(
                "flex flex-col items-center py-3",
                i < 3 ? "border-r border-white/15" : ""
              )}>
                {value === null
                  ? <Skeleton className="h-5 w-10 mb-1 bg-white/20" />
                  : <span className="text-sm font-black text-white">{value}</span>
                }
                <span className="text-[10px] text-blue-200 uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs — leaderboard dark style ── */}
        <div className="flex gap-1.5 mb-3 rounded-lg p-1" style={{ background: "rgba(15,23,42,0.75)" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPage(0) }}
              className={cn(
                "flex-1 py-2 rounded-[5px] text-xs font-semibold transition-all duration-200",
                tab === t.id
                  ? "text-white shadow-sm"
                  : "text-white/50 hover:text-white/80"
              )}
              style={tab === t.id
                ? { background: "linear-gradient(135deg, #3b82f6, #2563eb)", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }
                : undefined
              }
            >
              {t.label}
              {t.id !== "activity" && data && (
                <span className={cn("ml-1 text-[11px]", tab === t.id ? "text-blue-200" : "text-white/30")}>
                  ({filterTxs(txs, t.id).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Transaction list ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24 bg-gray-100" />
                    <Skeleton className="h-3 w-36 bg-gray-100" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-4 w-16 bg-gray-100" />
                    <Skeleton className="h-3 w-10 bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-12 text-center px-4">
              <span className="text-2xl mb-2">⚠️</span>
              <p className="text-gray-500 text-sm">{error}</p>
              <button
                onClick={fetchProfile}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-4">
              <span className="text-3xl mb-2">📭</span>
              <p className="text-gray-500 text-sm">
                {tab === "activity" ? "No transactions yet" :
                 tab === "content"  ? "No slots minted yet" :
                                     "No donations yet"}
              </p>
            </div>
          ) : (
            <div>
              {paginated.map(tx => <TxRow key={`${tx.type}-${tx.id}`} tx={tx} />)}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3 px-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:hover:bg-transparent"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-400">
              Page {page + 1} of {totalPages} · {filtered.length} total
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:hover:bg-transparent"
            >
              Next →
            </button>
          </div>
        )}

        {/* Footer count when no pagination */}
        {!loading && wallet && filtered.length <= PAGE_SIZE && (
          <p className="text-center text-xs text-gray-400 mt-3">
            {txs.length} total transaction{txs.length !== 1 ? "s" : ""}
            {wallet.totalWins > 0 && ` · ${wallet.totalWins} raffle win${wallet.totalWins !== 1 ? "s" : ""}`}
          </p>
        )}
      </section>

      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 h-20 pointer-events-none z-40">
        <div className="relative h-full">
          <ProgressiveBlur height="100%" position="bottom" />
        </div>
      </div>

      <Navbar />
    </main>
  )
}
