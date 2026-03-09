// Cache for YouTube metadata to avoid repeated API calls
const metadataCache: Record<string, YouTubeMetadata> = {}

export interface YouTubeMetadata {
  title: string
  author_name: string
  author_url: string
  type: string
  height: number
  width: number
  version: string
  provider_name: string
  provider_url: string
  thumbnail_height: number
  thumbnail_width: number
  thumbnail_url: string
  html: string
}

export async function getYouTubeMetadata(videoId: string): Promise<YouTubeMetadata | null> {
  if (metadataCache[videoId]) {
    return metadataCache[videoId]
  }

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    )

    if (!response.ok) {
      // Try fetching with live URL format if standard watch URL fails (for some live videos)
      const liveResponse = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/live/${videoId}&format=json`,
      )
      if (!liveResponse.ok) {
        throw new Error(
          `Failed to fetch YouTube metadata for ID ${videoId}: ${response.status} & ${liveResponse.status}`,
        )
      }
      const liveData = await liveResponse.json()
      metadataCache[videoId] = liveData
      return liveData
    }

    const data = await response.json()
    metadataCache[videoId] = data
    return data
  } catch (error) {
    console.error("Error fetching YouTube metadata:", error)
    return null
  }
}

// Updated regex to handle all YouTube URL formats
export function extractYouTubeId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    // Standard watch URLs
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // youtu.be short URLs
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // YouTube v/ URLs
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    // YouTube embed URLs
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // YouTube shorts URLs
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    // YouTube live URLs
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    // Playlist URLs - extract the first video if present
    /(?:youtube\.com\/playlist\?list=[a-zA-Z0-9_-]+.*?&v=)([a-zA-Z0-9_-]{11})/,
    // Mobile YouTube URLs
    /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

export function isYouTubeShort(url: string): boolean {
  return (
    url.includes("youtube.com/shorts/") ||
    url.includes("youtu.be/shorts/") || // Less common but possible
    url.includes("/shorts/") || // General path segment
    url.includes("&feature=shorts") // Parameter indicating a short
  )
}

export function getYouTubeAspectRatio(url: string): "16:9" | "9:16" {
  return isYouTubeShort(url) ? "9:16" : "16:9"
}

export function extractTwitterId(url: string): string | null {
  const regExp = /\/status\/(\d+)/
  const match = url.match(regExp)
  return match ? match[1] : null
}
