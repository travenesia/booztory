"use client"

import { Suspense, memo, useEffect, useState } from "react"
import type { TweetCoreProps, EnrichedTweet } from "react-tweet"
import { DubTweet } from "./dub-tweet"

type Props = TweetCoreProps & {
  noTilt?: boolean
}

const TweetContent = ({ id, noTilt, onError }: Props) => {
  const [tweet, setTweet] = useState<EnrichedTweet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    const fetchTweet = async () => {
      try {
        const response = await fetch(`/api/getTweetData?tweetId=${id}`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown server error" }))
          throw new Error(errorData.error || `Failed to fetch tweet: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        if (data.tweet) {
          setTweet(data.tweet)
        } else if (data.error) {
          throw new Error(data.error)
        } else {
          throw new Error("Tweet data not found in API response.")
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load tweet"
        setError(errorMessage)
        if (onError) {
          onError(err)
        } else {
          console.error("Error fetching tweet:", err)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchTweet()
  }, [id, onError])

  if (loading) {
    return (
      <div className="w-full h-24 bg-gray-100 animate-pulse rounded-md flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading tweet...</span>
      </div>
    )
  }

  if (error || !tweet) {
    return (
      <div className="prose flex h-[20rem] break-inside-avoid items-center rounded-lg border border-gray-300 bg-white/20 bg-clip-padding p-6 pb-4 text-center text-sm backdrop-blur-lg backdrop-filter">
        <p className="text-red-500">{error || "There was an error loading this tweet."}</p>
      </div>
    )
  }

  return <DubTweet tweet={tweet} noTilt={noTilt} />
}

// Use memo to prevent unnecessary re-renders
export const Tweet = memo((props: Props) => (
  <Suspense fallback={<div className="w-full h-24 bg-gray-100 animate-pulse rounded-md"></div>}>
    <TweetContent {...props} />
  </Suspense>
))

Tweet.displayName = "Tweet"
