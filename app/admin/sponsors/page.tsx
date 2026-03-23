"use client"

import { useState } from "react"
import { useReadContract, useReadContracts, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig, APP_CHAIN } from "@/lib/wagmi"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useWalletName } from "@/hooks/useWalletName"
import { usePriceTiers } from "@/hooks/usePriceTiers"
import { RAFFLE_ADDRESS, RAFFLE_ABI } from "@/lib/contract"

// ── Types ──────────────────────────────────────────────────────────────────────

type AppStatus = 0 | 1 | 2 | 3
type AdTypeId  = "image" | "embed" | "text"

const APP_STATUS_MAP: Record<AppStatus, { label: string; color: string }> = {
  0: { label: "Pending",  color: "text-amber-700 bg-amber-50 border-amber-200"  },
  1: { label: "Accepted", color: "text-green-700 bg-green-50 border-green-200"  },
  2: { label: "Rejected", color: "text-red-700 bg-red-50 border-red-200"        },
  3: { label: "Refunded", color: "text-gray-600 bg-gray-50 border-gray-200"     },
}

const LINK_ICONS = [
  { key: "website",  icon: "/social/web.svg",      label: "Website"  },
  { key: "x",        icon: "/social/x.svg",        label: "X"        },
  { key: "discord",  icon: "/social/discord.svg",  label: "Discord"  },
  { key: "telegram", icon: "/social/telegram.svg", label: "Telegram" },
] as const

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseAdContent(raw: string): Record<string, string> {
  try {
    const p = JSON.parse(raw)
    if (typeof p === "object" && p !== null) return p
  } catch { /* fallback */ }
  return {}
}

function parseAdLink(raw: string): Record<string, string> {
  try {
    const p = JSON.parse(raw)
    if (typeof p === "object" && p !== null) return p
  } catch { /* fallback */ }
  return raw ? { website: raw } : {}
}

function renderFormattedText(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

// ── ApplicationRow ─────────────────────────────────────────────────────────────

function ApplicationRow({ appId, onAction }: { appId: number; onAction: () => void }) {
  const [isActing, setIsActing] = useState(false)
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const { data: appRaw, refetch } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
    functionName: "applications", args: [BigInt(appId)],
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 30_000, refetchOnWindowFocus: true },
  })

  const app = appRaw as readonly [string, string, string, string, bigint, bigint, bigint, bigint, bigint, number] | undefined

  const sponsor = app?.[0] ?? ""
  const sponsorName = useWalletName(sponsor || undefined)

  if (!app) return null

  const [, adTypeRaw, adContent, adLinkRaw, duration, prizePaid, feePaid, submittedAt, acceptedAt, statusRaw] = app
  const adType      = adTypeRaw as AdTypeId
  const status      = (statusRaw ?? 0) as AppStatus
  const statusInfo  = APP_STATUS_MAP[status]
  const parsed      = parseAdContent(adContent)
  const links       = parseAdLink(adLinkRaw)
  const totalPaid   = (Number(prizePaid) + Number(feePaid)) / 1_000_000
  const days        = Math.round(Number(duration) / 86400)
  const submittedDate = new Date(Number(submittedAt) * 1000).toLocaleDateString()
  const acceptedDate  = Number(acceptedAt) > 0 ? new Date(Number(acceptedAt) * 1000).toLocaleDateString() : null
  const linkEntries = LINK_ICONS.filter(c => links[c.key])

  async function act(fn: "acceptApplication" | "rejectApplication") {
    setIsActing(true)
    try {
      const tx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: fn, args: [BigInt(appId)], chainId: APP_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetch(); onAction()
      toast({ title: fn === "acceptApplication" ? "Accepted" : "Rejected", description: `Application #${appId} updated.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsActing(false) }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5 mb-1">
            <span className="text-xs font-bold text-gray-400">#{appId}</span>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", statusInfo.color)}>
              {statusInfo.label}
            </span>
            <span className="text-xs text-gray-400 capitalize">{adType || "—"}</span>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {sponsorName ?? (sponsor ? `${sponsor.slice(0, 6)}…${sponsor.slice(-4)}` : "—")}
          </p>
          {acceptedDate && (
            <p className="text-[10px] text-green-600 mt-0.5">Accepted {acceptedDate}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-gray-900">${totalPaid.toFixed(2)}</div>
          <div className="text-xs text-gray-400">{days}d · {submittedDate}</div>
        </div>
      </div>

      {/* Sponsor name */}
      {parsed.sponsorName && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Sponsor</p>
          <p className="text-xs font-semibold text-gray-800">{parsed.sponsorName}</p>
        </div>
      )}

      {/* Ad content */}
      {adType === "image" && parsed.imageUrl && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Image</p>
          <p className="text-xs text-gray-700 truncate font-mono">{parsed.imageUrl}</p>
          {parsed.ratio   && <p className="text-xs text-gray-400">Ratio: {parsed.ratio}</p>}
          {parsed.tagline && <p className="text-xs text-gray-600 italic">"{parsed.tagline}"</p>}
        </div>
      )}
      {adType === "embed" && parsed.embedUrl && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Embed</p>
          <p className="text-xs text-gray-700 truncate font-mono">{parsed.embedUrl}</p>
          {parsed.tagline && <p className="text-xs text-gray-600 italic">"{parsed.tagline}"</p>}
        </div>
      )}
      {adType === "text" && parsed.text && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Ad Text</p>
          <p className="text-xs text-gray-700">{renderFormattedText(parsed.text)}</p>
        </div>
      )}

      {/* Links */}
      {linkEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linkEntries.map(c => (
            <a key={c.key} href={links[c.key]} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.icon} alt={c.label} width={12} height={12} />
              <span className="text-xs text-gray-600 font-medium">{c.label}</span>
            </a>
          ))}
        </div>
      )}

      {/* Actions — pending only */}
      {status === 0 && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => act("acceptApplication")} disabled={isActing}
            className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            {isActing ? "…" : "Accept"}
          </button>
          <button onClick={() => act("rejectApplication")} disabled={isActing}
            className="flex-1 bg-red-50 border border-red-200 text-red-700 text-xs font-bold py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
            {isActing ? "…" : "Reject"}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Price Tiers ────────────────────────────────────────────────────────────────

function PriceTiersSection() {
  const { tiers, loading, refetch } = usePriceTiers()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const [ptHours,    setPtHours]    = useState("")
  const [ptMinPrize, setPtMinPrize] = useState("")
  const [ptFee,      setPtFee]      = useState("")
  const [isSaving,   setIsSaving]   = useState(false)
  const [removingSeconds, setRemovingSeconds] = useState<number | null>(null)

  async function handleSet() {
    const hours    = parseFloat(ptHours)
    const minPrize = parseFloat(ptMinPrize)
    const fee      = parseFloat(ptFee)
    if (!hours || hours <= 0 || !minPrize || minPrize <= 0 || isNaN(fee) || fee < 0) return
    setIsSaving(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "setPriceTier",
        args: [BigInt(Math.round(hours * 3600)), BigInt(Math.round(minPrize * 1_000_000)), BigInt(Math.round(fee * 1_000_000))],
        chainId: APP_CHAIN.id,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setPtHours(""); setPtMinPrize(""); setPtFee("")
      refetch()
      toast({ title: "Price Tier Set", description: `${hours}h — $${minPrize} prize + $${fee} fee` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsSaving(false) }
  }

  async function handleRemove(seconds: number) {
    setRemovingSeconds(seconds)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "setPriceTier",
        args: [BigInt(seconds), 0n, 0n], chainId: APP_CHAIN.id,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetch()
      toast({ title: "Tier Removed" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setRemovingSeconds(null) }
  }

  const total = ptMinPrize && ptFee ? parseFloat(ptMinPrize || "0") + parseFloat(ptFee || "0") : null

  return (
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900">Sponsor Price Tiers</p>
        <p className="text-xs text-muted-foreground mt-1">Same duration overwrites the existing tier. Set price to 0 removes it.</p>
      </div>

      {/* Existing tiers */}
      <div className="rounded-xl border overflow-hidden text-xs">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_28px] px-3 py-2 text-gray-400 border-b font-semibold bg-gray-50">
          <span>Duration</span>
          <span className="text-right">Prize</span>
          <span className="text-right">Fee</span>
          <span className="text-right">Total</span>
          <span />
        </div>
        {loading ? (
          <div className="px-3 py-4 text-center text-gray-300">Loading...</div>
        ) : tiers.length === 0 ? (
          <div className="px-3 py-4 text-center text-gray-300">No tiers set yet</div>
        ) : tiers.map(tier => {
          const prize = Number(tier.minPrize) / 1_000_000
          const fee   = Number(tier.fee) / 1_000_000
          const isRemoving = removingSeconds === tier.seconds
          return (
            <div key={tier.seconds} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_28px] items-center px-3 py-2.5 border-b last:border-0 text-gray-700">
              <span className="font-semibold">{tier.label}</span>
              <span className="text-right tabular-nums">${prize.toFixed(2)}</span>
              <span className="text-right tabular-nums">${fee.toFixed(2)}</span>
              <span className="text-right font-bold tabular-nums text-amber-600">${(prize + fee).toFixed(2)}</span>
              <span className="flex justify-end">
                <button onClick={() => handleRemove(tier.seconds)} disabled={isRemoving}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  title="Remove tier">
                  {isRemoving ? "…" : "✕"}
                </button>
              </span>
            </div>
          )
        })}
      </div>

      {/* Add tier */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Duration (hours)", value: ptHours, set: setPtHours, placeholder: "e.g. 168" },
          { label: "Min Prize (USDC)", value: ptMinPrize, set: setPtMinPrize, placeholder: "e.g. 10" },
          { label: "Fee (USDC)",       value: ptFee,      set: setPtFee,      placeholder: "e.g. 5"  },
        ].map(f => (
          <div key={f.label} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{f.label}</label>
            <input type="number" min="0" step="0.01" value={f.value} onChange={e => f.set(e.target.value)}
              placeholder={f.placeholder}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        ))}
      </div>
      {total != null && total > 0 && (
        <p className="text-xs text-amber-700 font-medium">Sponsor pays: ${total.toFixed(2)} USDC total</p>
      )}
      <button onClick={handleSet} disabled={isSaving || !ptHours || !ptMinPrize || parseFloat(ptMinPrize) <= 0}
        className="w-full bg-amber-500 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors">
        {isSaving ? "Saving..." : "Set Price Tier"}
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const PER_PAGE = 3

export default function AdminSponsorsPage() {
  const [page, setPage] = useState(0)

  const { data: nextAppIdRaw, refetch: refetchAppCount } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "nextApplicationId",
    chainId: APP_CHAIN.id, query: { refetchInterval: 30_000 },
  })

  const appCount = Number(nextAppIdRaw ?? 0n)

  // Lightweight status read for sorting pending to top
  const { data: statusesRaw } = useReadContracts({
    contracts: Array.from({ length: appCount }, (_, i) => ({
      address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
      functionName: "applications" as const, args: [BigInt(i)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: appCount > 0, refetchInterval: 60_000 },
  })

  // Sort: pending (0) first, then newest first by appId
  const sortedIds = Array.from({ length: appCount }, (_, i) => i).sort((a, b) => {
    const sa = (statusesRaw?.[a]?.result as readonly unknown[] | undefined)?.[9] as number ?? 0
    const sb = (statusesRaw?.[b]?.result as readonly unknown[] | undefined)?.[9] as number ?? 0
    if (sa === 0 && sb !== 0) return -1
    if (sb === 0 && sa !== 0) return 1
    return b - a // newest first
  })

  const pageCount = Math.max(1, Math.ceil(sortedIds.length / PER_PAGE))
  const pageIds   = sortedIds.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  function handleRefetch() {
    refetchAppCount()
    setPage(0)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Sponsors</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review applications and manage pricing tiers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left column — Price Tiers */}
        <PriceTiersSection />

        {/* Right column — Applications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Applications ({appCount})
            </h2>
            {pageCount > 1 && (
              <span className="text-xs text-muted-foreground">
                Page {page + 1} / {pageCount}
              </span>
            )}
          </div>

          {appCount === 0 ? (
            <div className="rounded-xl border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              No applications yet.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pageIds.map(id => (
                  <ApplicationRow key={id} appId={id} onAction={handleRefetch} />
                ))}
              </div>

              {pageCount > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Prev
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: pageCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`w-7 h-7 text-xs font-bold rounded-lg transition-colors ${
                          i === page
                            ? "bg-amber-500 text-white"
                            : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                    disabled={page === pageCount - 1}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
