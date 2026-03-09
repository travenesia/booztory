"use client"

import type React from "react"

import { useState, useEffect, useRef, memo } from "react"
import { extractTikTokId } from "@/lib/tiktokMetadata"

interface TikTokEmbedProps {
  url: string
  isPreview?: boolean
  responsive?: boolean
  aspectRatio?: "16:9" | "9:16"
}

export const TikTokEmbed = memo(function TikTokEmbed({ url, isPreview = false, responsive = false, aspectRatio = "9:16" }: TikTokEmbedProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const id = extractTikTokId(url)
      if (id) {
        setVideoId(id)
        setError(null)
      } else {
        setError("Invalid TikTok URL")
      }
    } catch (err) {
      setError("Error processing TikTok URL")
      console.error("Error processing TikTok URL:", err)
    }
  }, [url])

  // Monitor container for size changes
  useEffect(() => {
    if (containerRef.current && responsive) {
      // Get initial container width
      setContainerWidth(containerRef.current.clientWidth)

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width
          const height = entry.contentRect.height

          if (width > 0) {
            setContainerWidth(width)
          }

          if (height > 0) {
            setContentHeight(height)
          }
        }
      })

      resizeObserver.observe(containerRef.current)
      return () => resizeObserver.disconnect()
    }
  }, [responsive])

  // Update the getContainerProps function to better handle viewport scaling

  // Replace the getContainerProps function with this improved version:
  const getContainerProps = () => {
    // Base container classes for all modes
    let classes = "relative overflow-hidden rounded-t-md bg-elegance-ethereal-ivory"
    let styles: React.CSSProperties = {}

      if (isPreview) {
      // Preview mode: size container to match the actual video aspect ratio
      const ratio = aspectRatio === "16:9" ? 16 / 9 : 9 / 16
      const previewHeight = 200
      const width = previewHeight * ratio
      styles = {
        maxHeight: `${previewHeight}px`,
        height: `${previewHeight}px`,
        width: `${width}px`,
        margin: "0 auto",
      }
    } else if (!responsive) {
      // Fixed aspect ratio mode
      classes += aspectRatio === "16:9" ? " aspect-video" : " aspect-[9/16]"
    } else {
      // Responsive mode - maintain aspect ratio but fill container
      styles = {
        width: "100%",
        height: "100%",
      }
    }

    return { className: classes, style: styles }
  }

  if (!videoId) {
    return (
      <div
        className="bg-elegance-ethereal-ivory rounded-md flex items-center justify-center p-4"
        style={{ height: "200px" }}
      >
        {error ? <p className="text-red-500">{error}</p> : <p className="text-gray-500">Loading TikTok video...</p>}
      </div>
    )
  }

  const containerProps = getContainerProps()

  // Use the direct player URL with parameters for autoplay, loop, and mute
  const playerUrl = `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=1&mute=0`

  return (
    <div ref={containerRef} {...containerProps}>
      <div className="absolute inset-0 w-full h-full">
        <iframe
          src={playerUrl}
          allowFullScreen
          allow="autoplay; encrypted-media"
          title="TikTok video player"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  )
})
