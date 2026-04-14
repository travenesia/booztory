"use client"

import type React from "react"
import { ContentEmbed } from "./contentEmbed"
import { ContentStats } from "./contentStats"
import { useState, useEffect, useRef, useMemo } from "react"
import { DonationModal } from "@/components/modals/donationModal"
import { useIdentity } from "@/hooks/useIdentity"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI } from "@/lib/contract"
import { useReadContracts } from "wagmi"
import { APP_CHAIN, WORLD_CHAIN } from "@/lib/wagmi"
import { isWorldApp } from "@/lib/miniapp-flag"
import { WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI } from "@/lib/contractWorld"
import { ShineBorder } from "@/components/ui/shine-border"
import { UsersOnline } from "@/components/layout/usersOnline"

type ContentType = "youtube" | "youtubeshorts" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch" | "text"

interface ContentCardProps {
  username: string
  contentType: ContentType
  imageUrl: string
  timeLeft: number
  donations: number
  aspectRatio: "16:9" | "9:16"
  contentUrl?: string
  isPlaceholder?: boolean
  endTime?: number
  isConnected: boolean
  tokenId?: bigint
  submittedBy?: string
  authorName?: string
}

export function ContentCard({
  username,
  contentType,
  imageUrl,
  timeLeft,
  donations,
  aspectRatio,
  contentUrl,
  isPlaceholder = false,
  endTime,
  isConnected,
  tokenId,
  submittedBy,
  authorName,
}: ContentCardProps) {
  const [remainingTime, setRemainingTime] = useState(timeLeft)
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const inWorldApp = isWorldApp()
  const pAddress = inWorldApp ? WORLD_BOOZTORY_ADDRESS : BOOZTORY_ADDRESS
  const pAbi     = inWorldApp ? WORLD_BOOZTORY_ABI     : BOOZTORY_ABI
  const pChain   = inWorldApp ? WORLD_CHAIN.id          : APP_CHAIN.id

  const { data: contractInfo } = useReadContracts({
    contracts: [
      { address: pAddress, abi: pAbi, functionName: "slotPrice", chainId: pChain },
      { address: pAddress, abi: pAbi, functionName: "slotDuration", chainId: pChain },
    ],
    query: { enabled: isPlaceholder },
  })
  const slotPriceDisplay = contractInfo?.[0].result
    ? (Number(contractInfo[0].result as bigint) / 1_000_000).toFixed(2)
    : "1.00"
  const slotDurationSecs = Number(contractInfo?.[1].result ?? 900n)
  const slotDurationDisplay = slotDurationSecs >= 3600
    ? `${slotDurationSecs / 3600} hour${slotDurationSecs / 3600 !== 1 ? "s" : ""}`
    : `${slotDurationSecs / 60} minutes`
  const isDurationPromo = slotDurationSecs !== 900
  const isPricePromo = Number(contractInfo?.[0].result ?? 1_000_000n) !== 1_000_000

  const { displayName: resolvedWalletName } = useIdentity(submittedBy)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateWidth = () => setContainerWidth(el.clientWidth)
    updateWidth()
    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (isPlaceholder) {
      setRemainingTime(9999)
      return
    }

    const calculate = () => {
      if (endTime) {
        return Math.max(0, endTime - Date.now()) / 60000
      }
      return timeLeft
    }

    setRemainingTime(calculate())

    let lastTick = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      // Detect resume from suspension (>2s gap)
      if (now - lastTick > 2000 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("contentRefreshNeeded"))
      }
      lastTick = now
      setRemainingTime(calculate())
    }, 1000)

    const handleVisibilityChange = () => {
      if (!document.hidden) setRemainingTime(calculate())
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [endTime, isPlaceholder, timeLeft])

  const embedAreaStyle = useMemo((): React.CSSProperties => {
    if (typeof window === "undefined" || containerWidth === null || containerWidth === 0) {
      return { width: "100%", maxWidth: "320px", height: "200px", margin: "0 auto" }
    }

    const topbarHeight = 48
    const navbarHeight = 48
    const sectionPaddingTop = 16
    const sectionPaddingBottom = 16
    const contentStatsHeight = 32

    const availableCardHeight =
      window.innerHeight - topbarHeight - navbarHeight - sectionPaddingTop - sectionPaddingBottom
    const maxEmbedAreaHeight = Math.max(150, availableCardHeight - contentStatsHeight)

    let calculatedWidth: number
    let calculatedHeight: number

    if (contentType === "twitter") {
      return {
        width: "100%",
        height: "auto",
        minHeight: "150px",
        maxHeight: `${maxEmbedAreaHeight}px`,
        overflowY: "auto",
        margin: "0 auto",
      }
    }

    if (contentType === "spotify") {
      calculatedWidth = containerWidth
      if (maxEmbedAreaHeight >= 352) {
        calculatedHeight = 352
      } else if (maxEmbedAreaHeight >= 152) {
        calculatedHeight = 152
      } else {
        calculatedHeight = maxEmbedAreaHeight
      }
      calculatedHeight = Math.max(152, calculatedHeight)
      calculatedWidth = Math.max(100, calculatedWidth)
      return { height: `${calculatedHeight}px`, width: `${calculatedWidth}px`, margin: "0 auto" }
    }

    const currentAspectRatioValue = aspectRatio === "9:16" ? 9 / 16 : 16 / 9

    if (aspectRatio === "9:16") {
      calculatedHeight = maxEmbedAreaHeight
      calculatedWidth = calculatedHeight * currentAspectRatioValue
      if (calculatedWidth > containerWidth) {
        calculatedWidth = containerWidth
        calculatedHeight = calculatedWidth / currentAspectRatioValue
        calculatedHeight = Math.min(calculatedHeight, maxEmbedAreaHeight)
      }
    } else {
      calculatedWidth = containerWidth
      calculatedHeight = calculatedWidth / currentAspectRatioValue
      if (calculatedHeight > maxEmbedAreaHeight) {
        calculatedHeight = maxEmbedAreaHeight
        calculatedWidth = calculatedHeight * currentAspectRatioValue
        calculatedWidth = Math.min(calculatedWidth, containerWidth)
      }
    }

    calculatedHeight = Math.max(150, calculatedHeight)
    calculatedWidth = Math.max(100, calculatedWidth)

    return { height: `${calculatedHeight}px`, width: `${calculatedWidth}px`, margin: "0 auto" }
  }, [containerWidth, contentType, aspectRatio])

  const cardContainerStyle: React.CSSProperties = {
    width: contentType === "twitter" ? `${Math.min(containerWidth || 380, 380)}px` : embedAreaStyle.width,
    maxWidth: "100%",
    margin: "0 auto",
  }

  // Display name: wallet identity (Basename → ENS → truncated address)
  const displayUsername = isPlaceholder ? "@Booztory" : (resolvedWalletName || username || "Unknown User")
  const displayDonations = Math.max(0, donations || 0)

  const handleDonationClick = () => {
    if (!isConnected) {
      alert("Connect Wallet First to donate.")
      return
    }
    setIsDonationModalOpen(true)
  }

  const creatorAddress = (isPlaceholder ? BOOZTORY_ADDRESS : (submittedBy || BOOZTORY_ADDRESS)) as `0x${string}`

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full">
      <div className="overflow-hidden bg-gray-0 flex flex-col rounded-t-[5px]" style={cardContainerStyle}>
        <div className="p-0">
          <div
            className="overflow-hidden bg-gray-0"
            style={{
              ...embedAreaStyle,
              position: "relative",
              borderTopLeftRadius: "5px",
              borderTopRightRadius: "5px",
            }}
          >
            {/* Users Online overlay */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 bg-green-50/90 backdrop-blur-sm rounded-b-lg px-3 h-[12px] flex items-center">
              <UsersOnline />
            </div>

            {contentUrl && !isPlaceholder ? (
              <ContentEmbed
                key={`embed-${contentType}-${contentUrl}`}
                contentType={contentType}
                contentUrl={contentUrl}
                aspectRatio={aspectRatio}
                responsive={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-25 relative overflow-hidden rounded-t-[5px]">
                {isPlaceholder ? (
                  <>
                    <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
                    <div className="text-center p-3 md:p-4 space-y-1.5 md:space-y-2 w-full max-w-full overflow-hidden">
                      <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 leading-tight">Welcome to Booztory</h1>
                      <p className="text-xs md:text-sm text-gray-600 flex items-center justify-center flex-wrap gap-x-1">
                        The on-chain content spotlight on{" "}
                        <span className="inline-flex items-center gap-1 font-bold"><img src="/base.svg" alt="" className="h-[1em] w-auto" />Base</span>
                        {" "}
                        <span className="inline-flex items-center gap-1 font-bold"><img src="/world.svg" alt="" className="h-[1em] w-auto" />World</span>
                      </p>
                      <p className="text-[10px] md:text-sm text-gray-700 whitespace-nowrap md:whitespace-normal">
                        Pay <span className="font-bold">{slotPriceDisplay} USDC</span>
                        {isPricePromo && <>{" "}<span className="inline-block text-[8px] font-bold text-orange-500 border border-orange-400 rounded px-1 py-0.5 leading-none align-super">LIMITED</span></>}{" "}
                        to feature your content for <span className="font-bold">{slotDurationDisplay}</span>
                        {isDurationPromo && <>{" "}<span className="inline-block text-[8px] font-bold text-orange-500 border border-orange-400 rounded px-1 py-0.5 leading-none align-super">LIMITED</span></>}
                      </p>
                      <div className="flex items-center justify-center flex-wrap gap-2 md:gap-3 py-2 md:py-3">
                        {[
                          { src: "/social/youtube.svg",       alt: "YouTube"        },
                          { src: "/social/youtubeshorts.svg", alt: "YouTube Shorts" },
                          { src: "/social/x.svg",             alt: "X"              },
                          { src: "/social/tiktok.svg",        alt: "TikTok"         },
                          { src: "/social/spotify.svg",       alt: "Spotify"        },
                          { src: "/social/vimeo.svg",         alt: "Vimeo"          },
                          { src: "/social/twitch.svg",        alt: "Twitch"         },
                        ].map(({ src, alt }) => (
                          <img key={alt} src={src} alt={alt} title={alt} className="w-4 h-4 md:w-5 md:h-5 object-contain" />
                        ))}
                      </div>
                      <p className="text-[11px] md:text-xs text-gray-500 italic">
                        No queue? Your content goes live <span className="font-semibold not-italic">instantly</span>.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-sm text-gray-700">Content preview not available.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ width: "100%" }}>
          <ContentStats
            timeLeft={isPlaceholder ? 9999 : remainingTime}
            donations={displayDonations}
            username={displayUsername}
            isPlaceholder={isPlaceholder}
            onDonationClick={handleDonationClick}
            isConnected={isConnected}
          />
        </div>
      </div>
      <DonationModal
        open={isDonationModalOpen}
        onOpenChange={setIsDonationModalOpen}
        username={displayUsername}
        creatorAddress={creatorAddress}
        tokenId={tokenId}
      />
    </div>
  )
}
