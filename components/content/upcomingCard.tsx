"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Clock } from "iconoir-react"
import { YouTubeIcon, TikTokIcon, TwitterIcon, YouTubeShortsIcon, VimeoIcon, SpotifyIcon } from "./icon"
import type { ContentItem } from "@/lib/contract"
import { isYouTubeShort } from "@/lib/youtubeMetadata"
import { TweetInfoPreview } from "@/components/tweet/tweet-info-preview"
import { extractTwitterId } from "@/lib/youtubeMetadata"
import { useWalletName } from "@/hooks/useWalletName"
import { getTikTokMetadata } from "@/lib/tiktokMetadata"

interface UpcomingCardProps {
  content: ContentItem
}

export function UpcomingCard({ content }: UpcomingCardProps) {
  const [isContentYoutubeShort, setIsContentYoutubeShort] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [tiktokTitle, setTiktokTitle] = useState<string | null>(null)
  const [tiktokAuthor, setTiktokAuthor] = useState<string | null>(null)

  const resolvedName = useWalletName(content.submittedBy)
  const displayUsername = resolvedName || content.username

  useEffect(() => {
    setImageError(false)
    if (content.contentType === "youtube") {
      setIsContentYoutubeShort(isYouTubeShort(content.contentUrl) || content.aspectRatio === "9:16")
    }
    if (content.contentType === "tiktok" && (!content.title || !content.authorName)) {
      getTikTokMetadata(content.contentUrl).then((meta) => {
        if (meta) {
          if (!content.title) setTiktokTitle(meta.title)
          if (!content.authorName) setTiktokAuthor(meta.author_name)
        }
      })
    }
  }, [content.contentType, content.contentUrl, content.aspectRatio, content.title, content.authorName])

  const getPlatformIcon = () => {
    switch (content.contentType) {
      case "youtube":
        return isContentYoutubeShort ? <YouTubeShortsIcon /> : <YouTubeIcon />
      case "tiktok":
        return <TikTokIcon />
      case "twitter":
        return <TwitterIcon />
      case "vimeo":
        return <VimeoIcon />
      case "spotify":
        return <SpotifyIcon />
      default:
        return null
    }
  }

  const formatTime = (timestamp: number) => {
    const timeLeft = Math.max(0, timestamp - Date.now())
    if (timeLeft <= 0) return "Starting soon..."

    const scheduledTime = new Date(timestamp)
    const hours = scheduledTime.getHours()
    const minutes = scheduledTime.getMinutes()
    const ampm = hours >= 12 ? "PM" : "AM"
    const formattedHours = hours % 12 || 12
    return `${formattedHours}:${minutes.toString().padStart(2, "0")} ${ampm}`
  }

  const title = content.title || tiktokTitle || "Content Title"
  const authorName = content.authorName || tiktokAuthor || displayUsername || "Creator"
  const thumbnailUrl = content.imageUrl

  const handleCardClick = () => {
    window.open(content.contentUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-gray-0 rounded-lg shadow-custom-md overflow-hidden border border-border hover:shadow-custom-md-hover transition-shadow duration-200 cursor-pointer"
    >
      <div className="flex items-center justify-between p-3 border-b border-red-500 bg-red-700">
        <div className="text-xs font-medium text-white">Posted by @{displayUsername}</div>
        <div className="flex-shrink-0">{getPlatformIcon()}</div>
      </div>
      <div className="p-3">
        {content.contentType === "twitter" ? (
          <TweetInfoPreview tweetId={extractTwitterId(content.contentUrl)} wordLimit={15} />
        ) : (
          <div className="flex">
            <div className="relative w-1/3 mr-3">
              <div className="relative aspect-video rounded-md overflow-hidden bg-gray-25">
                {thumbnailUrl && !imageError ? (
                  <Image
                    src={thumbnailUrl || "/placeholder.svg"}
                    alt={title}
                    fill
                    className="object-cover object-center"
                    onError={() => setImageError(true)}
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs text-gray-700 p-1 text-center">No preview</span>
                  </div>
                )}
              </div>
            </div>
            <div className="w-2/3">
              <h1 className="text-base font-medium line-clamp-2 mb-1 text-gray-900">{title}</h1>
              <p className="text-sm text-gray-500 line-clamp-1">{authorName}</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border bg-gray-0">
        <div className="flex items-center justify-between">
          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Queued</span>
          <div className="flex items-center text-gray-900">
            <p className="text-xs mr-2">Scheduled:</p>
            <Clock width={14} height={14} className="mr-1" />
            <p className="text-xs">{formatTime(content.scheduledTime)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
