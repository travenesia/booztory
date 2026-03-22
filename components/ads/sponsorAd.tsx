"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import type React from "react"
import { useReadContract, useReadContracts } from "wagmi"
import { usePathname } from "next/navigation"
import { RAFFLE_ADDRESS, RAFFLE_ABI } from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"
import { ContentEmbed } from "@/components/content/contentEmbed"
import { cn } from "@/lib/utils"
import { X, Megaphone } from "lucide-react"

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
      setDisplay(`${d}:${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`)
    }
    calc()
    const id = setInterval(calc, 1_000)
    return () => clearInterval(id)
  }, [endTime])

  return display
}

// ── AdContent — main ad body (image / embed / text) ──────────────────────────

// maxBodyH is passed from the modal — measured from window, not the container itself.
// This avoids the chicken-and-egg problem where measuring h-full gives the forced
// panel height rather than the content's natural height.
function AdContent({ ad, maxBodyH }: { ad: ActiveAd; maxBodyH?: number }) {
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

        {ad.adType === "text" && ad.text && (
          <div className="text-center px-6 py-4">
            {ad.sponsorName && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {ad.sponsorName}
              </p>
            )}
            <p className="text-sm font-semibold text-gray-800 leading-snug">
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
          className="w-full rounded-lg object-cover"
          style={{
            aspectRatio: ad.ratio === "9:16" ? "9/16" : ad.ratio === "1:1" ? "1/1" : "16/9",
            maxHeight: "260px",
          }}
        />
      )}

      {ad.adType === "embed" && ad.embedUrl && (() => {
        const ct = urlToContentType(ad.embedUrl)
        if (!ct) return null
        const isVertical = ct === "youtubeshorts" || ct === "tiktok"
        return (
          <div
            className="rounded-lg overflow-hidden"
            style={{ aspectRatio: isVertical ? "9/16" : "16/9", maxHeight: "260px" }}
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
        <div className="text-center py-3 px-2">
          {ad.sponsorName && (
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              {ad.sponsorName}
            </p>
          )}
          <p className="text-sm font-semibold text-gray-800 leading-snug">
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

  // Available body height = viewport - modal margins(96) - header(44) - footer(44) - body padding(2)
  const [maxBodyH, setMaxBodyH] = useState(400)
  useEffect(() => {
    const update = () => setMaxBodyH(Math.max(100, window.innerHeight - 186))
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  if (!ad) return null

  return (
    <div className={cn("relative w-full", className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full text-[11px] py-1 group"
      >
        <Megaphone size={11} className="text-indigo-400 flex-shrink-0" />
        <span className="font-bold text-indigo-400 uppercase tracking-wide">Sponsored</span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-500 group-hover:text-gray-700 transition-colors truncate">
          {ad.sponsorName}
        </span>
        <span className="ml-auto text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0">
          {open ? "‹" : "›"}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Modal — auto-height, centered in viewport with 48px clearance all sides */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-12 pointer-events-none">
            <div
              className="w-full max-w-lg pointer-events-auto bg-white rounded-xl shadow-xl overflow-hidden flex flex-col"
              style={{ maxHeight: "calc(100vh - 96px)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Megaphone size={12} className="text-indigo-400 flex-shrink-0" />
                  <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide flex-shrink-0">Sponsored</span>
                  {ad.sponsorName && (
                    <span className="text-[11px] text-indigo-600 font-semibold truncate">· {ad.sponsorName}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  {countdown && (
                    <span className="text-[11px] font-mono text-indigo-400 tabular-nums">{countdown}</span>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close ad"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Body — auto-height, sized by fittedStyle inside AdContent */}
              <div className="overflow-hidden p-1">
                <AdContent ad={ad} maxBodyH={maxBodyH} />
              </div>

              {/* Footer */}
              <AdPanelFooter ad={ad} />
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
          <Megaphone size={11} className="text-indigo-400 flex-shrink-0" />
          <span className="font-bold text-indigo-400 uppercase tracking-wide">Sponsored</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500 group-hover:text-gray-700 transition-colors truncate">
            {ad.sponsorName}
          </span>
          <span className="ml-auto text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0">›</span>
        </button>
      ) : (
        <div className="rounded-xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-center gap-1.5 min-w-0">
              <Megaphone size={11} className="text-indigo-400 flex-shrink-0" />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide flex-shrink-0">
                Sponsored · {ad.durationDays}d
              </span>
              {ad.sponsorName && (
                <span className="text-[10px] text-indigo-600 font-semibold truncate">· {ad.sponsorName}</span>
              )}
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
              aria-label="Close ad"
            >
              <X size={13} />
            </button>
          </div>
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

// ── SponsorAdSidebar — left + right pills on desktop, bottom-right on mobile ───
// Shown on all non-homepage routes. Clicking any pill opens a floating popup.

export function SponsorAdSidebar() {
  const pathname = usePathname()
  const [open, setOpen]   = useState(false)
  const [side, setSide]   = useState<"left" | "right" | "mobile">("right")
  const ad = useSponsorAd()
  const countdown = useAdCountdown(ad?.endTime ?? 0)

  if (!ad || pathname === "/") return null

  function toggle(s: typeof side) {
    if (open && side === s) { setOpen(false) } else { setSide(s); setOpen(true) }
  }

  const pillClass = "flex flex-col items-center gap-1.5 bg-white border border-indigo-100 rounded-lg px-2 py-3 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
  const pillLabel = (
    <>
      <Megaphone size={12} className="text-indigo-400" />
      <span
        className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        Sponsored
      </span>
    </>
  )

  const Popup = (
    <div className="w-44 bg-white border border-indigo-100 rounded-xl shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-2 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-1 min-w-0">
          <Megaphone size={10} className="text-indigo-400 flex-shrink-0" />
          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide flex-shrink-0">Sponsored</span>
          {ad.sponsorName && (
            <span className="text-[9px] text-indigo-600 font-semibold truncate ml-1">· {ad.sponsorName}</span>
          )}
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-1" aria-label="Close ad">
          <X size={12} />
        </button>
      </div>
      {countdown && (
        <div className="px-2.5 pt-1.5 pb-0">
          <span className="text-[9px] font-mono text-indigo-400 tabular-nums">{countdown}</span>
        </div>
      )}
      <div className="p-2.5">
        <AdContent ad={ad} />
      </div>

      {/* Footer */}
      <AdPanelFooter ad={ad} small />
    </div>
  )

  return (
    <>
      {/* Backdrop — click outside any pill/popup to close */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />}

      {/* Left pill (desktop) — popup floats to the right of it */}
      <div className="fixed top-24 z-50 hidden xl:block" style={{ right: "calc(50% + 341px)" }}>
        <button onClick={() => toggle("left")} className={pillClass} aria-label="Show sponsor">
          {pillLabel}
        </button>
        {open && side === "left" && (
          <div className="absolute top-0 left-full ml-2">{Popup}</div>
        )}
      </div>

      {/* Right pill (desktop) — popup floats to the left of it */}
      <div className="fixed top-24 z-50 hidden xl:block" style={{ left: "calc(50% + 341px)" }}>
        <button onClick={() => toggle("right")} className={pillClass} aria-label="Show sponsor">
          {pillLabel}
        </button>
        {open && side === "right" && (
          <div className="absolute top-0 right-full mr-2">{Popup}</div>
        )}
      </div>

      {/* Mobile — floating pill bottom-right, popup floats above it */}
      <div className="fixed bottom-20 right-4 z-50 xl:hidden">
        <button onClick={() => toggle("mobile")} className={pillClass} aria-label="Show sponsor">
          {pillLabel}
        </button>
        {open && side === "mobile" && (
          <div className="absolute bottom-full right-0 mb-2">{Popup}</div>
        )}
      </div>
    </>
  )
}

