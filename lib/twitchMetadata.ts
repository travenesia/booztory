export type TwitchContentType = "channel" | "video" | "clip"

export interface TwitchInfo {
  type: TwitchContentType
  id: string
}

export interface TwitchMetadata {
  title: string
  author_name: string
  thumbnail_url: string
}

export function extractTwitchInfo(url: string): TwitchInfo | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    const hostname = u.hostname.replace("www.", "")
    const parts = u.pathname.split("/").filter(Boolean)

    // clips.twitch.tv/ClipId
    if (hostname === "clips.twitch.tv" && parts.length >= 1) {
      return { type: "clip", id: parts[0] }
    }

    if (hostname === "twitch.tv") {
      // twitch.tv/videos/123456
      if (parts[0] === "videos" && parts[1]) {
        return { type: "video", id: parts[1] }
      }
      // twitch.tv/channel/clip/ClipId
      if (parts[1] === "clip" && parts[2]) {
        return { type: "clip", id: parts[2] }
      }
      // twitch.tv/channelname
      if (parts[0] && parts.length === 1) {
        return { type: "channel", id: parts[0] }
      }
    }
  } catch {
    // invalid URL
  }
  return null
}

const metadataCache: Record<string, TwitchMetadata> = {}

export async function getTwitchMetadata(url: string): Promise<TwitchMetadata | null> {
  if (metadataCache[url]) return metadataCache[url]

  try {
    const response = await fetch(`/api/getTwitchMetadata?url=${encodeURIComponent(url)}`)
    if (!response.ok) return null
    const data = await response.json()
    if (data.error) return null
    metadataCache[url] = data
    return data
  } catch {
    return null
  }
}
