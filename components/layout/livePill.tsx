"use client"

import React, { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useReadContract } from "wagmi"
import { RAFFLE_ADDRESS, RAFFLE_ABI } from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"
import { isWorldApp } from "@/lib/miniapp-flag"
import {
  useSponsorAd,
  AdContent,
  useAdCountdown,
  LiveBadge,
} from "@/components/ads/sponsorAd"
import { cn } from "@/lib/utils"
import { HiTicket, HiSpeakerWave } from "react-icons/hi2"

const LINK_ICONS: Record<string, string> = {
  website:  "/social/web.svg",
  x:        "/social/x.svg",
  discord:  "/social/discord.svg",
  telegram: "/social/telegram.svg",
}

function urlToContentType(url: string) {
  if (url.includes("youtube.com/shorts/")) return "youtubeshorts"
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
  if (url.includes("tiktok.com")) return "tiktok"
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter"
  if (url.includes("vimeo.com")) return "vimeo"
  if (url.includes("spotify.com")) return "spotify"
  if (url.includes("twitch.tv")) return "twitch"
  return null
}

export function LivePill() {
  const router  = useRouter()
  const pathname = usePathname()
  const isHomepage = pathname === "/"

  const ad = useSponsorAd()
  const countdown = useAdCountdown(ad?.endTime ?? 0)
  const [adOpen, setAdOpen] = useState(false)

  // Compute video dimensions for the popup — same logic as SponsorAdFloatingBar
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
        const [rw, rh] = ad.ratio === "9:16" ? [9, 16] : ad.ratio === "4:5" ? [4, 5] : ad.ratio === "1:1" ? [1, 1] : [16, 9]
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

  const { data: activeRaffleIdsRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getActiveRaffles",
    chainId: APP_CHAIN.id,
    query: { enabled: !isWorldApp(), refetchInterval: 30_000 },
  })
  const hasLiveRaffle = ((activeRaffleIdsRaw as bigint[] | undefined) ?? []).length > 0
  const hasLiveAd = !!ad

  // On homepage, ads are already shown via SponsorAdFloatingBar — hide Live Ads pill there
  const showAd = hasLiveAd && !isHomepage

  if (!hasLiveRaffle && !showAd) return null

  const linkEntries = ad ? Object.entries(ad.links).filter(([, v]) => v) : []
  const isTwitterEmbed = ad?.adType === "embed" && !!ad.embedUrl && urlToContentType(ad.embedUrl) === "twitter"
  const panelBg = isTwitterEmbed ? "bg-white" : "bg-black"

  // With writing-mode:vertical-rl + rotate(180deg), DOM order is visually reversed:
  // last DOM child → top, first DOM child → bottom.
  // Target visual (top→bottom): dot · "Live" · "Raffle"/"Ads" · icon
  // So DOM order must be:        icon · "Raffle"/"Ads" · "Live" · dot
  const tabStyle: React.CSSProperties = { writingMode: "vertical-rl", transform: "rotate(180deg)" }

  // Pulsing green dot — reset writing-mode so the ping animation is unaffected
  const LiveDot = () => (
    <span className="relative flex h-1.5 w-1.5 flex-shrink-0" style={{ writingMode: "horizontal-tb" }}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
    </span>
  )

  return (
    <>
      {/* ── Floating pill tabs ── */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col pointer-events-none">
        {hasLiveRaffle && (
          <button
            onClick={() => router.push("/reward")}
            className={cn("pointer-events-auto flex items-center justify-center rounded-none py-3 px-2.5 bg-red-600 hover:bg-red-700 text-white transition-colors shadow-md", isHomepage && "hidden md:flex")}
            aria-label="Live Raffle"
          >
            <div className="flex items-center gap-1.5" style={tabStyle}>
              <LiveDot />
              <span className="text-[12px] font-semibold leading-none opacity-80">Live</span>
              <span className="text-[12px] font-bold tracking-wide uppercase leading-none">Raffle</span>
              <HiTicket className="w-3.5 h-3.5 flex-shrink-0" style={{ transform: "rotate(90deg)" }} />
            </div>
          </button>
        )}
        {showAd && (
          <button
            onClick={() => setAdOpen(true)}
            className="pointer-events-auto flex items-center justify-center rounded-none py-3 px-2.5 bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-md"
            aria-label="Live Ads"
          >
            <div className="flex items-center gap-1.5" style={tabStyle}>
              <LiveDot />
              <span className="text-[12px] font-semibold leading-none opacity-80">Live</span>
              <span className="text-[12px] font-bold tracking-wide uppercase leading-none">Ads</span>
              <HiSpeakerWave className="w-3.5 h-3.5 flex-shrink-0" style={{ transform: "rotate(90deg)" }} />
            </div>
          </button>
        )}
      </div>

      {/* ── Ad popup modal (same layout as SponsorAdFloatingBar popup) ── */}
      {adOpen && showAd && ad && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/90"
            onClick={() => setAdOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">

            {/* Mobile popup */}
            <div className="xl:hidden flex flex-col pointer-events-auto">
              <div
                className={cn("flex flex-col rounded-xl shadow-xl overflow-hidden", panelBg)}
                style={{ width: videoW }}
              >
                <div className={cn("flex items-center justify-between px-3 py-2 flex-shrink-0", isTwitterEmbed ? "bg-black/5 border-b border-gray-100" : "bg-white/5")}>
                  <div className="flex items-center gap-2 min-w-0">
                    <LiveBadge />
                    {ad.sponsorName && (
                      <span className="flex items-center gap-1 min-w-0">
                        <span className={cn("text-[12px]", isTwitterEmbed ? "text-gray-400" : "text-white/60")}>Ads by</span>
                        <span className={cn("text-[10px] font-semibold truncate", isTwitterEmbed ? "text-gray-700" : "text-white")}>{ad.sponsorName}</span>
                      </span>
                    )}
                  </div>
                  {countdown && (
                    <span className={cn("text-[10px] font-mono tabular-nums whitespace-nowrap flex-shrink-0", isTwitterEmbed ? "text-gray-500" : "text-white/70")}>{countdown}</span>
                  )}
                </div>
                <div className="overflow-hidden">
                  <AdContent ad={ad} maxBodyH={videoH} />
                </div>
                {linkEntries.length > 0 && (
                  <div className={cn("flex items-center justify-center gap-5 py-2.5 flex-shrink-0", isTwitterEmbed ? "bg-black/5 border-t border-gray-100" : "bg-white/5")}>
                    {linkEntries.map(([key, href]) => (
                      <a key={key} href={href as string} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center hover:opacity-70 transition-opacity">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={LINK_ICONS[key] ?? ""} alt={key} width={14} height={14}
                          style={isTwitterEmbed ? undefined : { filter: "brightness(0) invert(1)" }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop popup */}
            <div className="hidden xl:flex items-start gap-3 pointer-events-auto">
              <div
                className={cn("flex flex-col rounded-xl shadow-xl overflow-hidden", panelBg)}
                style={{ width: videoW }}
              >
                <div className="overflow-hidden">
                  <AdContent ad={ad} maxBodyH={videoH} />
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 self-center">
                {ad.sponsorName && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[12px] text-white/60 uppercase tracking-wide">Ads by</span>
                    <span className="text-[10px] text-white font-semibold text-center leading-tight max-w-[60px] break-words">{ad.sponsorName}</span>
                  </div>
                )}
                <LiveBadge />
                {countdown && (
                  <span className="text-[10px] font-mono text-white/80 tabular-nums bg-black/30 rounded-md px-1.5 py-0.5 whitespace-nowrap">{countdown}</span>
                )}
                {linkEntries.map(([key, href]) => (
                  <a key={key} href={href as string} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white/90 shadow-md border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all">
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
