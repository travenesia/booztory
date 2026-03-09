"use client"

import type React from "react"

import { useState, useEffect, useRef, memo } from "react"
import { Tweet } from "@/components/tweet/tweet"
import { extractTwitterId } from "@/lib/youtubeMetadata"

interface TwitterEmbedProps {
  url: string
  aspectRatio?: "16:9" | "9:16"
  isPreview?: boolean
  responsive?: boolean
}

export const TwitterEmbed = memo(function TwitterEmbed({
  url,
  aspectRatio = "16:9",
  isPreview = false,
  responsive = false,
}: TwitterEmbedProps) {
  const [tweetId, setTweetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const id = extractTwitterId(url)
      if (id) {
        setTweetId(id)
        setError(null)
      } else {
        setError("Invalid Twitter URL")
      }
    } catch (err) {
      setError("Error processing Twitter URL")
      console.error("Error processing Twitter URL:", err)
    }
  }, [url])

  // Determine container classes and styles
  const getContainerProps = () => {
    // Base container classes for all modes
    const classes = "relative overflow-hidden rounded-t-md bg-elegance-ethereal-ivory"
    let styles: React.CSSProperties = {}

    if (isPreview) {
      // Preview mode with constrained dimensions
      styles = {
        maxHeight: "200px",
        width: "100%",
        overflow: "auto",
      }
    } else if (responsive) {
      // Responsive mode - let Twitter content flow naturally with auto height
      styles = {
        width: "100%",
        height: "auto",
        minHeight: "100px",
      }
    } else {
      // Non-responsive mode with auto height
      styles = {
        width: "100%",
        height: "auto",
        minHeight: "100px",
      }
    }

    return { className: classes, style: styles }
  }

  if (!tweetId) {
    return (
      <div
        className="bg-elegance-ethereal-ivory rounded-md flex items-center justify-center p-4"
        style={{ height: "200px" }}
      >
        {error ? <p className="text-red-500">{error}</p> : <p className="text-gray-500">Loading tweet...</p>}
      </div>
    )
  }

  const containerProps = getContainerProps()

  return (
    <div ref={containerRef} {...containerProps}>
      <div className="w-full h-auto flex items-start justify-center">
        <Tweet id={tweetId} noTilt={isPreview} />
      </div>
    </div>
  )
})
