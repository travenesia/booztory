"use client"

import type React from "react"

import { useState, useEffect, useRef, memo } from "react"
import { extractVimeoId } from "@/lib/vimeoMetadata"

interface VimeoEmbedProps {
  url: string
  aspectRatio: "16:9" | "9:16"
  isPreview?: boolean
  responsive?: boolean
}

export const VimeoEmbed = memo(function VimeoEmbed({
  url,
  aspectRatio,
  isPreview = false,
  responsive = false,
}: VimeoEmbedProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const id = extractVimeoId(url)
      if (id) {
        setVideoId(id)
        setError(null)
      } else {
        setError("Invalid Vimeo URL")
      }
    } catch (err) {
      setError("Error processing Vimeo URL")
      console.error("Error processing Vimeo URL:", err)
    }
  }, [url])

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

    // Vimeo videos are typically 16:9
    const effectiveAspectRatio = "16:9"

    if (isPreview) {
      // Preview mode with constrained dimensions
      const height = Math.min(200, (window.innerWidth - 32) * (9 / 16))
      styles = {
        height: `${height}px`,
        width: "100%",
      }
    } else if (!responsive) {
      // Fixed aspect ratio mode
      classes += " aspect-video"
    } else if (contentHeight) {
      // Responsive mode with known height
      styles = { height: `${contentHeight}px` }
    } else {
      // Default responsive mode
      classes += " aspect-video"
    }

    return { className: classes, style: styles }
  }

  if (!videoId) {
    return (
      <div
        className="bg-elegance-ethereal-ivory rounded-md flex items-center justify-center p-4"
        style={{ height: "200px" }}
      >
        {error ? <p className="text-red-500">{error}</p> : <p className="text-gray-500">Loading Vimeo video...</p>}
      </div>
    )
  }

  const containerProps = getContainerProps()

  return (
    <div ref={containerRef} {...containerProps}>
      <div className="absolute inset-0 w-full h-full">
        <iframe
          src={`https://player.vimeo.com/video/${videoId}?autoplay=0&title=0&byline=0&portrait=0`}
          title="Vimeo video player"
          width="100%"
          height="100%"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  )
})
