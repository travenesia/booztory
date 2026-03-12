import { NextResponse } from "next/server"
import { extractTwitchInfo } from "@/lib/twitchMetadata"

let cachedToken: { token: string; expires: number } | null = null

async function getTwitchToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  })

  if (!res.ok) throw new Error("Failed to get Twitch token")
  const data = await res.json()
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.token
}

async function twitchFetch(path: string, token: string) {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 })

  const info = extractTwitchInfo(url)
  if (!info) return NextResponse.json({ error: "Invalid Twitch URL" }, { status: 400 })

  try {
    const token = await getTwitchToken()

    if (info.type === "channel") {
      const [userData, streamData] = await Promise.all([
        twitchFetch(`users?login=${info.id}`, token),
        twitchFetch(`streams?user_login=${info.id}`, token),
      ])
      const user = userData?.data?.[0]
      const stream = streamData?.data?.[0]
      return NextResponse.json({
        title: stream?.title || `${info.id} on Twitch`,
        author_name: user?.display_name || info.id,
        thumbnail_url: stream?.thumbnail_url
          ? stream.thumbnail_url.replace("{width}", "320").replace("{height}", "180")
          : (user?.profile_image_url ?? "/placeholder.svg?height=180&width=320&text=Twitch+Stream"),
      })
    }

    if (info.type === "video") {
      const data = await twitchFetch(`videos?id=${info.id}`, token)
      const video = data?.data?.[0]
      return NextResponse.json({
        title: video?.title || `Twitch Video ${info.id}`,
        author_name: video?.user_name || "Twitch",
        thumbnail_url: video?.thumbnail_url
          ? video.thumbnail_url.replace("%{width}", "320").replace("%{height}", "180")
          : "/placeholder.svg?height=180&width=320&text=Twitch+Video",
      })
    }

    if (info.type === "clip") {
      const data = await twitchFetch(`clips?id=${info.id}`, token)
      const clip = data?.data?.[0]
      return NextResponse.json({
        title: clip?.title || `Twitch Clip ${info.id}`,
        author_name: clip?.broadcaster_name || "Twitch",
        thumbnail_url: clip?.thumbnail_url || "/placeholder.svg?height=180&width=320&text=Twitch+Clip",
      })
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Twitch metadata error:", error)
    return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 500 })
  }
}
