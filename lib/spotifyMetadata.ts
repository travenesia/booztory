// Cache for Spotify metadata to avoid repeated API calls
const metadataCache: Record<string, SpotifyMetadata> = {}

export interface SpotifyMetadata {
  type: string
  version: string
  provider_name: string
  provider_url: string
  height: number
  width: number
  title: string
  thumbnail_url: string
  thumbnail_width: number
  thumbnail_height: number
  html: string
  author_name?: string
}

export async function getSpotifyMetadata(url: string): Promise<SpotifyMetadata | null> {
  // Check if we have cached data
  if (metadataCache[url]) {
    return metadataCache[url]
  }

  try {
    // Use the Spotify oEmbed API
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch Spotify metadata: ${response.status}`)
    }

    const data = await response.json()

    // Cache the result
    metadataCache[url] = data

    return data
  } catch (error) {
    console.error("Error fetching Spotify metadata:", error)
    return null
  }
}

// Function to extract Spotify ID and type from URL
export function extractSpotifyInfo(url: string): { id: string; type: string } | null {
  // Handle open.spotify.com/track/ID, open.spotify.com/album/ID, open.spotify.com/playlist/ID, open.spotify.com/artist/ID
  const regExp = /open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/
  const match = url.match(regExp)

  if (match && match[1] && match[2]) {
    return {
      type: match[1],
      id: match[2],
    }
  }

  return null
}

// Function to validate Spotify URL
export function isValidSpotifyUrl(url: string): boolean {
  return !!extractSpotifyInfo(url)
}
