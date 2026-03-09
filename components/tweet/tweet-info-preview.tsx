"use client"

import { useEffect, useState } from "react"
import type { EnrichedTweet } from "react-tweet"
import { TweetHeader } from "./tweet-header"
import { TruncatedTweetText } from "./truncated-tweet-text"
import { Skeleton } from "@/components/ui/skeleton"

interface TweetInfoPreviewProps {
  tweetId: string | null
  wordLimit?: number // Added wordLimit prop
}

export const TweetInfoPreview = ({ tweetId, wordLimit = 50 }: TweetInfoPreviewProps) => {
  // Default wordLimit to 50 if not provided
  const [tweet, setTweet] = useState<EnrichedTweet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tweetId) {
      setError("Invalid Tweet URL: ID could not be extracted.")
      setLoading(false)
      setTweet(null)
      return
    }

    setLoading(true)
    setError(null)
    setTweet(null)

    fetch(`/api/getTweetData?tweetId=${tweetId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown server error" }))
          throw new Error(errorData.error || `Failed to fetch tweet: ${res.status} ${res.statusText}`)
        }
        return res.json()
      })
      .then((data) => {
        if (data.tweet) {
          setTweet(data.tweet)
        } else if (data.error) {
          setError(data.error)
        } else {
          setError("Tweet data not found in API response.")
        }
      })
      .catch((err) => {
        console.error("Error fetching tweet via API route:", err)
        setError(err.message || "Failed to load tweet. Check console for details.")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [tweetId])

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full bg-gray-200" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36 bg-gray-200" />
            <Skeleton className="h-3 w-28 bg-gray-200" />
          </div>
        </div>
        <div className="space-y-1.5 pl-1">
          <Skeleton className="h-3 w-full bg-gray-200" />
          <Skeleton className="h-3 w-5/6 bg-gray-200" />
          <Skeleton className="h-3 w-3/4 bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="py-2 px-1 text-xs text-red-600">{error}</div>
  }

  if (!tweet) {
    return <div className="py-2 px-1 text-xs text-gray-500">No tweet data to display.</div>
  }

  return (
    <div className="py-1">
      <TweetHeader tweet={tweet} />
      {/* Use the wordLimit prop passed from parent, or the default */}
      <TruncatedTweetText tweet={tweet} wordLimit={wordLimit} />
    </div>
  )
}
