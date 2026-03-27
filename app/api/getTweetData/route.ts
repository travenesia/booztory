import { NextResponse } from "next/server"
import { getTweet } from "react-tweet/api"
import { enrichTweet } from "react-tweet" // For enriching the tweet data
import { externalApiLimiter, getIp } from "@/lib/ratelimit"

export async function GET(request: Request) {
  const { success } = await externalApiLimiter.limit(getIp(request))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  const { searchParams } = new URL(request.url)
  const tweetId = searchParams.get("tweetId")

  if (!tweetId) {
    return NextResponse.json({ error: "Tweet ID is required" }, { status: 400 })
  }

  try {
    const tweetData = await getTweet(tweetId) // Fetches raw tweet data

    if (!tweetData) {
      return NextResponse.json({ error: "Tweet not found, or it might be private/deleted." }, { status: 404 })
    }

    const enrichedTweetData = enrichTweet(tweetData) // Enriches the tweet data

    return NextResponse.json({ tweet: enrichedTweetData })
  } catch (error: any) {
    // Using 'any' for simplicity, can be 'unknown' with type checks
    console.error(`Error fetching tweet ${tweetId} in API route:`, error)

    let errorMessage = "Failed to fetch tweet data from Twitter."
    let status = 500

    // Try to get more specific error messages if possible
    const errorStatus = error?.status || error?.data?.status // Vercel's fetch might wrap errors
    const twitterErrors = error?.data?.errors // Twitter API specific errors

    if (twitterErrors && twitterErrors.length > 0) {
      errorMessage = twitterErrors[0].message || errorMessage
    } else if (error.message) {
      errorMessage = error.message
    }

    if (errorStatus === 404 || (errorMessage && errorMessage.toLowerCase().includes("not found"))) {
      errorMessage = "Tweet not found (404)."
      status = 404
    } else if (errorStatus === 403 || (errorMessage && errorMessage.toLowerCase().includes("forbidden"))) {
      errorMessage = "Access to this tweet is forbidden (403). It might be from a private account or suspended."
      status = 403
    } else if (errorStatus === 401 || (errorMessage && errorMessage.toLowerCase().includes("unauthorized"))) {
      errorMessage = "Not authorized to fetch this tweet (401)."
      status = 401
    } else if (errorStatus === 429) {
      errorMessage = "Rate limit exceeded when trying to fetch tweet. Please try again later."
      status = 429
    }

    return NextResponse.json({ error: errorMessage, details: error.message || "No additional details" }, { status })
  }
}
