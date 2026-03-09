"use client"

import type React from "react"

import { useState, useEffect, useRef, memo } from "react"
import { extractYouTubeId, isYouTubeShort } from "@/lib/youtubeMetadata"

interface YouTubeEmbedProps {
  url: string
  aspectRatio: "16:9" | "9:16"
  isPreview?: boolean
  responsive?: boolean
}

export const YouTubeEmbed = memo(function YouTubeEmbed({
  url,
  aspectRatio,
  isPreview = false,
  responsive = false,
}: YouTubeEmbedProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isShort, setIsShort] = useState(false)

  useEffect(() => {
    try {
      const id = extractYouTubeId(url)
      if (id) {
        setVideoId(id)
        setError(null)
        // Improved detection for YouTube Shorts
        const isYoutubeShort = isYouTubeShort(url) || url.includes("shorts") || aspectRatio === "9:16"
        setIsShort(isYoutubeShort)
      } else {
        setError("Invalid YouTube URL")
      }
    } catch (err) {
      setError("Error processing YouTube URL")
      console.error("Error processing YouTube URL:", err)
    }
  }, [url, aspectRatio])

  // Monitor container for height changes if responsive
  useEffect(() => {
    if (containerRef.current && responsive) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height
          if (height > 0) {
            setContentHeight(height)
          }
        }
      })

      resizeObserver.observe(containerRef.current)
      return () => resizeObserver.disconnect()
    }
  }, [responsive])

  // Determine container classes and styles
  const getContainerProps = () => {
    // Base container classes for all modes
    let classes = "relative overflow-hidden rounded-t-md bg-elegance-ethereal-ivory"
    let styles: React.CSSProperties = {}

    // Determine if it's a short based on URL or aspect ratio
    const effectiveAspectRatio = isShort ? "9:16" : "16:9"

    if (isPreview) {
      // Preview mode with constrained dimensions
      if (effectiveAspectRatio === "9:16") {
        const width = 200 * (9 / 16) // ~112.5px
        styles = {
          maxHeight: "200px",
          height: "200px",
          width: `${width}px`,
          margin: "0 auto",
        }
      } else {
        const height = Math.min(200, (window.innerWidth - 32) * (9 / 16))
        styles = {
          height: `${height}px`,
          width: "100%",
        }
      }
    } else if (!responsive) {
      // Fixed aspect ratio mode
      classes += ` ${effectiveAspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16]"}`
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
        {error ? <p className="text-red-500">{error}</p> : <p className="text-gray-500">Loading YouTube video...</p>}
      </div>
    )
  }

  const containerProps = getContainerProps()

  return (
    <div ref={containerRef} {...containerProps}>
      <div className="absolute inset-0 w-full h-full">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?playsinline=1`}
          title="YouTube video player"
          width="100%"
          height="100%"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  )
})
