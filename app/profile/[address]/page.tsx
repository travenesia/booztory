"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useAccount, useReadContract } from "wagmi"
import { Copy, Check, ExternalLink, Ticket } from "lucide-react"
import { HiBolt, HiCube, HiFire, HiTrophy } from "react-icons/hi2"
import { RiExchangeFundsLine } from "react-icons/ri"
import { FaDonate } from "react-icons/fa"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { useIdentity } from "@/hooks/useIdentity"
import { useWalletName } from "@/hooks/useWalletName"
import { APP_CHAIN } from "@/lib/wagmi"
import { cn } from "@/lib/utils"
import { ERC20_ABI, USDC_ADDRESS, TOKEN_ADDRESS, BOOZTORY_ADDRESS, BOOZTORY_ABI } from "@/lib/contract"
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
  if (!raw) return "$0.00"
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
const MINT_TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  free:     { color: "text-green-700", bg: "bg-green-50 border-green-200" },
  discount: { color: "text-red-700",   bg: "bg-red-50 border-red-200"     },
}

const TX_CONFIG: Record<TxType, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  mint:     { label: "Mint",       color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",     icon: HiCube              },
  gm:       { label: "Daily GM",          color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",  icon: HiFire              },
  points:   { label: "Points Earned",     color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",    icon: HiBolt              },
  donated:  { label: "Donated",           color: "text-red-700",     bg: "bg-red-50 border-red-200",        icon: FaDonate            },
  received: { label: "Donation Received", color: "text-green-700",   bg: "bg-green-50 border-green-200",    icon: FaDonate            },
  won:      { label: "Won Raffle",        color: "text-green-700",   bg: "bg-green-50 border-green-200",    icon: HiTrophy            },
  tickets:  { label: "Tickets Converted", color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200",  icon: RiExchangeFundsLine },
  entered:  { label: "Entered Raffle",    color: "text-teal-700",    bg: "bg-teal-50 border-teal-200",      icon: Ticket              },
}

// ── Row description ───────────────────────────────────────────────────────────
function txDescription(tx: TxItem): React.ReactNode {
  const tokenStr = tx.tokenId && tx.tokenId !== "0" ? ` #${tx.tokenId}` : ""

  switch (tx.type) {
    case "mint": {
      if (tx.mintType === "discount") return `Discount Mint${tokenStr}`
      if (tx.mintType === "free")     return `Free Mint${tokenStr}`
      return `Normal Mint${tokenStr}`
    }
    case "gm":
      return `Day ${tx.streakCount}`
    case "points":
      return "Points earned"
    case "donated":
    case "received":
      return null  // handled by DonationDesc in TxRow
    case "won":
      return `Raffle #${Number(tx.raffleId) + 1}`
    case "tickets":
      return "Points → Tickets"
    case "entered": {
      const raffleNum = tx.raffleId !== undefined ? `#${Number(tx.raffleId) + 1}` : ""
      const tickets = tx.ticketAmount ?? "?"
      const statusLabel = tx.wonAmount
        ? <span className="ml-1.5 text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 rounded-full px-1.5 py-0.5">Won</span>
        : tx.raffleDrawn
        ? <span className="ml-1 text-xs font-semibold text-red-500">Lost</span>
        : null
      return (
        <span className="flex items-center flex-wrap gap-0">
          Raffle {raffleNum} · {tickets} ticket{Number(tickets) !== 1 ? "s" : ""}
          {statusLabel}
        </span>
      )
    }
  }
}

// ── Row amounts (multi-line, colored) ─────────────────────────────────────────
interface AmountLine { text: string; positive: boolean | "live" }

function txAmounts(tx: TxItem): AmountLine[] {
  const lines: AmountLine[] = []
  const pts = tx.pointsAmount

  switch (tx.type) {
    case "mint":
      if (tx.mintType === "free") {
        lines.push({ text: "-10,000 $BOOZ", positive: false })
      } else if (tx.mintType === "discount") {
        lines.push({ text: "-0.9 USDC", positive: false })
        // net BOOZ = 0 (burn 1000, earn 1000) — omit
      } else {
        lines.push({ text: "-1 USDC", positive: false })
        lines.push({ text: "+1,000 $BOOZ", positive: true })
      }
      if (pts) lines.push({ text: `+${formatPoints(pts)} pts`, positive: true })
      break
    case "gm":
      if (tx.boozAmount) lines.push({ text: `+${formatBooz(tx.boozAmount)} $BOOZ`, positive: true })
      if (pts) lines.push({ text: `+${formatPoints(pts)} pts`, positive: true })
      break
    case "points":
      if (pts) lines.push({ text: `+${formatPoints(pts)} pts`, positive: true })
      break
    case "donated":
      if (tx.usdcAmount) lines.push({ text: `-${formatUsdc(tx.usdcAmount)}`, positive: false })
      if (pts) lines.push({ text: `+${formatPoints(pts)} pts`, positive: true })
      break
    case "received":
      if (tx.usdcAmount) lines.push({ text: `+${formatUsdc(tx.usdcAmount)}`, positive: true })
      break
    case "won":
      if (tx.usdcAmount) lines.push({ text: `+${formatUsdc(tx.usdcAmount)}`, positive: true })
      break
    case "tickets":
      if (tx.pointsBurned) lines.push({ text: `-${formatPoints(tx.pointsBurned)} pts`, positive: false })
      if (tx.ticketsMinted) lines.push({ text: `+${tx.ticketsMinted} tickets`, positive: true })
      break
    case "entered":
      if (tx.wonAmount) {
        lines.push({ text: `+${formatUsdc(tx.wonAmount)}`, positive: true })
      } else if (tx.raffleDrawn) {
        const t = tx.ticketAmount ?? "?"
        lines.push({ text: `-${t} ticket${Number(t) !== 1 ? "s" : ""}`, positive: false })
      } else {
        const nowSec = Math.floor(Date.now() / 1000)
        const isLive = tx.raffleEndTime !== undefined && tx.raffleEndTime > nowSec
        lines.push(isLive
          ? { text: "● Live", positive: "live" }
          : { text: "Awaiting Draw", positive: "live" }
        )
      }
      break
  }

  return lines
}

// ── Tab config ────────────────────────────────────────────────────────────────
type Tab = "activity" | "content" | "donations" | "raffle"

const TABS: { id: Tab; label: string }[] = [
  { id: "activity",  label: "Activity"  },
  { id: "content",   label: "Mint"      },
  { id: "donations", label: "Donate"    },
  { id: "raffle",    label: "Raffle"    },
]

function filterTxs(txs: TxItem[], tab: Tab): TxItem[] {
  switch (tab) {
    case "activity":  return txs
    case "content":   return txs.filter(t => t.type === "mint")
    case "donations": return txs.filter(t => t.type === "donated" || t.type === "received")
    case "raffle":    return txs.filter(t => t.type === "tickets" || t.type === "entered")
  }
}

const EMPTY_MSG: Record<Tab, string> = {
  activity:  "No transactions yet",
  content:   "No slots minted yet",
  donations: "No donations yet",
  raffle:    "No raffle activity yet",
}

// ── Donation description (resolves counterparty address) ──────────────────────
function DonationDesc({ tx, connectedAddress }: { tx: TxItem; connectedAddress?: string }) {
  const resolved = useWalletName(tx.counterparty as `0x${string}` | undefined)
  const isYou = !!(connectedAddress && tx.counterparty && connectedAddress.toLowerCase() === tx.counterparty.toLowerCase())
  const short = tx.counterparty
    ? `${tx.counterparty.slice(0, 6)}...${tx.counterparty.slice(-4)}`
    : "—"
  const display = isYou ? "you" : (resolved || short)
  const prefix = tx.type === "donated" ? "to" : "from"
  return (
    <span className="text-xs text-gray-500 truncate">
      {prefix} <span className={isYou ? "font-semibold text-blue-600" : "font-mono font-semibold"}>{display}</span>
    </span>
  )
}

// ── TxRow ─────────────────────────────────────────────────────────────────────
function TxRow({ tx, connectedAddress }: { tx: TxItem; connectedAddress?: string }) {
  const base = TX_CONFIG[tx.type]
  const mintOverride = tx.type === "mint" && tx.mintType ? MINT_TYPE_CONFIG[tx.mintType] : undefined
  const cfg = mintOverride ? { ...base, ...mintOverride } : base
  const Icon = cfg.icon
  const amounts = txAmounts(tx)

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <div className={cn("flex items-center justify-center w-8 h-8 rounded-full border flex-shrink-0 mt-0.5", cfg.bg)}>
        <Icon size={14} className={cfg.color} />
      </div>

      <div className="flex flex-col min-w-0 flex-1 gap-1">
        <span className={cn("text-sm font-semibold leading-tight", cfg.color)}>{cfg.label}</span>
        {(tx.type === "donated" || tx.type === "received")
          ? <DonationDesc tx={tx} connectedAddress={connectedAddress} />
          : <span className="text-xs text-gray-500 truncate">{txDescription(tx)}</span>
        }
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-sm font-semibold leading-tight">
          {amounts.map((a, i) => (
            <span key={i}>
              {i > 0 && <span className="text-gray-400 font-normal">, </span>}
              <span className={a.positive === "live" ? "text-green-500" : a.positive ? "text-green-600" : "text-red-500"}>{a.text}</span>
            </span>
          ))}
        </span>
        <div className="flex items-center gap-1">
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
  useRouter()
  const rawAddress = params.address as string
  const address = rawAddress?.toLowerCase() as `0x${string}` | undefined

  const { address: connectedAddress } = useAccount()
  const isOwn = !!(connectedAddress && address && connectedAddress.toLowerCase() === address)

  const identity = useIdentity(address)
  const displayName = identity.walletName  // basename/ens only — no Farcaster on profile
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

  const { data: pointsOnChain } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "points",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address },
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
    <main className="h-screen flex flex-col overflow-hidden">
      <PageTopbar title={isOwn ? "My Profile" : "Profile"} />

      <div className="flex-1 overflow-hidden flex justify-center pt-12">
      <section className="flex flex-col w-full max-w-[650px] overflow-hidden pt-4 px-4">

        {/* ── Profile hero card ── */}
        <div
          className="relative rounded-2xl overflow-hidden text-white mb-4 shadow-sm"
          style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(255,255,255,0.12) 0%, transparent 60%)" }}
          />

          {isOwn && (
            <span className="absolute top-3 right-3 text-[10px] font-bold text-blue-100 bg-white/15 border border-white/25 rounded-full px-2.5 py-1">
              You
            </span>
          )}

          <div className="relative px-5 pt-5 pb-4">
            <div className="flex items-center gap-4">
              <img
                src={identity.avatarUrl || (address ? addressAvatar(address) : AVATARS[0])}
                alt="avatar"
                className="w-16 h-16 rounded-full border-2 border-white/30 shadow-md object-cover flex-shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-base md:text-lg font-black text-white truncate leading-tight">
                  {displayName || shortAddress}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 mb-2">
                  <span className="text-xs md:text-sm text-blue-200 font-mono">{shortAddress}</span>
                  <button
                    onClick={handleCopy}
                    className="text-blue-300 hover:text-white transition-colors p-0.5 rounded"
                    aria-label="Copy address"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg px-2 py-1">
                    <img src="/usdc.svg" alt="USDC" width={13} height={13} className="opacity-90" />
                    <span className="text-[11px] md:text-sm font-bold text-white leading-none">{formatUsdcBigint(usdcBalance as bigint | undefined)}</span>
                    <span className="text-[9px] md:text-xs font-semibold text-blue-200 leading-none">$USDC</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg px-2 py-1">
                    <img src="/booz.svg" alt="BOOZ" width={13} height={13} className="opacity-90" />
                    <span className="text-[11px] md:text-sm font-bold text-white leading-none">{formatBoozBigint(boozBalance as bigint | undefined)}</span>
                    <span className="text-[9px] md:text-xs font-semibold text-blue-200 leading-none">$BOOZ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 border-t border-white/15">
            {[
              { label: "Mints",    value: loading ? null : String(txs.filter(t => t.type === "mint").length) },
              { label: "Streak",   value: loading ? null : String(wallet?.bestStreak ?? 0)                   },
              { label: "Points",   value: pointsOnChain !== undefined ? formatPoints(String(pointsOnChain)) : loading ? null : "0" },
              { label: "Donated",  value: loading ? null : formatUsdc(wallet?.totalDonated ?? "0")           },
              { label: "Gift",     value: loading ? null : formatUsdc(wallet?.totalReceived ?? "0")          },
            ].map(({ label, value }, i) => (
              <div key={label} className={cn(
                "flex flex-col items-center gap-1 py-3",
                i < 4 ? "border-r border-white/15" : ""
              )}>
                {value === null
                  ? <Skeleton className="h-5 w-10 mb-1 bg-white/20" />
                  : <span className="text-xs md:text-sm font-black text-white">{value}</span>
                }
                <span className="text-[9px] md:text-[11px] text-blue-200 uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          {TABS.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && tab !== t.id && tab !== TABS[i - 1].id && (
                <div className="w-px my-1.5 bg-gray-300 flex-shrink-0" />
              )}
              <button
                onClick={() => { setTab(t.id); setPage(0) }}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                  tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* ── Transaction list (scrollable) ── */}
        <div className="no-scrollbar flex-1 min-h-0 overflow-y-auto pb-[80px] md:pb-[56px]" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
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
              <button onClick={fetchProfile} className="mt-3 text-sm text-blue-600 hover:underline">
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-4">
              <span className="text-3xl mb-2">📭</span>
              <p className="text-gray-500 text-sm">{EMPTY_MSG[tab]}</p>
            </div>
          ) : (
            <div>
              {paginated.map(tx => <TxRow key={`${tx.type}-${tx.id}`} tx={tx} connectedAddress={connectedAddress} />)}
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

        {!loading && wallet && filtered.length <= PAGE_SIZE && (
          <p className="text-center text-xs text-gray-400 mt-3">
            {txs.length} total transaction{txs.length !== 1 ? "s" : ""}
            {wallet.totalWins > 0 && ` · ${wallet.totalWins} raffle win${wallet.totalWins !== 1 ? "s" : ""}`}
          </p>
        )}
        </div>{/* end scrollable */}
      </section>
      </div>{/* end flex justify-center */}

      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 h-20 pointer-events-none z-40">
        <div className="relative h-full">
          <ProgressiveBlur height="100%" position="bottom" />
        </div>
      </div>

      <Navbar />
    </main>
  )
}
