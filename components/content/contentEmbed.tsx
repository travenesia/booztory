"use client"

import { useState, useEffect, useRef, memo } from "react"
import { YouTubeEmbed } from "@/components/embeds/youtubeEmbed"
import { TikTokEmbed } from "@/components/embeds/tiktokEmbed"
import { extractTwitterId } from "@/lib/youtubeMetadata"
import { TwitterEmbed } from "@/components/embeds/twitterEmbed"
import { VimeoEmbed } from "@/components/embeds/vimeoEmbed"
import { SpotifyEmbed } from "@/components/embeds/spotifyEmbed"
import { TwitchEmbed } from "@/components/embeds/twitchEmbed"

interface ContentEmbedProps {
  contentType: "youtube" | "youtubeshorts" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch" | "text"
  contentUrl: string
  aspectRatio: "16:9" | "9:16"
  isPreview?: boolean
  responsive?: boolean
}

export const ContentEmbed = memo(function ContentEmbed({
  contentType,
  contentUrl,
  aspectRatio,
  isPreview = false,
  responsive = false,
}: ContentEmbedProps) {
  const [error, setError] = useState<string | null>(null)
  const embedRef = useRef<HTMLDivElement>(null)
  const [tweetId, setTweetId] = useState<string | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)

  useEffect(() => {
    // Reset states
    setError(null)
    setTweetId(null)
    setContentHeight(null)

    try {
      // Generate embed HTML based on content type and URL
      if (contentType === "twitter") {
        // Extract Twitter tweet ID
        const id = extractTwitterId(contentUrl)
        if (id) {
          // Only update if the ID has changed
          setTweetId((prevId) => (prevId !== id ? id : prevId))
        } else {
          setError("Invalid Twitter URL")
        }
      }
    } catch (err) {
      setError("Error generating embed")
      console.error("Error generating embed:", err)
    }
  }, [contentType, contentUrl])

  // Monitor embedded content for size changes
  useEffect(() => {
    if (embedRef.current && responsive) {
      // Get initial container width
      setContainerWidth(embedRef.current.clientWidth)

      // Create a ResizeObserver to monitor content size changes
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Get the content dimensions
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

      // Start observing the embed container
      resizeObserver.observe(embedRef.current)

      return () => {
        // Clean up observer when component unmounts
        resizeObserver.disconnect()
      }
    }
  }, [responsive])

  // If it's a YouTube embed, use the dedicated component
  if (contentType === "youtube" || contentType === "youtubeshorts") {
    return (
      <YouTubeEmbed
        url={contentUrl}
        aspectRatio={contentType === "youtubeshorts" ? "9:16" : aspectRatio}
        isPreview={isPreview}
        responsive={responsive}
      />
    )
  }

  // If it's a TikTok embed, use the dedicated component
  if (contentType === "tiktok") {
    return <TikTokEmbed url={contentUrl} aspectRatio={aspectRatio} isPreview={isPreview} responsive={responsive} />
  }

  // If it's a Twitter embed, use the dedicated component
  if (contentType === "twitter") {
    return <TwitterEmbed url={contentUrl} aspectRatio={aspectRatio} isPreview={isPreview} responsive={responsive} />
  }

  // If it's a Vimeo embed, use the dedicated component
  if (contentType === "vimeo") {
    return <VimeoEmbed url={contentUrl} aspectRatio={aspectRatio} isPreview={isPreview} responsive={responsive} />
  }

  // If it's a Spotify embed, use the dedicated component
  if (contentType === "spotify") {
    return <SpotifyEmbed url={contentUrl} isPreview={isPreview} responsive={responsive} />
  }

  // If it's a Twitch embed, use the dedicated component
  if (contentType === "twitch") {
    return <TwitchEmbed url={contentUrl} aspectRatio={aspectRatio} isPreview={isPreview} responsive={responsive} />
  }

  // Text slot — render formatted text with basic bold/italic support
  if (contentType === "text") {
    const html = contentUrl
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[200px] p-6 bg-gray-50 rounded">
        <p
          className="text-base text-gray-900 text-center leading-relaxed break-words whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }

  // This code should never be reached as all content types are handled above
  return (
    <div ref={embedRef} className="relative overflow-hidden rounded-t-md bg-elegance-ethereal-ivory">
      <div className="flex items-center justify-center h-full bg-elegance-ethereal-ivory">
        {error ? <p className="text-red-500">{error}</p> : <p className="text-gray-500">Loading embed...</p>}
      </div>
    </div>
  )
})
