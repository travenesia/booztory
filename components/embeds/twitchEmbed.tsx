"use client"

import { useState, useEffect, useRef, memo } from "react"
import { extractTwitchInfo } from "@/lib/twitchMetadata"

interface TwitchEmbedProps {
  url: string
  aspectRatio: "16:9" | "9:16"
  isPreview?: boolean
  responsive?: boolean
}

export const TwitchEmbed = memo(function TwitchEmbed({
  url,
  aspectRatio,
  isPreview = false,
  responsive = false,
}: TwitchEmbedProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const info = extractTwitchInfo(url)
    if (!info) {
      setError("Invalid Twitch URL")
      return
    }

    const parent = typeof window !== "undefined" ? window.location.hostname : "localhost"

    let src = ""
    if (info.type === "channel") {
      src = `https://player.twitch.tv/?channel=${info.id}&parent=${parent}&autoplay=false`
    } else if (info.type === "video") {
      src = `https://player.twitch.tv/?video=${info.id}&parent=${parent}&autoplay=false`
    } else if (info.type === "clip") {
      src = `https://clips.twitch.tv/embed?clip=${info.id}&parent=${parent}&autoplay=false`
    }

    setEmbedUrl(src)
    setError(null)
  }, [url])

  if (!embedUrl) {
    return (
      <div className="bg-elegance-ethereal-ivory rounded-md flex items-center justify-center p-4" style={{ height: "200px" }}>
        {error ? <p className="text-red-500">{error}</p> : <p className="text-gray-500">Loading Twitch embed...</p>}
      </div>
    )
  }

  let containerClass = "relative overflow-hidden rounded-t-md bg-elegance-ethereal-ivory"
  let containerStyle: React.CSSProperties = {}

  if (isPreview) {
    const height = Math.min(200, (typeof window !== "undefined" ? window.innerWidth - 32 : 300) * (9 / 16))
    containerStyle = { height: `${height}px`, width: "100%" }
  } else if (!responsive) {
    containerClass += " aspect-video"
  } else {
    containerStyle = { width: "100%", height: "100%" }
  }

  return (
    <div ref={containerRef} className={containerClass} style={containerStyle}>
      <div className="absolute inset-0 w-full h-full">
        <iframe
          src={embedUrl}
          title="Twitch player"
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  )
})
