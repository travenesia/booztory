"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { DollarCircle } from "iconoir-react"
import { YouTubeIcon, TikTokIcon, TwitterIcon, YouTubeShortsIcon, VimeoIcon, SpotifyIcon } from "./icon"
import type { ContentItem } from "@/lib/contract"
import { isYouTubeShort } from "@/lib/youtubeMetadata"
import { TweetInfoPreview } from "@/components/tweet/tweet-info-preview"
import { extractTwitterId } from "@/lib/youtubeMetadata"
import { useWalletName } from "@/hooks/useWalletName"
import { getTikTokMetadata } from "@/lib/tiktokMetadata"

interface HistoryCardProps {
  content: ContentItem
}

export function HistoryCard({ content }: HistoryCardProps) {
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

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diffMs = now - timestamp
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30))

    if (diffMinutes < 1) return "just now"
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
    if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`
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
          <div className="flex items-center">
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Completed</span>
            <span className="text-xs text-gray-500 ml-2">{formatRelativeTime(content.endTime)}</span>
          </div>
          <div className="flex items-center text-gray-900">
            <DollarCircle width={14} height={14} className="mr-1" />
            <p className="text-xs">{content.donations.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
