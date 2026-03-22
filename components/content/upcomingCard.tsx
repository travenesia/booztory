"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Clock } from "iconoir-react"
import { HiClock } from "react-icons/hi2"
import { YouTubeIcon, TikTokIcon, TwitterIcon, YouTubeShortsIcon, VimeoIcon, SpotifyIcon, TwitchIcon } from "./icon"
import { HiDocumentText } from "react-icons/hi2"
import type { ContentItem } from "@/lib/contract"
import { isYouTubeShort } from "@/lib/youtubeMetadata"
import { TweetInfoPreview } from "@/components/tweet/tweet-info-preview"
import { extractTwitterId } from "@/lib/youtubeMetadata"
import { useWalletName } from "@/hooks/useWalletName"
import { getTikTokMetadata } from "@/lib/tiktokMetadata"
import { ShineBorder } from "@/components/ui/shine-border"

interface UpcomingCardProps {
  content: ContentItem
  isOwn?: boolean
}

export function UpcomingCard({ content, isOwn = false }: UpcomingCardProps) {
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
      case "text":
        return <HiDocumentText className="text-gray-500" size={16} />
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
  const thumbnailUrl = tiktokThumbnail || content.imageUrl

  const isTextSlot = content.contentType === "text"

  const handleCardClick = () => {
    if (isTextSlot) return
    window.open(content.contentUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      onClick={handleCardClick}
      className={`relative bg-gray-0 rounded-lg overflow-hidden ${isTextSlot ? "cursor-default" : "cursor-pointer"}`}
    >
      <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
      <div
        className="flex items-center justify-between h-9 px-3 border-b border-gray-200"
        style={{ background: isOwn ? "linear-gradient(160deg, #fffbeb 0%, #fef3c7 40%, #fffdf0 100%)" : "linear-gradient(160deg, #f0f4ff 0%, #e8f0fe 40%, #f5f7ff 100%)" }}
      >
        <div className="text-xs font-bold text-gray-700">{isOwn ? "Posted by You" : `Posted by @${displayUsername}`}</div>
        <div className="flex-shrink-0">{getPlatformIcon()}</div>
      </div>
      <div className="p-3">
        {content.contentType === "text" ? (
          <p
            className="text-sm text-gray-900 leading-relaxed break-words whitespace-pre-wrap line-clamp-4"
            dangerouslySetInnerHTML={{
              __html: content.contentUrl
                .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.+?)\*/g, "<em>$1</em>"),
            }}
          />
        ) : content.contentType === "twitter" ? (
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
        <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
            <HiClock size={13} />
            Queued
          </span>
        <div className="flex items-center gap-1 text-gray-900">
          <p className="text-xs">Scheduled:</p>
          <Clock width={14} height={14} />
          <p className="text-xs">{formatTime(content.scheduledTime)}</p>
        </div>
      </div>
    </div>
  )
}
