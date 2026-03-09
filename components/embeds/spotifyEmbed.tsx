"use client"

import type React from "react"
import { useState, useEffect, memo } from "react"
import { extractSpotifyInfo } from "@/lib/spotifyMetadata"

interface SpotifyEmbedProps {
  url: string
  isPreview?: boolean
  responsive?: boolean // This prop might not be directly used if Spotify handles its own responsiveness
}

export const SpotifyEmbed = memo(function SpotifyEmbed({
  url,
  isPreview = false,
  // responsive = false, // Commented out as Spotify iframe usually handles its own responsiveness based on width
}: SpotifyEmbedProps) {
  const [spotifyInfo, setSpotifyInfo] = useState<{ id: string; type: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // const containerRef = useRef<HTMLDivElement>(null); // Not strictly needed if parent dictates size

  useEffect(() => {
    try {
      const info = extractSpotifyInfo(url)
      if (info) {
        setSpotifyInfo(info)
        setError(null)
      } else {
        setError("Invalid Spotify URL")
      }
    } catch (err) {
      setError("Error processing Spotify URL")
      console.error("Error processing Spotify URL:", err)
    }
  }, [url])

  // Determine container classes and styles
  // The parent component (ContentCard) will now primarily control the dimensions.
  // This component's container will just fill what the parent gives it.
  const getContainerProps = () => {
    const classes = "relative overflow-hidden rounded-t-md bg-gray-900" // Dark bg for Spotify
    const styles: React.CSSProperties = {
      width: "100%",
      height: "100%", // Fill the parent container
    }

    if (isPreview) {
      // Preview mode might still want specific constraints if parent doesn't fully handle it
      styles.maxHeight = "200px" // Ensure preview is not too tall
    }

    return { className: classes, style: styles }
  }

  if (!spotifyInfo) {
    return (
      <div
        className="bg-gray-900 rounded-md flex items-center justify-center p-4 text-white" // Dark bg for loading/error
        style={{ height: isPreview ? "200px" : "352px" }} // Fallback height
      >
        {error ? <p className="text-red-500">{error}</p> : <p className="text-gray-400">Loading Spotify content...</p>}
      </div>
    )
  }

  const containerProps = getContainerProps()
  const { id, type } = spotifyInfo

  // Determine embed height for Spotify URL params
  // Spotify's embed can take a height param in its URL, but it's often better to control via iframe attributes/CSS
  // For simplicity and to align with standard Spotify behavior, we'll let the iframe be 100% height of its container.
  // The `compact` query param can be used for smaller embeds.
  // const embedHeight = isPreview ? 152 : 352; // Example: use compact for preview

  return (
    <div {...containerProps}>
      {" "}
      {/* Removed ref as parent controls size */}
      <div className="absolute inset-0 w-full h-full">
        <iframe
          // src={`https://open.spotify.com/embed/${type}/${id}?utm_source=oembed&theme=0&autoplay=0`} // theme=0 for dark
          // Forcing autoplay=1 for main content card, preview should not autoplay.
          src={`https://open.spotify.com/embed/${type}/${id}?utm_source=oembed&theme=0&autoplay=${isPreview ? 0 : 1}`}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="absolute inset-0 w-full h-full"
          title="Spotify Embed"
        />
      </div>
    </div>
  )
})
