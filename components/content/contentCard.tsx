"use client"

import type React from "react"
import { ContentEmbed } from "./contentEmbed"
import { ContentStats } from "./contentStats"
import { useState, useEffect, useRef } from "react"
import { DonationModal } from "@/components/modals/donationModal"
import { useWalletName } from "@/hooks/useWalletName"

type ContentType = "youtube" | "tiktok" | "twitter" | "vimeo" | "spotify"

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

  const resolvedWalletName = useWalletName(submittedBy)

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

  const getEmbedAreaStyle = (): React.CSSProperties => {
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
  }

  const embedAreaStyle = getEmbedAreaStyle()

  const cardContainerStyle: React.CSSProperties = {
    width: contentType === "twitter" ? `${Math.min(containerWidth || 380, 380)}px` : embedAreaStyle.width,
    maxWidth: "100%",
    margin: "0 auto",
  }

  // Display name: wallet identity (Basename → ENS → truncated address)
  const displayUsername = isPlaceholder ? "Booztory" : (resolvedWalletName || username || "Unknown User")
  const displayDonations = Math.max(0, donations || 0)

  const handleDonationClick = () => {
    if (!isConnected) {
      alert("Connect Wallet First to donate.")
      return
    }
    setIsDonationModalOpen(true)
  }

  const creatorAddress = (submittedBy || "0x4FA414F690034Fd370Cb404668d4d8029a6e2772") as `0x${string}`
  const donationTokenId = tokenId ?? 0n

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
            {contentUrl && !isPlaceholder ? (
              <ContentEmbed
                key={`embed-${contentType}-${contentUrl}-${embedAreaStyle.width}-${embedAreaStyle.height}`}
                contentType={contentType}
                contentUrl={contentUrl}
                aspectRatio={aspectRatio}
                responsive={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-25">
                {isPlaceholder ? (
                  <div className="text-center p-4">
                    <h1 className="text-xl font-medium mb-2 text-gray-900">Welcome to Booztory</h1>
                    <p className="text-sm text-gray-700">Submit your content to get featured here!</p>
                    <p className="text-xs text-gray-500 mt-2">You can support the platform by donating.</p>
                  </div>
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
        tokenId={donationTokenId}
      />
    </div>
  )
}
