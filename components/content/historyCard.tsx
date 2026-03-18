"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { DollarCircle } from "iconoir-react"
import { YouTubeIcon, TikTokIcon, TwitterIcon, YouTubeShortsIcon, VimeoIcon, SpotifyIcon, TwitchIcon } from "./icon"
import type { ContentItem } from "@/lib/contract"
import { isYouTubeShort } from "@/lib/youtubeMetadata"
import { TweetInfoPreview } from "@/components/tweet/tweet-info-preview"
import { extractTwitterId } from "@/lib/youtubeMetadata"
import { useWalletName } from "@/hooks/useWalletName"
import { getTikTokMetadata } from "@/lib/tiktokMetadata"
import { ShineBorder } from "@/components/ui/shine-border"

interface HistoryCardProps {
  content: ContentItem
  isOwn?: boolean
}

export function HistoryCard({ content, isOwn = false }: HistoryCardProps) {
  const [isContentYoutubeShort, setIsContentYoutubeShort] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [tiktokTitle, setTiktokTitle] = useState<string | null>(null)
  const [tiktokAuthor, setTiktokAuthor] = useState<string | null>(null)
  const [tiktokThumbnail, setTiktokThumbnail] = useState<string | null>(null)

  const resolvedName = useWalletName(content.submittedBy)
  const displayUsername = resolvedName || content.username

  useEffect(() => {
    setImageError(false)
    if (content.contentType === "youtube") {
      setIsContentYoutubeShort(isYouTubeShort(content.contentUrl) || content.aspectRatio === "9:16")
    }
    if (content.contentType === "tiktok") {
      getTikTokMetadata(content.contentUrl).then((meta) => {
        if (meta) {
          if (!content.title) setTiktokTitle(meta.title)
          if (!content.authorName) setTiktokAuthor(meta.author_name)
          setTiktokThumbnail(meta.thumbnail_url)
        }
      })
    }
  }, [content.contentType, content.contentUrl, content.aspectRatio, content.title, content.authorName])

  const getPlatformIcon = () => {
    switch (content.contentType) {
      case "youtube":
        return isContentYoutubeShort ? <YouTubeShortsIcon /> : <YouTubeIcon />
      case "youtubeshorts":
        return <YouTubeShortsIcon />
      case "tiktok":
        return <TikTokIcon />
      case "twitter":
        return <TwitterIcon />
      case "vimeo":
        return <VimeoIcon />
      case "spotify":
        return <SpotifyIcon />
      case "twitch":
        return <TwitchIcon />
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
  const thumbnailUrl = tiktokThumbnail || content.imageUrl

  const handleCardClick = () => {
    window.open(content.contentUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      onClick={handleCardClick}
      className="relative bg-gray-0 rounded-lg overflow-hidden cursor-pointer"
    >
      <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
      <div
        className="flex items-center justify-between h-9 px-3 border-b border-gray-200"
        style={{ background: isOwn ? "linear-gradient(160deg, #fffbeb 0%, #fef3c7 40%, #fffdf0 100%)" : "linear-gradient(160deg, #f0f4ff 0%, #e8f0fe 40%, #f5f7ff 100%)" }}
      >
        <div className="text-xs font-medium text-gray-700">{isOwn ? "Posted by You" : `Posted by @${displayUsername}`}</div>
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
      <div className="flex items-center justify-between w-full h-9 px-3 border-t border-border bg-gray-0">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Completed</span>
          <span className="text-xs text-gray-500">{formatRelativeTime(content.endTime)}</span>
        </div>
        <div className="flex items-center text-gray-900">
          <DollarCircle width={14} height={14} className="mr-1" />
          <p className="text-xs">{content.donations.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}
