"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig, APP_CHAIN, DATA_SUFFIX_PARAM, sendBatchWithAttribution } from "@/lib/wagmi"
import { canUsePaymaster, waitForPaymasterCalls } from "@/lib/miniapp-flag"
import { Loader2, CheckCircle2, Image as ImageIcon, FileText, Clock } from "lucide-react"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { FaYoutube, FaTiktok, FaXTwitter, FaVimeo, FaSpotify, FaTwitch } from "react-icons/fa6"
import { useToast } from "@/hooks/use-toast"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { cn } from "@/lib/utils"
import { RAFFLE_ADDRESS, RAFFLE_ABI, USDC_ADDRESS, ERC20_ABI } from "@/lib/contract"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { HiClipboardDocument } from "react-icons/hi2"
import { ContentEmbed } from "@/components/content/contentEmbed"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePriceTiers } from "@/hooks/usePriceTiers"

const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL

const AD_TYPES = [
  { id: "image", label: "Image",   description: "Banner or logo (jpeg, png, webp)" },
  { id: "embed", label: "Embed",   description: "YouTube, TikTok, Twitter, etc." },
  { id: "text",  label: "Text",    description: "Up to 200 characters" },
] as const

type AdTypeId = "image" | "embed" | "text"

const RATIO_OPTIONS = ["1:1", "16:9", "9:16", "4:5"] as const
type Ratio = typeof RATIO_OPTIONS[number]

const RATIO_VALUES: Record<Ratio, number> = {
  "1:1":  1,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:5":  4 / 5,
}

function closestRatio(w: number, h: number): Ratio {
  const actual = w / h
  let best: Ratio = "16:9"
  let bestDiff = Infinity
  for (const [r, val] of Object.entries(RATIO_VALUES) as [Ratio, number][]) {
    const diff = Math.abs(actual - val)
    if (diff < bestDiff) { bestDiff = diff; best = r as Ratio }
  }
  return best
}

const APP_STATUS_MAP = {
  0: { label: "Pending",  color: "text-amber-700 bg-amber-50 border-amber-200"  },
  1: { label: "Accepted", color: "text-green-700 bg-green-50 border-green-200"  },
  2: { label: "Rejected", color: "text-red-700 bg-red-50 border-red-200"        },
  3: { label: "Refunded", color: "text-gray-600 bg-gray-50 border-gray-200"     },
} as const

type AppStatus = 0 | 1 | 2 | 3

// URL shorteners to block (obscure destination)
const URL_SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "ow.ly", "buff.ly", "rebrand.ly", "short.io", "cutt.ly", "is.gd", "v.gd"]

// ── Link helpers ───────────────────────────────────────────────────────────────

type SponsorLinks = { website: string; x: string; discord: string; telegram: string }

function parseAdLink(raw: string): SponsorLinks {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null) {
      return {
        website:  parsed.website  ?? "",
        x:        parsed.x        ?? "",
        discord:  parsed.discord  ?? "",
        telegram: parsed.telegram ?? "",
      }
    }
  } catch { /* fallback */ }
  // Legacy single-link format
  return { website: raw, x: "", discord: "", telegram: "" }
}

function serializeLinks(links: SponsorLinks): string {
  const filtered = Object.fromEntries(Object.entries(links).filter(([, v]) => v.trim()))
  return Object.keys(filtered).length ? JSON.stringify(filtered) : ""
}

type LinkValidation = { valid: boolean; error?: string }

function validateWebsiteUrl(url: string): LinkValidation {
  if (!url) return { valid: true }
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return { valid: false, error: "Must use https://" }
    const host = u.hostname.toLowerCase()
    // Block IP addresses
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return { valid: false, error: "IP addresses not allowed" }
    // Block localhost / internal
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
      return { valid: false, error: "Internal addresses not allowed" }
    }
    // Block dangerous schemes (redundant but explicit)
    if (url.toLowerCase().startsWith("javascript:") || url.toLowerCase().startsWith("data:")) {
      return { valid: false, error: "Invalid URL scheme" }
    }
    // Block URL shorteners (destination obscured)
    if (URL_SHORTENERS.some(s => host === s || host.endsWith("." + s))) {
      return { valid: false, error: "URL shorteners not allowed — use a direct link" }
    }
    // Block non-ASCII domain (basic homograph check)
    if (/[^\x00-\x7F]/.test(host)) return { valid: false, error: "Non-ASCII domains not allowed" }
    return { valid: true }
  } catch {
    return { valid: false, error: "Invalid URL" }
  }
}

function validatePlatformUrl(url: string, allowed: string[]): LinkValidation {
  if (!url) return { valid: true }
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return { valid: false, error: "Must use https://" }
    const host = u.hostname.toLowerCase().replace(/^www\./, "")
    if (!allowed.some(a => host === a || host.endsWith("." + a))) {
      return { valid: false, error: `Must be a ${allowed[0]} URL` }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: "Invalid URL" }
  }
}

const LINK_CONFIG = [
  {
    key: "website" as const,
    label: "Website",
    icon: "/social/web.svg",
    placeholder: "https://yourproject.xyz",
    validate: (v: string) => validateWebsiteUrl(v),
    hint: "Any https:// URL — no shorteners or IP addresses",
  },
  {
    key: "x" as const,
    label: "X / Twitter",
    icon: "/social/x.svg",
    placeholder: "https://x.com/yourhandle",
    validate: (v: string) => validatePlatformUrl(v, ["x.com", "twitter.com"]),
    hint: "x.com or twitter.com URLs only",
  },
  {
    key: "discord" as const,
    label: "Discord",
    icon: "/social/discord.svg",
    placeholder: "https://discord.gg/invite",
    validate: (v: string) => validatePlatformUrl(v, ["discord.gg", "discord.com"]),
    hint: "discord.gg or discord.com URLs only",
  },
  {
    key: "telegram" as const,
    label: "Telegram",
    icon: "/social/telegram.svg",
    placeholder: "https://t.me/yourchannel",
    validate: (v: string) => validatePlatformUrl(v, ["t.me", "telegram.me", "telegram.org"]),
    hint: "t.me or telegram.me URLs only",
  },
] as const

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseAdContent(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null) return parsed
  } catch { /* fallback */ }
  return { imageUrl: raw }
}

type EmbedContentType = "youtube" | "youtubeshorts" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch"

function urlToContentType(url: string): EmbedContentType | null {
  if (url.includes("youtube.com/shorts/")) return "youtubeshorts"
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
  if (url.includes("tiktok.com")) return "tiktok"
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter"
  if (url.includes("vimeo.com"))   return "vimeo"
  if (url.includes("spotify.com")) return "spotify"
  if (url.includes("twitch.tv"))   return "twitch"
  return null
}

function detectPlatformName(url: string): string | null {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube"
  if (url.includes("tiktok.com"))  return "TikTok"
  if (url.includes("twitter.com") || url.includes("x.com")) return "X / Twitter"
  if (url.includes("vimeo.com"))   return "Vimeo"
  if (url.includes("spotify.com")) return "Spotify"
  if (url.includes("twitch.tv"))   return "Twitch"
  return null
}

// ── Text formatting helpers ────────────────────────────────────────────────────

/**
 * Render inline markdown bold (**text**) and italic (_text_) as React elements.
 * Stored as-is on-chain; only the display layer parses it.
 */
function renderFormattedText(text: string): React.ReactNode {
  // Split on **...** and _..._ markers
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

// ── AdPreview ─────────────────────────────────────────────────────────────────
// Mirrors ContentCard's containerRef + ResizeObserver sizing logic.
// Height is fixed; width adjusts to maintain aspect ratio.

const PREVIEW_HEIGHT = 300

function AdPreview({
  adType,
  imageUrl,
  ratio,
  embedUrl,
  adText,
  sponsorName,
}: {
  adType: AdTypeId
  imageUrl: string
  ratio: Ratio
  embedUrl: string
  adText: string
  sponsorName: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ct = adType === "embed" ? urlToContentType(embedUrl) : null

  // Aspect-ratio-aware sizing:
  // • Landscape (16:9, 1:1): width fills container, height derived
  // • Portrait  (9:16):      height fixed, width derived
  const embedAreaStyle = useMemo((): React.CSSProperties => {
    if (adType === "text") return { width: "100%", height: "auto", minHeight: "120px" }

    if (ct === "twitter") {
      return { width: "100%", height: "auto", minHeight: "150px", maxHeight: `${PREVIEW_HEIGHT}px`, overflowY: "auto" }
    }

    if (ct === "spotify") {
      return { width: "100%", height: "152px" }
    }

    const isVertical = ratio === "9:16" || ratio === "4:5" || ct === "youtubeshorts" || ct === "tiktok"
    const cw = containerWidth ?? 400

    if (isVertical) {
      // Portrait: fix height, derive width from the actual portrait ratio
      const h = PREVIEW_HEIGHT
      const portraitAspect = ratio === "4:5" ? (4 / 5) : (9 / 16)
      const w = Math.min(h * portraitAspect, cw)
      return { width: `${w}px`, height: `${h}px`, margin: "0 auto" }
    } else {
      // Landscape: fill container width, compute height from 16:9 or 1:1
      const aspectW = ratio === "1:1" ? 1 : 16
      const aspectH = ratio === "1:1" ? 1 : 9
      const w = cw
      const h = w * (aspectH / aspectW)
      return { width: `${w}px`, height: `${h}px` }
    }
  }, [containerWidth, adType, ratio, ct])

  return (
    <div className="border border-gray-300 rounded-[5px] bg-white overflow-hidden">
      <div ref={containerRef} className="w-full flex justify-center">
        <div className="overflow-hidden" style={embedAreaStyle}>

          {/* Image */}
          {adType === "image" && imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Ad preview"
              className="w-full h-full object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
            />
          )}

          {/* Embed */}
          {adType === "embed" && ct && (
            <ContentEmbed
              contentType={ct}
              contentUrl={embedUrl}
              aspectRatio={ct === "youtubeshorts" || ct === "tiktok" ? "9:16" : "16:9"}
              responsive={true}
            />
          )}

          {/* Unsupported embed */}
          {adType === "embed" && !ct && (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-[5px]">
              <span className="text-xs text-gray-500">Unsupported platform</span>
            </div>
          )}

          {/* Text */}
          {adType === "text" && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-[5px] p-6 text-center">
              {sponsorName && <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{sponsorName}</p>}
              <p className="text-sm font-semibold text-gray-800 leading-snug">
                {adText ? renderFormattedText(adText) : "Your ad text will appear here."}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── ApplicationRow ─────────────────────────────────────────────────────────────

function ApplicationRow({
  appId,
  address,
  onAction,
}: {
  appId: number
  address?: `0x${string}`
  onAction: () => void
}) {
  const [isRefunding, setIsRefunding] = useState(false)
  const [refundCountdown, setRefundCountdown] = useState("")
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const { data: refundTimeoutRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "refundTimeout",
    chainId: APP_CHAIN.id,
  })
  const refundTimeout = Number(refundTimeoutRaw ?? 30 * 86400)

  const { data: appRaw, refetch: refetchAppData } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "applications",
    args: [BigInt(appId)],
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 30_000, refetchOnWindowFocus: true },
  })

  const app = appRaw as readonly [string, string, string, string, bigint, bigint, bigint, bigint, bigint, number] | undefined

  const sponsor     = app?.[0] ?? ""
  const adType      = (app?.[1] ?? "") as AdTypeId
  const adContent   = app?.[2] ?? ""
  const adLinkRaw   = app?.[3] ?? ""
  const duration    = app?.[4] ?? 0n
  const prizePaid   = app?.[5] ?? 0n
  const feePaid     = app?.[6] ?? 0n
  const submittedAt = app?.[7] ?? 0n
  const status      = (app?.[9] ?? 0) as AppStatus

  const isOwnApp       = !!address && !!sponsor && address.toLowerCase() === sponsor.toLowerCase()
  const refundUnlockAt = Number(submittedAt) + refundTimeout
  const refundReady    = Date.now() / 1000 >= refundUnlockAt

  useEffect(() => {
    if (!isOwnApp || status !== 0 || refundReady) { setRefundCountdown(""); return }
    const update = () => {
      const diff = Math.max(0, refundUnlockAt - Math.floor(Date.now() / 1000))
      if (diff === 0) { setRefundCountdown(""); return }
      const d = Math.floor(diff / 86400)
      const h = Math.floor((diff % 86400) / 3600)
      const m = Math.floor((diff % 3600) / 60)
      setRefundCountdown(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [isOwnApp, status, refundReady, refundUnlockAt])

  if (!app) return null
  if (!isOwnApp) return null

  const parsed      = parseAdContent(adContent)
  const links       = parseAdLink(adLinkRaw)
  const totalPaid   = Number(prizePaid + feePaid) / 1_000_000
  const days        = Math.round(Number(duration) / 86400)
  const statusInfo  = APP_STATUS_MAP[status] ?? APP_STATUS_MAP[0]
  const submittedDate = new Date(Number(submittedAt) * 1000).toLocaleDateString()

  async function handleClaimRefund() {
    setIsRefunding(true)
    try {
      let ranPaymaster = false
      if (await canUsePaymaster(PAYMASTER_URL)) {
        try {
          const callsId = await sendBatchWithAttribution([
            { address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "claimRefund", args: [BigInt(appId)] },
          ], PAYMASTER_URL!)
          await waitForPaymasterCalls(callsId)
          ranPaymaster = true
        } catch {
          // fall through to EOA
        }
      }
      if (!ranPaymaster) {
        const tx = await writeContractAsync({
          address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
          functionName: "claimRefund", args: [BigInt(appId)],
          chainId: APP_CHAIN.id,
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      }
      refetchAppData()
      onAction()
      toast({ title: "Refunded", description: "Payment returned to your wallet.", variant: "success" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      const clean = msg.includes("RefundTimeout") ? "Refund period has not elapsed yet." : "Transaction failed."
      toast({ title: "Failed", description: clean, variant: "destructive" })
    } finally { setIsRefunding(false) }
  }

  const linkEntries = LINK_CONFIG.filter(c => links[c.key])

  const LABEL = "text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1"

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-xs font-bold text-gray-400">#{appId}</span>
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", statusInfo.color)}>
            {statusInfo.label}
          </span>
          <span className="text-xs text-gray-400 capitalize">{adType || "—"}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-gray-900">${totalPaid.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{days}d · {submittedDate}</div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Detail fields */}
      <div className="space-y-3">
        {parsed.sponsorName && (
          <div>
            <p className={LABEL}>Sponsor</p>
            <p className="text-sm text-gray-800 font-medium">{parsed.sponsorName}</p>
          </div>
        )}

        {adType === "image" && parsed.imageUrl && (
          <>
            <div>
              <p className={LABEL}>Image URL</p>
              <p className="text-xs text-gray-700 truncate font-mono">{parsed.imageUrl}</p>
            </div>
            {parsed.ratio && (
              <div>
                <p className={LABEL}>Aspect Ratio</p>
                <p className="text-xs text-gray-700">{parsed.ratio}</p>
              </div>
            )}
            {parsed.tagline && (
              <div>
                <p className={LABEL}>Tagline</p>
                <p className="text-xs text-gray-700">{parsed.tagline}</p>
              </div>
            )}
          </>
        )}

        {adType === "embed" && parsed.embedUrl && (
          <>
            <div>
              <p className={LABEL}>Embed URL</p>
              <p className="text-xs text-gray-700 truncate font-mono">{parsed.embedUrl}</p>
            </div>
            {parsed.tagline && (
              <div>
                <p className={LABEL}>Tagline</p>
                <p className="text-xs text-gray-700">{parsed.tagline}</p>
              </div>
            )}
          </>
        )}

        {adType === "text" && parsed.text && (
          <div>
            <p className={LABEL}>Ad Text</p>
            <p className="text-xs text-gray-700">{renderFormattedText(parsed.text)}</p>
          </div>
        )}

        {linkEntries.length > 0 && (
          <div>
            <p className={LABEL}>Links</p>
            <div className="flex flex-wrap gap-2">
              {linkEntries.map(c => (
                <a
                  key={c.key}
                  href={links[c.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.icon} alt={c.label} width={12} height={12} className="flex-shrink-0" />
                  <span className="text-xs text-gray-600 font-medium">{c.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {isOwnApp && status === 2 && (
        <p className="text-xs text-gray-500 text-center pt-1">
          Refund was returned to your wallet when the application was rejected.
        </p>
      )}

      {isOwnApp && status === 0 && (
        refundReady ? (
          <button onClick={handleClaimRefund} disabled={isRefunding}
            className="w-full border border-gray-200 text-gray-700 text-xs font-bold py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {isRefunding ? "Claiming…" : "Claim Refund"}
          </button>
        ) : refundCountdown ? (
          <p className="text-xs text-gray-400 text-center pt-1">
            Refund available in {refundCountdown}
          </p>
        ) : null
      )}
    </div>
  )
}

// ── Ad type icon helper ────────────────────────────────────────────────────────

function AdTypeIcon({ adType, embedUrl, size = 12 }: { adType: AdTypeId; embedUrl: string; size?: number }) {
  if (adType === "image") return <ImageIcon size={size} className="text-gray-500" />
  if (adType === "text")  return <FileText  size={size} className="text-gray-500" />
  // embed — detect platform
  if (embedUrl.includes("youtube.com") || embedUrl.includes("youtu.be")) return <FaYoutube size={size} className="text-red-500" />
  if (embedUrl.includes("tiktok.com"))  return <FaTiktok  size={size} className="text-gray-900" />
  if (embedUrl.includes("twitter.com") || embedUrl.includes("x.com"))    return <FaXTwitter size={size} className="text-gray-900" />
  if (embedUrl.includes("vimeo.com"))   return <FaVimeo   size={size} className="text-blue-500" />
  if (embedUrl.includes("spotify.com")) return <FaSpotify size={size} className="text-green-500" />
  if (embedUrl.includes("twitch.tv"))   return <FaTwitch  size={size} className="text-purple-500" />
  return <ImageIcon size={size} className="text-gray-400" />
}

function adTypeLabel(adType: AdTypeId, embedUrl: string): string {
  if (adType === "image") return "Image Ad"
  if (adType === "text")  return "Text Ad"
  if (embedUrl.includes("youtube.com") || embedUrl.includes("youtu.be")) return "YouTube Ad"
  if (embedUrl.includes("tiktok.com"))  return "TikTok Ad"
  if (embedUrl.includes("twitter.com") || embedUrl.includes("x.com"))    return "X / Twitter Ad"
  if (embedUrl.includes("vimeo.com"))   return "Vimeo Ad"
  if (embedUrl.includes("spotify.com")) return "Spotify Ad"
  if (embedUrl.includes("twitch.tv"))   return "Twitch Ad"
  return "Embed Ad"
}

// ── AdScheduleCard ─────────────────────────────────────────────────────────────

type AdScheduleItem = {
  appId: number
  sponsorName: string
  adType: AdTypeId
  prizePaid: number
  days: number
  acceptedAt: number
  endTime: number
  adLinkRaw: string
  embedUrl: string
  adContent: string
}

function AdScheduleCard({ item }: { item: AdScheduleItem }) {
  const [now, setNow]       = useState(Math.floor(Date.now() / 1000))
  const [embedOpen, setEmbedOpen] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const { sponsorName, adType, prizePaid, days, acceptedAt, endTime, adLinkRaw, embedUrl } = item
  const links      = parseAdLink(adLinkRaw)
  const linkEntries = LINK_CONFIG.filter(c => links[c.key])

  const isLive     = now >= acceptedAt && now < endTime
  const isUpcoming = now < acceptedAt
  const isPast     = now >= endTime

  function formatCountdown(secs: number) {
    const d = Math.floor(secs / 86400)
    const h = Math.floor((secs % 86400) / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${s}s`
  }


  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">

      {/* Row 1: badges left, prize pool right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
            Sponsored
          </span>
          {isLive && (
            <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Live
            </span>
          )}
          {isUpcoming && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Upcoming
            </span>
          )}
          {isPast && (
            <span className="text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
              Past
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">${prizePaid.toFixed(0)} <span className="text-gray-400 font-normal">prize pool</span></p>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Row 2: sponsor name + date/countdown */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">{sponsorName}</p>
        <p className="text-xs text-gray-400 text-right flex-shrink-0">
          {isLive && `Ends ${new Date(endTime * 1000).toLocaleDateString()}`}
          {isUpcoming && formatCountdown(acceptedAt - now)}
          {isPast && `${new Date(acceptedAt * 1000).toLocaleDateString()} – ${new Date(endTime * 1000).toLocaleDateString()}`}
        </p>
      </div>

      {/* Row 3: ad type + duration left, social icons right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {adType === "embed" && embedUrl ? (
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
            >
              <AdTypeIcon adType={adType} embedUrl={embedUrl} size={12} />
              <span className="text-[11px] text-gray-500">{adTypeLabel(adType, embedUrl)}</span>
            </a>
          ) : (
            <button
              onClick={() => setEmbedOpen(true)}
              className="flex items-center gap-1 hover:opacity-70 transition-opacity px-0"
            >
              <AdTypeIcon adType={adType} embedUrl={embedUrl} size={12} />
              <span className="text-[11px] text-gray-500">{adTypeLabel(adType, embedUrl)}</span>
            </button>
          )}
          <span className="text-gray-200">·</span>
          <Clock size={12} className="text-gray-400" />
          <span className="text-[11px] text-gray-400">{days}d</span>
        </div>

        {linkEntries.length > 0 && (
          <div className="flex items-center gap-1.5">
            {linkEntries.map(c => (
              <a
                key={c.key}
                href={links[c.key]}
                target="_blank"
                rel="noopener noreferrer"
                title={c.label}
                className="flex items-center justify-center w-6 h-6 rounded-md border border-gray-200 hover:border-gray-300 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.icon} alt={c.label} width={12} height={12} className="flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {(adType === "image" || adType === "text") && (
        <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
          <DialogContent className="p-0 max-w-sm rounded-2xl overflow-hidden border border-gray-200">
            <DialogHeader className="sr-only">
              <DialogTitle>{sponsorName}</DialogTitle>
            </DialogHeader>
            {adType === "image" && item.adContent && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={parseAdContent(item.adContent).imageUrl ?? ""}
                alt={sponsorName}
                className="w-full h-auto object-contain"
              />
            )}
            {adType === "text" && item.adContent && (
              <div className="flex flex-col items-center justify-center gap-3 px-8 py-10 text-center bg-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{sponsorName}</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug">
                  {renderFormattedText(parseAdContent(item.adContent).text ?? "")}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ── SponsorLinkInput ───────────────────────────────────────────────────────────

function SponsorLinkInput({
  config,
  value,
  onChange,
}: {
  config: typeof LINK_CONFIG[number]
  value: string
  onChange: (v: string) => void
}) {
  const validation = config.validate(value)
  const showError  = value.trim().length > 0 && !validation.valid

  return (
    <div>
      <div className={cn(
        "flex items-center gap-2.5 border rounded-lg px-3 py-2.5 transition-all",
        showError
          ? "border-red-400 bg-red-50 focus-within:ring-2 focus-within:ring-red-400"
          : "border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500"
      )}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={config.icon} alt={config.label} width={15} height={15} className="flex-shrink-0 opacity-60" />
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={config.placeholder}
          className="flex-1 text-sm bg-transparent focus:outline-none min-w-0"
        />
      </div>
      {showError && (
        <p className="text-[10px] text-red-500 mt-0.5 pl-1">{validation.error}</p>
      )}
      {!showError && (
        <p className="text-[10px] text-gray-400 mt-0.5 pl-1">{config.hint}</p>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SponsorPage() {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const [adType,       setAdType]       = useState<AdTypeId>("image")
  const [sponsorName,  setSponsorName]  = useState("")
  const [imageUrl,     setImageUrl]     = useState("")
  const [imageLoadState, setImageLoadState] = useState<"idle" | "loading" | "error" | "ok">("idle")
  const [ratio,        setRatio]        = useState<Ratio>("16:9")
  const [ratioAutoDetected, setRatioAutoDetected] = useState(false)
  const [embedUrl,     setEmbedUrl]     = useState("")
  const [adText,       setAdText]       = useState("")
  const [tagline,      setTagline]      = useState("")
  const [links,        setLinks]        = useState<SponsorLinks>({ website: "", x: "", discord: "", telegram: "" })
  const [durationIdx,  setDurationIdx]  = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStep,   setSubmitStep]   = useState<1 | 2>(1)
  const [submitDone,   setSubmitDone]   = useState(false)
  const adTextRef = useRef<HTMLTextAreaElement>(null)

  // Auto-detect ratio + validate image URL (debounced 600ms)
  useEffect(() => {
    const url = imageUrl.trim()
    if (!url) { setImageLoadState("idle"); return }
    setImageLoadState("loading")
    const timer = setTimeout(() => {
      const img = new window.Image()
      img.onload = () => {
        setImageLoadState("ok")
        if (img.naturalWidth && img.naturalHeight) {
          setRatio(closestRatio(img.naturalWidth, img.naturalHeight))
          setRatioAutoDetected(true)
        }
      }
      img.onerror = () => setImageLoadState("error")
      img.src = url
    }, 600)
    return () => clearTimeout(timer)
  }, [imageUrl])

  const applyFormat = useCallback((marker: string) => {
    const el = adTextRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const selected = adText.slice(start, end)
    const wrapped = marker + (selected || "text") + marker
    const next = adText.slice(0, start) + wrapped + adText.slice(end)
    if (next.length > 200) return
    setAdText(next)
    // Restore selection inside the markers
    requestAnimationFrame(() => {
      el.focus()
      const newStart = start + marker.length
      const newEnd   = newStart + (selected || "text").length
      el.setSelectionRange(newStart, newEnd)
    })
  }, [adText])

  const { tiers: priceTiers } = usePriceTiers()

  const { data: appCountRaw, refetch: refetchAppCount } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
    functionName: "nextApplicationId",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 30_000 },
  })

  const appCount = Number(appCountRaw ?? 0n)

  // Refetch on tab focus
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") refetchAppCount()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refetchAppCount])

  const selectedTier  = priceTiers[durationIdx]
  const minPrizeBn    = selectedTier?.minPrize ?? 0n
  const feeBn         = selectedTier?.fee ?? 0n
  const totalBn       = minPrizeBn + feeBn
  const minPrize      = Number(minPrizeBn) / 1_000_000
  const fee           = Number(feeBn) / 1_000_000
  const totalCost     = minPrize + fee
  const tierAvailable = totalCost > 0

  const detectedPlatform = adType === "embed" ? detectPlatformName(embedUrl) : null

  // All link validations pass
  const linksValid = LINK_CONFIG.every(c => {
    const v = links[c.key]
    return !v.trim() || c.validate(v).valid
  })
  const hasAtLeastOneLink = LINK_CONFIG.some(c => links[c.key].trim())

  const isFormValid = (
    !!address &&
    tierAvailable &&
    sponsorName.trim().length > 0 &&
    hasAtLeastOneLink &&
    linksValid &&
    (adType === "image" ? imageLoadState === "ok"
      : adType === "embed" ? embedUrl.trim().length > 0
      : adText.trim().length > 0)
  )

  function setLink(key: keyof SponsorLinks, value: string) {
    setLinks(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!isFormValid) return
    setIsSubmitting(true)
    setSubmitStep(1)
    try {
      const adContent =
        adType === "image"
          ? JSON.stringify({ sponsorName: sponsorName.trim(), imageUrl: imageUrl.trim(), ratio, tagline: tagline.trim() })
          : adType === "embed"
          ? JSON.stringify({ sponsorName: sponsorName.trim(), embedUrl: embedUrl.trim(), tagline: tagline.trim() })
          : JSON.stringify({ sponsorName: sponsorName.trim(), text: adText.trim() })

      const adLinkJson = serializeLinks(links)

      let ranPaymaster = false
      if (await canUsePaymaster(PAYMASTER_URL)) {
        try {
          const callsId = await sendBatchWithAttribution([
            { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [RAFFLE_ADDRESS, totalBn] },
            { address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "submitApplication", args: [adType, adContent, adLinkJson, BigInt(selectedTier?.seconds ?? 0)] },
          ], PAYMASTER_URL!)
          await waitForPaymasterCalls(callsId)
          ranPaymaster = true
        } catch {
          // fall through to EOA
        }
      }
      if (!ranPaymaster) {
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS, abi: ERC20_ABI,
          functionName: "approve", args: [RAFFLE_ADDRESS, totalBn],
          chainId: APP_CHAIN.id,
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx })
        setSubmitStep(2)

        const submitTx = await writeContractAsync({
          address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
          functionName: "submitApplication",
          args: [adType, adContent, adLinkJson, BigInt(selectedTier?.seconds ?? 0)],
          chainId: APP_CHAIN.id,
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: submitTx })
      }

      setSponsorName(""); setImageUrl(""); setEmbedUrl(""); setAdText(""); setTagline("")
      setLinks({ website: "", x: "", discord: "", telegram: "" })
      setSubmitDone(true)
      refetchAppCount()
      toast({ title: "Application submitted!", description: "We'll review it within 24–48 hours.", variant: "success" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      const clean = msg.includes("InvalidDuration")
        ? "Duration not available. Contact us to arrange pricing."
        : msg.includes("InsufficientAllowance")
        ? "USDC approval insufficient."
        : "Submission failed. Please try again."
      toast({ title: "Failed", description: clean, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const appIds = Array.from({ length: appCount }, (_, i) => i)
  const [activeTab, setActiveTab] = useState<"apply" | "upcoming" | "past">("apply")
  const [upcomingPage, setUpcomingPage] = useState(0)
  const [pastPage, setPastPage] = useState(0)
  const ITEMS_PER_PAGE = 5

  // Batch-read all applications in one multicall
  const { data: allAppsData } = useReadContracts({
    contracts: appIds.map(id => ({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "applications" as const,
      args: [BigInt(id)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: appCount > 0, refetchInterval: 60_000 },
  })

  const acceptedApps = useMemo<AdScheduleItem[]>(() => {
    if (!allAppsData) return []
    return appIds.flatMap((id, i) => {
      const raw = allAppsData[i]?.result as readonly [string, string, string, string, bigint, bigint, bigint, bigint, bigint, number] | undefined
      if (!raw || raw[9] !== 1) return []
      const acceptedAt = Number(raw[8])
      const duration   = Number(raw[4])
      const endTime    = acceptedAt + duration
      const parsed     = parseAdContent(raw[2])
      return [{
        appId:       id,
        sponsorName: parsed.sponsorName || "Sponsor",
        adType:      raw[1] as AdTypeId,
        prizePaid:   Number(raw[5]) / 1_000_000,
        days:        Math.round(duration / 86400),
        acceptedAt,
        endTime,
        adLinkRaw:   raw[3] ?? "",
        embedUrl:    raw[1] === "embed" ? (parseAdContent(raw[2]).embedUrl ?? "") : "",
        adContent:   raw[2] ?? "",
      }]
    })
  }, [allAppsData, appIds])

  const nowSec = Math.floor(Date.now() / 1000)

  const upcomingApps = useMemo(() =>
    acceptedApps.filter(a => a.endTime > nowSec).sort((a, b) => a.acceptedAt - b.acceptedAt),
    [acceptedApps, nowSec]
  )
  const pastApps = useMemo(() =>
    acceptedApps.filter(a => a.endTime <= nowSec).sort((a, b) => b.endTime - a.endTime),
    [acceptedApps, nowSec]
  )

  const upcomingSlice     = upcomingApps.slice(upcomingPage * ITEMS_PER_PAGE, (upcomingPage + 1) * ITEMS_PER_PAGE)
  const pastSlice         = pastApps.slice(pastPage * ITEMS_PER_PAGE, (pastPage + 1) * ITEMS_PER_PAGE)
  const totalUpcomingPages = Math.ceil(upcomingApps.length / ITEMS_PER_PAGE)
  const totalPastPages    = Math.ceil(pastApps.length / ITEMS_PER_PAGE)

  const TABS = [
    { id: "apply",    label: "Apply"    },
    { id: "upcoming", label: "Upcoming" },
    { id: "past",     label: "Past"     },
  ] as const

  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="Advertise" />

      {/* Transaction lock overlay — blocks UI during the 2-step approve+submit flow */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-7 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4">
            <Loader2 className="animate-spin text-indigo-600" size={28} />
            <p className="text-sm font-semibold text-gray-900 text-center">Submitting your application…</p>
            {/* Progress bar */}
            <div className="w-full flex flex-col gap-2">
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: submitStep === 1 ? "50%" : "100%" }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span className={submitStep >= 1 ? "text-indigo-600 font-medium" : ""}>
                  {submitStep === 1 ? "⏳ " : "✓ "}Approving USDC
                </span>
                <span className={submitStep >= 2 ? "text-indigo-600 font-medium" : ""}>
                  {submitStep === 2 ? "⏳ " : ""}Signing application
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              Please keep this page open and confirm both transactions in your wallet.
            </p>
          </div>
        </div>
      )}

      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full space-y-4">

        {/* Hero — always visible */}
        <div
          className="relative rounded-2xl overflow-hidden text-white"
          style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)" }}
        >
          {/* Radial glow top-right */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(255,255,255,0.12) 0%, transparent 60%)" }}
          />

          <div className="relative px-6 pt-7 pb-5">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-blue-100 uppercase">Sponsor a Raffle</span>
            </div>

            <h1 className="text-2xl font-black leading-tight mb-4">
              <span className="text-yellow-300">Own the Spotlight</span>
            </h1>

            {/* Description card */}
            <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 mb-5">
              <p className="text-sm text-white/80 leading-relaxed">
                Your payment funds a live prize raffle for Booztory users — and your brand runs alongside it for the full duration.
                Half goes to raffle winners. Half is the platform fee. 100% on-chain, held in escrow until approved.
              </p>
            </div>

            {/* Split bar */}
            <div className="flex rounded-lg overflow-hidden h-2 w-full">
              <div className="flex-1 bg-yellow-300" title="Prize pool" />
              <div className="w-px bg-white/20" />
              <div className="flex-1 bg-white/25" title="Platform fee" />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-yellow-200 font-semibold">Prize pool → winners</span>
              <span className="text-[10px] text-white/50 font-semibold">Platform fee</span>
            </div>
          </div>

          {/* Pricing cards — only show tiers that are configured */}
          {priceTiers.length === 0 ? (
            <div className="border-t border-white/10 px-4 py-4 text-center text-white/40 text-xs">
              No pricing tiers configured yet
            </div>
          ) : (
            <div className={`relative grid grid-cols-${priceTiers.length} gap-px bg-white/10 border-t border-white/10`}>
              {priceTiers.map(tier => {
                const prize = Number(tier.minPrize) / 1_000_000
                const total = (Number(tier.minPrize) + Number(tier.fee)) / 1_000_000
                return (
                  <div key={tier.seconds} className="bg-white/5 px-4 py-4 flex flex-col items-center text-center gap-0.5">
                    <p className="text-[10px] font-bold tracking-widest text-white/40 uppercase">{tier.label}</p>
                    <p className="text-lg font-black text-white">${total.toFixed(0)}</p>
                    <p className="text-[10px] text-yellow-200 font-semibold">${prize.toFixed(0)} to winners</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {TABS.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && activeTab !== t.id && activeTab !== TABS[i - 1].id && (
                <div className="w-px my-1.5 bg-gray-300 flex-shrink-0" />
              )}
              <button
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                  activeTab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* ── Apply tab ── */}
        {activeTab === "apply" && (<>

        {/* Read before you apply — accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="read" className="bg-gray-0 rounded-lg border border-gray-300">
            <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
              <span className="flex items-center gap-2 font-bold text-gray-900">
                <HiClipboardDocument size={15} className="text-gray-500 flex-shrink-0" />
                Read before you apply
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 px-4">
              <ul className="space-y-2.5 text-xs text-gray-500 leading-relaxed list-none">
                <li>
                  <span className="font-semibold text-gray-700">🏆 Prize pool</span> — your deposit is locked on-chain and paid out to raffle winners during your sponsorship. Real incentive that drives real engagement.
                </li>
                <li>
                  <span className="font-semibold text-gray-700">📣 Ad placement</span> — your ad runs as a floating widget on the main feed for all users, plus a desktop sidebar panel for the full duration.
                </li>
                <li>
                  <span className="font-semibold text-gray-700">🔒 Escrow protection</span> — funds are held on-chain until approved. Rejected? Full refund automatically returned. No response in 30 days? Claim it yourself, no questions asked.
                </li>
                <li>
                  <span className="font-semibold text-gray-700">⛓️ 100% on-chain</span> — no middlemen, no hidden fees. Everything is verifiable on Base.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Application form */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="font-bold text-gray-900">Apply to Advertise</p>
            <p className="text-xs text-gray-400 mt-0.5">Payment held in escrow until approved</p>
          </div>

          {!address ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              Connect your wallet to apply
            </div>
          ) : submitDone ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="mx-auto text-green-500 mb-3" size={32} />
              <p className="font-semibold text-gray-900 mb-1">Application submitted!</p>
              <p className="text-sm text-gray-400">We review within 24–48 hours. Track it below.</p>
              <button
                onClick={() => setSubmitDone(false)}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Submit another
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-5">

              {/* Sponsor name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Sponsor Name <span className="text-red-400 font-normal">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400">{sponsorName.length}/70</span>
                </div>
                <input
                  type="text"
                  value={sponsorName}
                  onChange={e => setSponsorName(e.target.value)}
                  placeholder="Your project or brand name"
                  maxLength={70}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Ad type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Ad Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {AD_TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setAdType(t.id); setImageLoadState("idle") }}
                      className={cn(
                        "text-left p-3 rounded-xl border transition-all",
                        adType === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <p className={cn("text-sm font-semibold", adType === t.id ? "text-indigo-700" : "text-gray-700")}>
                        {t.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Image fields */}
              {adType === "image" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Image URL <span className="text-red-400 font-normal">*</span>
                    </label>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      placeholder="https://your-cdn.com/banner.png"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {imageLoadState === "error" ? (
                      <p className="text-[10px] text-red-500 mt-1">Image could not be loaded. Use a direct image link (no hotlink protection).</p>
                    ) : imageLoadState === "loading" ? (
                      <p className="text-[10px] text-gray-400 mt-1">Checking image…</p>
                    ) : imageLoadState === "ok" ? (
                      <p className="text-[10px] text-green-600 mt-1">Image loaded successfully.</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">Accepted: jpeg, jpg, png, webp, gif</p>
                    )}
                  </div>

                  {imageUrl.trim() && (
                    <AdPreview adType="image" imageUrl={imageUrl.trim()} ratio={ratio} embedUrl="" adText="" sponsorName={sponsorName} />
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Aspect Ratio
                      </label>
                      {ratioAutoDetected && (
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                          auto
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {RATIO_OPTIONS.map(r => (
                        <button
                          key={r}
                          onClick={() => { setRatio(r); setRatioAutoDetected(false) }}
                          className={cn(
                            "px-4 py-2 rounded-lg border text-sm font-semibold transition-all",
                            ratio === r
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-gray-200 text-gray-700 hover:border-gray-300"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Tagline <span className="text-gray-300 font-normal">(optional)</span>
                      </label>
                      <span className="text-[10px] text-gray-400">{tagline.length}/70</span>
                    </div>
                    <input
                      type="text"
                      value={tagline}
                      onChange={e => setTagline(e.target.value)}
                      placeholder="Short brand message"
                      maxLength={70}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {/* Embed fields */}
              {adType === "embed" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Embed URL <span className="text-red-400 font-normal">*</span>
                    </label>
                    <input
                      type="url"
                      value={embedUrl}
                      onChange={e => setEmbedUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {embedUrl.trim() && (
                      <p className={cn("text-[10px] mt-1 font-semibold", detectedPlatform ? "text-indigo-600" : "text-red-500")}>
                        {detectedPlatform ? `Detected: ${detectedPlatform}` : "Unsupported platform"}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      Supported: YouTube, TikTok, X/Twitter, Vimeo, Spotify, Twitch
                    </p>
                  </div>

                  {embedUrl.trim() && (
                    <AdPreview adType="embed" imageUrl="" ratio="16:9" embedUrl={embedUrl.trim()} adText="" sponsorName={sponsorName} />
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Tagline <span className="text-gray-300 font-normal">(optional)</span>
                      </label>
                      <span className="text-[10px] text-gray-400">{tagline.length}/70</span>
                    </div>
                    <input
                      type="text"
                      value={tagline}
                      onChange={e => setTagline(e.target.value)}
                      placeholder="Short brand message"
                      maxLength={70}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {/* Text fields */}
              {adType === "text" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Ad Text <span className="text-red-400 font-normal">*</span>
                    </label>
                    <span className="text-[10px] text-gray-400">{adText.length}/200</span>
                  </div>
                  {/* Formatting toolbar */}
                  <div className="flex items-center gap-1 mb-1.5">
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); applyFormat("**") }}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-black leading-none transition-colors"
                      title="Bold (**text**)"
                    >B</button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); applyFormat("_") }}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs italic font-semibold leading-none transition-colors"
                      title="Italic (_text_)"
                    >I</button>
                    <span className="text-[10px] text-gray-300 ml-1">Select text then click B or I</span>
                  </div>
                  <textarea
                    ref={adTextRef}
                    value={adText}
                    onChange={e => setAdText(e.target.value)}
                    placeholder="Your ad message — up to 200 characters"
                    maxLength={200}
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Use **bold** and _italic_ for formatting</p>
                  <div className="mt-3">
                    <AdPreview adType="text" imageUrl="" ratio="16:9" embedUrl="" adText={adText} sponsorName={sponsorName} />
                  </div>
                </div>
              )}

              {/* Sponsor links */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Sponsor Links <span className="text-red-400 font-normal normal-case">*at least one</span>
                </label>
                <div className="space-y-2">
                  {LINK_CONFIG.map(c => (
                    <SponsorLinkInput
                      key={c.key}
                      config={c}
                      value={links[c.key]}
                      onChange={v => setLink(c.key, v)}
                    />
                  ))}
                </div>
              </div>

              {/* Duration — only show configured tiers */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Duration
                </label>
                {priceTiers.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No pricing tiers available — owner needs to configure them.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {priceTiers.map((tier, i) => {
                      const total = (Number(tier.minPrize) + Number(tier.fee)) / 1_000_000
                      return (
                        <button
                          key={tier.seconds}
                          onClick={() => setDurationIdx(i)}
                          className={cn(
                            "p-3 rounded-xl border text-center transition-all",
                            durationIdx === i ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <p className={cn("text-sm font-bold", durationIdx === i ? "text-indigo-700" : "text-gray-700")}>
                            {tier.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">${total.toFixed(2)}</p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Cost breakdown */}
              {tierAvailable && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Prize pool deposit</span>
                    <span>${minPrize.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Platform fee</span>
                    <span>${fee.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1.5">
                    <span>Total</span>
                    <span>${totalCost.toFixed(2)} USDC</span>
                  </div>
                  <p className="text-[10px] text-gray-400 pt-0.5">
                    Prize pool is paid to raffle winners. Platform fee covers placement &amp; operations. Full refund if rejected.
                  </p>
                </div>
              )}

              {!tierAvailable && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  Pricing not set for this duration. Contact us on X to arrange a custom package.
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                {isSubmitting ? "Submitting…" : tierAvailable ? `Apply — $${totalCost.toFixed(2)} USDC` : "Apply"}
              </button>
            </div>
          )}
        </div>

        {/* Application list */}
        {address && appCount > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
              My Applications
            </p>
            {appIds.map(id => (
              <ApplicationRow
                key={id}
                appId={id}
                address={address}
                onAction={refetchAppCount}
              />
            ))}
          </div>
        )}


        </>)}

        {/* ── Upcoming tab ── */}
        {activeTab === "upcoming" && (
          <div className="space-y-3">
            {upcomingApps.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                No upcoming sponsors yet
              </div>
            ) : (
              <>
                {upcomingSlice.map(item => <AdScheduleCard key={item.appId} item={item} />)}
                {totalUpcomingPages > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setUpcomingPage(p => Math.max(0, p - 1))}
                      disabled={upcomingPage === 0}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-gray-400">{upcomingPage + 1} / {totalUpcomingPages}</span>
                    <button
                      onClick={() => setUpcomingPage(p => Math.min(totalUpcomingPages - 1, p + 1))}
                      disabled={upcomingPage >= totalUpcomingPages - 1}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Past tab ── */}
        {activeTab === "past" && (
          <div className="space-y-3">
            {pastApps.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                No past sponsors yet
              </div>
            ) : (
              <>
                {pastSlice.map(item => <AdScheduleCard key={item.appId} item={item} />)}
                {totalPastPages > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setPastPage(p => Math.max(0, p - 1))}
                      disabled={pastPage === 0}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-gray-400">{pastPage + 1} / {totalPastPages}</span>
                    <button
                      onClick={() => setPastPage(p => Math.min(totalPastPages - 1, p + 1))}
                      disabled={pastPage >= totalPastPages - 1}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
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
