import { NextResponse } from "next/server"
import { externalApiLimiter, getIp } from "@/lib/ratelimit"

export async function GET(request: Request) {
  const { success } = await externalApiLimiter.limit(getIp(request))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  const { searchParams } = new URL(request.url)
  const shortUrl = searchParams.get("shortUrl")

  if (!shortUrl) {
    return NextResponse.json({ error: "Missing shortUrl parameter" }, { status: 400 })
  }

  if (!shortUrl.startsWith("https://vm.tiktok.com/") && !shortUrl.startsWith("https://vt.tiktok.com/")) {
    return NextResponse.json({ error: "Invalid TikTok short URL format" }, { status: 400 })
  }

  try {
    const response = await fetch(shortUrl, { redirect: "follow", method: "HEAD" })

    if (!response.ok && response.status !== 200) {
      // HEAD might return 200 or other success codes
      // If HEAD fails or doesn't give a clear redirect, try GET
      const getResponse = await fetch(shortUrl, { redirect: "manual" }) // Use manual to inspect Location header
      if (getResponse.headers.has("location")) {
        const finalUrl = getResponse.headers.get("location")
        if (finalUrl && finalUrl.includes("tiktok.com/@")) {
          return NextResponse.json({ resolvedUrl: finalUrl })
        }
      }
      throw new Error(`Failed to resolve URL, status: ${response.status}`)
    }

    // The 'response.url' will contain the final URL after all redirects
    const finalUrl = response.url

    if (finalUrl && finalUrl.includes("tiktok.com/@")) {
      // Further check if it's a valid video URL structure
      const videoIdMatch = finalUrl.match(/\/video\/(\d+)/)
      if (videoIdMatch && videoIdMatch[1]) {
        return NextResponse.json({ resolvedUrl: finalUrl })
      } else {
        // It might have resolved to a user profile or something else
        return NextResponse.json({ error: "Resolved URL is not a TikTok video page" }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Could not resolve to a valid TikTok URL" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error resolving TikTok URL:", error)
    return NextResponse.json(
      { error: "Failed to resolve TikTok URL", details: (error as Error).message },
      { status: 500 },
    )
  }
}
