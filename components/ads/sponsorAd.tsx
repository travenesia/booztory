"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import type React from "react"
import { HiMiniArrowRight } from "react-icons/hi2"
import { useReadContract, useReadContracts } from "wagmi"
import { usePathname } from "next/navigation"
import { RAFFLE_ADDRESS, RAFFLE_ABI } from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"
import { ContentEmbed } from "@/components/content/contentEmbed"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type AdType = "image" | "embed" | "text"
type EmbedContentType = "youtube" | "youtubeshorts" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch"
type SponsorLinks = { website?: string; x?: string; discord?: string; telegram?: string }

interface ActiveAd {
  sponsorName: string
  adType: AdType
  imageUrl?: string
  ratio: string
  embedUrl?: string
  text?: string
  tagline?: string
  links: SponsorLinks
  durationDays: number
  endTime: number // unix seconds
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAdContent(raw: string): Record<string, string> {
  try {
    const p = JSON.parse(raw)
    if (typeof p === "object" && p !== null) return p
  } catch { /* noop */ }
  return {}
}

function parseAdLink(raw: string): SponsorLinks {
  try {
    const p = JSON.parse(raw)
    if (typeof p === "object" && p !== null) return p
  } catch { /* noop */ }
  return raw ? { website: raw } : {}
}

function urlToContentType(url: string): EmbedContentType | null {
  if (url.includes("youtube.com/shorts/")) return "youtubeshorts"
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
  if (url.includes("tiktok.com")) return "tiktok"
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter"
  if (url.includes("vimeo.com")) return "vimeo"
  if (url.includes("spotify.com")) return "spotify"
  if (url.includes("twitch.tv")) return "twitch"
  return null
}

function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

const LINK_ICONS: Record<string, string> = {
  website: "/social/web.svg",
  x:       "/social/x.svg",
  discord: "/social/discord.svg",
  telegram:"/social/telegram.svg",
}
const LINK_LABELS: Record<string, string> = {
  website: "Website",
  x:       "X",
  discord: "Discord",
  telegram:"Telegram",
}

// ── Hook — finds the most recent accepted sponsor application ─────────────────

export function useSponsorAd(): ActiveAd | null {
  // Tick every minute so the expiry check re-evaluates without a hard refresh
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000)
    return () => clearInterval(id)
  }, [])

  const { data: countRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "nextApplicationId",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 30_000, refetchOnWindowFocus: true },
  })

  const count = Number(countRaw ?? 0n)

  const { data: appsRaw } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "applications" as const,
      args: [BigInt(i)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: count > 0, refetchInterval: 30_000, refetchOnWindowFocus: true },
  })

  return useMemo((): ActiveAd | null => {
    if (!appsRaw) return null

    // Walk backwards — most recent accepted application wins
    for (let i = appsRaw.length - 1; i >= 0; i--) {
      const app = appsRaw[i]?.result as
        | readonly [string, string, string, string, bigint, bigint, bigint, bigint, bigint, number]
        | undefined
      if (!app) continue

      const [, adTypeRaw, adContent, adLink, duration, , , , acceptedAt, status] = app
      if (status !== 1) continue // 1 = Accepted

      const startTime = Number(acceptedAt)
      const endTime   = startTime + Number(duration)
      if (startTime > nowSec) continue // Not started yet
      if (endTime   <= nowSec) continue // Expired

      const parsed = parseAdContent(adContent)
      const links  = parseAdLink(adLink)

      return {
        sponsorName: parsed.sponsorName ?? "",
        adType:      adTypeRaw as AdType,
        imageUrl:    parsed.imageUrl,
        ratio:       parsed.ratio ?? "16:9",
        embedUrl:    parsed.embedUrl,
        text:        parsed.text,
        tagline:     parsed.tagline,
        links,
        durationDays: Math.round(Number(duration) / 86400),
        endTime,
      }
    }
    return null
  }, [appsRaw, nowSec])
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useAdCountdown(endTime: number): string {
  const [display, setDisplay] = useState("")

  useEffect(() => {
    function calc() {
      const diff = endTime - Math.floor(Date.now() / 1000)
      if (diff <= 0) { setDisplay("Expired"); return }
      const d = Math.floor(diff / 86400)
      const h = Math.floor((diff % 86400) / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      const parts: string[] = []
      if (d > 0) parts.push(`${d}d`)
      if (d > 0 || h > 0) parts.push(`${String(h).padStart(2, "0")}h`)
      if (d > 0 || h > 0 || m > 0) parts.push(`${String(m).padStart(2, "0")}m`)
      parts.push(`${String(s).padStart(2, "0")}s`)
      setDisplay(parts.join(" "))
    }
    calc()
    const id = setInterval(calc, 1_000)
    return () => clearInterval(id)
  }, [endTime])

  return display
}

// ── LiveBadge — pulsing dot to indicate ad is currently active ────────────────

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
      </span>
      <span className="text-[9px] font-bold text-green-600 uppercase tracking-wide">Live</span>
    </span>
  )
}

// ── AdContent — main ad body (image / embed / text) ──────────────────────────

// maxBodyH is passed from the modal — measured from window, not the container itself.
// This avoids the chicken-and-egg problem where measuring h-full gives the forced
// panel height rather than the content's natural height.
function AdContent({ ad, maxBodyH, flush }: { ad: ActiveAd; maxBodyH?: number; flush?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState<number>(0)

  useEffect(() => {
    if (!maxBodyH) return
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxBodyH])

  // Same fitting logic as contentCard — fit to height first for portrait, width first for landscape
  const fittedStyle = useMemo((): React.CSSProperties | null => {
    if (!maxBodyH || containerW === 0) return null
    const w = containerW
    const h = maxBodyH

    if (ad.adType === "embed" && ad.embedUrl) {
      const ct = urlToContentType(ad.embedUrl)
      if (!ct) return null
      if (ct === "twitter") {
        return { width: "100%", height: "auto", minHeight: "150px", maxHeight: `${h}px`, overflowY: "auto", margin: "0 auto" }
      }
      if (ct === "spotify") {
        const sh = h >= 352 ? 352 : h >= 152 ? 152 : Math.max(152, h)
        return { width: `${w}px`, height: `${sh}px`, margin: "0 auto" }
      }
      const isVertical = ct === "youtubeshorts" || ct === "tiktok"
      if (isVertical) {
        let ch = h, cw = ch * (9 / 16)
        if (cw > w) { cw = w; ch = cw / (9 / 16) }
        return { width: `${Math.max(60, cw)}px`, height: `${Math.max(100, ch)}px`, margin: "0 auto" }
      }
      let cw = w, ch = cw / (16 / 9)
      if (ch > h) { ch = h; cw = ch * (16 / 9) }
      return { width: `${Math.max(100, cw)}px`, height: `${Math.max(60, ch)}px`, margin: "0 auto" }
    }

    if (ad.adType === "text") {
      let cw = w, ch = Math.round(cw * 9 / 16)
      if (ch > h) { ch = h; cw = Math.round(ch * 16 / 9) }
      return { width: `${Math.max(200, cw)}px`, height: `${Math.max(100, ch)}px`, margin: "0 auto" }
    }

    if (ad.adType === "image") {
      if (ad.ratio === "1:1") {
        const size = Math.max(60, Math.min(w, h))
        return { width: `${size}px`, height: `${size}px`, margin: "0 auto" }
      }
      if (ad.ratio === "9:16") {
        let ch = h, cw = ch * (9 / 16)
        if (cw > w) { cw = w; ch = cw / (9 / 16) }
        return { width: `${Math.max(60, cw)}px`, height: `${Math.max(100, ch)}px`, margin: "0 auto" }
      }
      let cw = w, ch = cw / (16 / 9)
      if (ch > h) { ch = h; cw = ch * (16 / 9) }
      return { width: `${Math.max(100, cw)}px`, height: `${Math.max(60, ch)}px`, margin: "0 auto" }
    }

    return null
  }, [maxBodyH, containerW, ad])

  // ── Modal mode (maxBodyH provided) ───────────────────────────────────────────
  if (maxBodyH) {
    return (
      <div ref={containerRef} className="w-full flex justify-center">
        {ad.adType === "image" && ad.imageUrl && fittedStyle && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.imageUrl}
            alt={ad.sponsorName || "Sponsor"}
            className="rounded-lg object-cover"
            style={fittedStyle}
          />
        )}

        {ad.adType === "embed" && ad.embedUrl && fittedStyle && (() => {
          const ct = urlToContentType(ad.embedUrl)
          if (!ct) return null
          const isVertical = ct === "youtubeshorts" || ct === "tiktok"
          return (
            <div className="rounded-lg overflow-hidden" style={fittedStyle}>
              <ContentEmbed
                contentType={ct}
                contentUrl={ad.embedUrl}
                aspectRatio={isVertical ? "9:16" : "16:9"}
                responsive={true}
              />
            </div>
          )
        })()}

        {ad.adType === "text" && ad.text && fittedStyle && (
          <div style={fittedStyle} className="flex items-center justify-center text-center px-6">
            <p className="text-base font-semibold text-white leading-snug">
              {renderFormattedText(ad.text)}
            </p>
          </div>
        )}
      </div>
    )
  }

  // ── Compact mode (sidebar / toggle) ──────────────────────────────────────────
  return (
    <div>
      {ad.adType === "image" && ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt={ad.sponsorName || "Sponsor"}
          className={cn("w-full object-cover", !flush && "rounded-lg")}
          style={{
            aspectRatio: ad.ratio === "9:16" ? "9/16" : ad.ratio === "1:1" ? "1/1" : "16/9",
            ...(flush ? {} : { maxHeight: "260px" }),
          }}
        />
      )}

      {ad.adType === "embed" && ad.embedUrl && (() => {
        const ct = urlToContentType(ad.embedUrl)
        if (!ct) return null
        const isVertical = ct === "youtubeshorts" || ct === "tiktok"
        return (
          <div
            className={cn("overflow-hidden", !flush && "rounded-lg")}
            style={{
              aspectRatio: isVertical ? "9/16" : "16/9",
              ...(flush ? {} : { maxHeight: "260px" }),
            }}
          >
            <ContentEmbed
              contentType={ct}
              contentUrl={ad.embedUrl}
              aspectRatio={isVertical ? "9:16" : "16:9"}
              responsive={true}
            />
          </div>
        )
      })()}

      {ad.adType === "text" && ad.text && (
        <div className="w-full flex items-center justify-center text-center px-6 py-6" style={{ aspectRatio: "16/9" }}>
          <p className="text-sm font-semibold text-white leading-snug">
            {renderFormattedText(ad.text)}
          </p>
        </div>
      )}
    </div>
  )
}

// ── AdPanelFooter — panel footer: tagline left, social links right ────────────

function AdPanelFooter({ ad, small }: { ad: ActiveAd; small?: boolean }) {
  const linkEntries = Object.entries(ad.links).filter(([, v]) => v)
  if (!ad.tagline && linkEntries.length === 0) return null

  return (
    <div className={cn(
      "flex items-center justify-between border-t border-gray-100 flex-shrink-0",
      small ? "px-2.5 py-1.5 gap-2" : "px-4 py-2.5 gap-3"
    )}>
      {/* Left: tagline */}
      <div className="min-w-0 flex-1">
        {ad.tagline && (
          <span className={cn("text-gray-500 italic truncate", small ? "text-[10px]" : "text-xs")}>
            {ad.tagline}
          </span>
        )}
      </div>

      {/* Right: social links */}
      {linkEntries.length > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {linkEntries.map(([key, href]) => (
            <a
              key={key}
              href={href as string}
              target="_blank"
              rel="noopener noreferrer"
              title={LINK_LABELS[key] ?? key}
              className={cn(
                "flex items-center justify-center rounded border border-gray-200 bg-white hover:border-gray-300 transition-colors",
                small ? "w-5 h-5" : "w-6 h-6"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LINK_ICONS[key] ?? ""} alt={key} width={small ? 10 : 12} height={small ? 10 : 12} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SponsorAdDesktopPopover — desktop homepage: opens centered viewport modal ──

export function SponsorAdDesktopPopover({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const ad = useSponsorAd()
  const countdown = useAdCountdown(ad?.endTime ?? 0)

  // Pre-compute exact video dimensions so the panel width = video width (no side gaps)
  const [videoW, setVideoW] = useState(360)
  const [videoH, setVideoH] = useState(480)

  useEffect(() => {
    function compute() {
      if (!ad) return
      const HEADER_H  = 0   // header removed — all info in right column
      const FOOTER_H  = 0   // tagline hidden in popup
      const V_MARGIN  = 32   // 16px top + 16px bottom
      const H_MARGIN  = 32   // 16px left + 16px right
      const SOCIAL_W  = 48  // right column always present (live + countdown + links): 36px + 12px gap

      const availW = Math.floor(window.innerWidth  - H_MARGIN - SOCIAL_W)
      const availH = Math.floor(window.innerHeight - V_MARGIN - HEADER_H - FOOTER_H)

      let vw = availW, vh = availH

      if (ad.adType === "image") {
        const [rw, rh] = ad.ratio === "9:16" ? [9, 16] : ad.ratio === "1:1" ? [1, 1] : [16, 9]
        const maxW = (ad.ratio === "16:9" || ad.ratio === "1:1") ? Math.min(availW, 560) : availW
        vw = maxW; vh = Math.round(vw * rh / rw)
        if (vh > availH) { vh = availH; vw = Math.round(vh * rw / rh) }
      } else if (ad.adType === "embed" && ad.embedUrl) {
        const ct = urlToContentType(ad.embedUrl)
        if (!ct || ct === "twitter") {
          vw = Math.min(availW, 360); vh = availH
        } else if (ct === "spotify") {
          vw = Math.min(availW, 400); vh = Math.min(availH, 352)
        } else {
          const isVert = ct === "youtubeshorts" || ct === "tiktok"
          if (isVert) {
            vh = availH; vw = Math.round(vh * 9 / 16)
            if (vw > availW) { vw = availW; vh = Math.round(vw * 16 / 9) }
          } else {
            vw = Math.min(availW, 560); vh = Math.round(vw * 9 / 16)
            if (vh > availH) { vh = availH; vw = Math.round(vh * 16 / 9) }
          }
        }
      } else {
        // text ad — fixed 560×315
        vw = Math.min(availW, 560); vh = 315
      }

      setVideoW(Math.max(200, vw))
      setVideoH(Math.max(100, vh))
    }

    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [ad])

  if (!ad) return null

  const linkEntries = Object.entries(ad.links).filter(([, v]) => v)

  return (
    <div className={cn("relative w-full", className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full text-[11px] py-1 group"
      >
        <LiveBadge />
        <span className="text-gray-400 flex-shrink-0">Ads by</span>
        <span className="text-gray-600 group-hover:text-gray-800 transition-colors font-semibold flex-shrink-0">
          {ad.sponsorName}
        </span>
        {ad.tagline && (
          <span className="text-gray-400 italic truncate hidden sm:inline">· {ad.tagline}</span>
        )}
        <span className="ml-auto text-gray-400 font-mono tabular-nums flex-shrink-0">{countdown}</span>
        <span className="text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0 ml-1">
          {open ? "‹" : "›"}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/90"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Centered layout: panel + social links column */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="flex items-start gap-3 pointer-events-auto">

              {/* Panel — exact video width, no side padding */}
              <div
                className="flex flex-col bg-black rounded-xl shadow-xl overflow-hidden"
                style={{ width: videoW }}
              >

                {/* Body — no padding so content fills edge-to-edge */}
                <div className="overflow-hidden">
                  <AdContent ad={ad} maxBodyH={videoH} />
                </div>

              </div>

              {/* Right column — ads by, live status, countdown, social links */}
              <div className="flex flex-col items-center gap-3 self-center">
                {ad.sponsorName && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-white/60 uppercase tracking-wide">Ads by</span>
                    <span className="text-[10px] text-white font-semibold text-center leading-tight max-w-[60px] break-words">
                      {ad.sponsorName}
                    </span>
                  </div>
                )}
                <LiveBadge />
                {countdown && (
                  <span className="text-[10px] font-mono text-white/80 tabular-nums bg-black/30 rounded-md px-1.5 py-0.5 whitespace-nowrap">
                    {countdown}
                  </span>
                )}
                {linkEntries.map(([key, href]) => (
                  <a
                    key={key}
                    href={href as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={LINK_LABELS[key] ?? key}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white/90 shadow-md border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LINK_ICONS[key] ?? ""} alt={key} width={16} height={16} />
                  </a>
                ))}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── SponsorAdToggle — homepage, mobile: expands inline ────────────────────────

export function SponsorAdToggle({ className }: { className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const ad = useSponsorAd()

  if (!ad) return null

  return (
    <div className={cn("w-full", className)}>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 w-full text-[11px] py-1 group"
        >
          <span className="text-gray-400 flex-shrink-0">Ads by</span>
          <span className="text-gray-600 group-hover:text-gray-800 transition-colors truncate font-semibold">
            {ad.sponsorName}
          </span>
          <span className="ml-auto text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0">›</span>
        </button>
      ) : (
        <div className="rounded-xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
          {/* Header — tap to collapse */}
          <button
            onClick={() => setExpanded(false)}
            className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-100"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-gray-400 flex-shrink-0">Ads by</span>
              {ad.sponsorName && (
                <span className="text-[10px] text-indigo-600 font-semibold truncate">{ad.sponsorName}</span>
              )}
            </div>
            <LiveBadge />
          </button>
          {/* Content */}
          <div className="p-3">
            <AdContent ad={ad} />
          </div>

          {/* Footer */}
          <AdPanelFooter ad={ad} />
        </div>
      )}
    </div>
  )
}

// ── SponsorAdFloatingBar — fixed strip below topbar (purple, no layout shift) ──
// Sits at top-12 (below the h-12 topbar). Fixed so it never pushes content down.

export function SponsorAdFloatingBar() {
  const [open, setOpen] = useState(false)
  const ad = useSponsorAd()
  const countdown = useAdCountdown(ad?.endTime ?? 0)

  // Same dimension pre-computation as SponsorAdDesktopPopover
  const [videoW, setVideoW] = useState(360)
  const [videoH, setVideoH] = useState(480)

  useEffect(() => {
    function compute() {
      if (!ad) return
      const SOCIAL_W = 48
      const V_MARGIN = 32
      const H_MARGIN = 32
      const availW = Math.floor(window.innerWidth  - H_MARGIN - SOCIAL_W)
      const availH = Math.floor(window.innerHeight - V_MARGIN)

      let vw = availW, vh = availH

      if (ad.adType === "image") {
        const [rw, rh] = ad.ratio === "9:16" ? [9, 16] : ad.ratio === "1:1" ? [1, 1] : [16, 9]
        const maxW = (ad.ratio === "16:9" || ad.ratio === "1:1") ? Math.min(availW, 560) : availW
        vw = maxW; vh = Math.round(vw * rh / rw)
        if (vh > availH) { vh = availH; vw = Math.round(vh * rw / rh) }
      } else if (ad.adType === "embed" && ad.embedUrl) {
        const ct = urlToContentType(ad.embedUrl)
        if (!ct || ct === "twitter") {
          vw = Math.min(availW, 360); vh = availH
        } else if (ct === "spotify") {
          vw = Math.min(availW, 400); vh = Math.min(availH, 352)
        } else {
          const isVert = ct === "youtubeshorts" || ct === "tiktok"
          if (isVert) {
            vh = availH; vw = Math.round(vh * 9 / 16)
            if (vw > availW) { vw = availW; vh = Math.round(vw * 16 / 9) }
          } else {
            vw = Math.min(availW, 560); vh = Math.round(vw * 9 / 16)
            if (vh > availH) { vh = availH; vw = Math.round(vh * 16 / 9) }
          }
        }
      } else {
        // text ad — 16:9
        vw = Math.min(availW, 480); vh = Math.round(vw * 9 / 16)
        if (vh > availH) { vh = availH; vw = Math.round(vh * 16 / 9) }
      }

      setVideoW(Math.max(200, vw))
      setVideoH(Math.max(100, vh))
    }
    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [ad])

  if (!ad) return null

  const linkEntries = Object.entries(ad.links).filter(([, v]) => v)
  const isTwitterEmbed = ad.adType === "embed" && !!ad.embedUrl && urlToContentType(ad.embedUrl) === "twitter"
  const panelBg = isTwitterEmbed ? "bg-white" : "bg-black"

  return (
    <>
      {/* Fixed purple strip — no layout shift */}
      <div className="fixed top-12 left-0 right-0 z-40 bg-gradient-to-r from-sky-200 via-blue-100 to-sky-200 px-4 py-1.5">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center justify-center w-full text-[11px] group"
        >
          <span className="flex items-center gap-1.5">
            <LiveBadge />
            <span className="flex items-center gap-1 flex-shrink-0">
              <span className="text-sky-600">Ads by</span>
              <span className="text-sky-800 group-hover:text-sky-900 transition-colors font-semibold">{ad.sponsorName}</span>
            </span>
            {ad.tagline && (
              <span className="text-sky-500 italic truncate hidden sm:inline">· {ad.tagline}</span>
            )}
            <span className="text-sky-600 font-mono tabular-nums flex-shrink-0">{countdown}</span>
            <HiMiniArrowRight className="text-sky-400 group-hover:text-sky-600 transition-colors flex-shrink-0 w-3.5 h-3.5" />
          </span>
        </button>
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/90"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">

            {/* Mobile popup: top bar + content + bottom social icons */}
            <div className="xl:hidden flex flex-col pointer-events-auto">
              <div
                className={cn("flex flex-col rounded-xl shadow-xl overflow-hidden", panelBg)}
                style={{ width: videoW }}
              >
                {/* Top bar: Live + name + countdown */}
                <div className={cn("flex items-center justify-between px-3 py-2 flex-shrink-0", isTwitterEmbed ? "bg-black/5 border-b border-gray-100" : "bg-white/5")}>
                  <div className="flex items-center gap-2 min-w-0">
                    <LiveBadge />
                    {ad.sponsorName && (
                      <span className="flex items-center gap-1 min-w-0">
                        <span className={cn("text-[9px]", isTwitterEmbed ? "text-gray-400" : "text-white/60")}>Ads by</span>
                        <span className={cn("text-[10px] font-semibold truncate", isTwitterEmbed ? "text-gray-700" : "text-white")}>{ad.sponsorName}</span>
                      </span>
                    )}
                  </div>
                  {countdown && (
                    <span className={cn("text-[10px] font-mono tabular-nums whitespace-nowrap flex-shrink-0", isTwitterEmbed ? "text-gray-500" : "text-white/70")}>{countdown}</span>
                  )}
                </div>

                {/* Content */}
                <div className="overflow-hidden">
                  <AdContent ad={ad} maxBodyH={videoH} />
                </div>

                {/* Bottom: social icons, no background */}
                {linkEntries.length > 0 && (
                  <div className={cn("flex items-center justify-center gap-5 py-2.5 flex-shrink-0", isTwitterEmbed ? "bg-black/5 border-t border-gray-100" : "bg-white/5")}>
                    {linkEntries.map(([key, href]) => (
                      <a
                        key={key}
                        href={href as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={LINK_LABELS[key] ?? key}
                        className="flex items-center justify-center hover:opacity-70 transition-opacity"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={LINK_ICONS[key] ?? ""}
                          alt={key}
                          width={14}
                          height={14}
                          style={isTwitterEmbed ? undefined : { filter: "brightness(0) invert(1)" }}
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop popup: panel + right column */}
            <div className="hidden xl:flex items-start gap-3 pointer-events-auto">
              <div
                className={cn("flex flex-col rounded-xl shadow-xl overflow-hidden", panelBg)}
                style={{ width: videoW }}
              >
                <div className="overflow-hidden">
                  <AdContent ad={ad} maxBodyH={videoH} />
                </div>
              </div>

              {/* Right column */}
              <div className="flex flex-col items-center gap-3 self-center">
                {ad.sponsorName && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-white/60 uppercase tracking-wide">Ads by</span>
                    <span className="text-[10px] text-white font-semibold text-center leading-tight max-w-[60px] break-words">
                      {ad.sponsorName}
                    </span>
                  </div>
                )}
                <LiveBadge />
                {countdown && (
                  <span className="text-[10px] font-mono text-white/80 tabular-nums bg-black/30 rounded-md px-1.5 py-0.5 whitespace-nowrap">
                    {countdown}
                  </span>
                )}
                {linkEntries.map(([key, href]) => (
                  <a
                    key={key}
                    href={href as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={LINK_LABELS[key] ?? key}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white/90 shadow-md border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LINK_ICONS[key] ?? ""} alt={key} width={16} height={16} />
                  </a>
                ))}
              </div>
            </div>

          </div>
        </>
      )}
    </>
  )
}

// ── SponsorAdSidebar — auto-shown panel on non-homepage routes ────────────────
// Desktop only: fixed to the right of the content area. Hidden on mobile.
// Styled like the mobile homepage popup (dark panel, top bar, content, social icons).

const SIDEBAR_W = 315
const SIDEBAR_TOP = 72   // px below viewport top (topbar 48 + margin 24)
const TOPBAR_H   = 36   // top bar row inside panel
const SOCIAL_H   = 32   // social icons row (present or not, reserved)
const BOTTOM_PAD = 16   // breathing room at the bottom

export function SponsorAdSidebar() {
  const pathname = usePathname()
  const ad = useSponsorAd()
  const countdown = useAdCountdown(ad?.endTime ?? 0)

  // Compute available body height from viewport so the panel never overflows
  const [bodyH, setBodyH] = useState(200)
  useEffect(() => {
    function compute() {
      const avail = window.innerHeight - SIDEBAR_TOP - TOPBAR_H - SOCIAL_H - BOTTOM_PAD
      setBodyH(Math.max(100, avail))
    }
    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [])

  if (!ad || pathname === "/" || pathname.startsWith("/admin")) return null


  const linkEntries = Object.entries(ad.links).filter(([, v]) => v)
  const isTwitterEmbed = ad.adType === "embed" && !!ad.embedUrl && urlToContentType(ad.embedUrl) === "twitter"
  const panelBg = isTwitterEmbed ? "bg-white" : "bg-black"

  const panel = (
    <div className={cn("flex flex-col rounded-xl shadow-xl overflow-hidden w-[315px]", panelBg)}>
      {/* Top bar: Live + sponsor name + countdown */}
      <div className={cn(
        "flex items-center justify-between px-2.5 py-2 flex-shrink-0",
        isTwitterEmbed ? "bg-black/5 border-b border-gray-100" : "bg-white/5"
      )}>
        <div className="flex items-center gap-1.5 min-w-0">
          <LiveBadge />
          {ad.sponsorName && (
            <span className="flex items-center gap-1 min-w-0">
              <span className={cn("text-[9px]", isTwitterEmbed ? "text-gray-400" : "text-white/60")}>Ads by</span>
              <span className={cn("text-[9px] font-semibold truncate", isTwitterEmbed ? "text-gray-700" : "text-white")}>
                {ad.sponsorName}
              </span>
            </span>
          )}
        </div>
        {countdown && (
          <span className={cn(
            "text-[9px] font-mono tabular-nums whitespace-nowrap flex-shrink-0 ml-1",
            isTwitterEmbed ? "text-gray-500" : "text-white/70"
          )}>
            {countdown}
          </span>
        )}
      </div>

      {/* Content — modal mode for pixel-exact embed sizing */}
      <div className="overflow-hidden">
        <AdContent ad={ad} maxBodyH={bodyH} />
      </div>

      {/* Bottom social icons */}
      {linkEntries.length > 0 && (
        <div className={cn(
          "flex items-center justify-center gap-4 py-2 flex-shrink-0",
          isTwitterEmbed ? "bg-black/5 border-t border-gray-100" : "bg-white/5"
        )}>
          {linkEntries.map(([key, href]) => (
            <a
              key={key}
              href={href as string}
              target="_blank"
              rel="noopener noreferrer"
              title={LINK_LABELS[key] ?? key}
              className="flex items-center justify-center hover:opacity-70 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={LINK_ICONS[key] ?? ""}
                alt={key}
                width={14}
                height={14}
                style={isTwitterEmbed ? undefined : { filter: "brightness(0) invert(1)" }}
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed top-[72px] z-50 hidden xl:block" style={{ left: "calc(50% + 325px)" }}>
      {panel}
    </div>
  )
}

