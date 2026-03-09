// Cache for Vimeo metadata to avoid repeated API calls
const metadataCache: Record<string, VimeoMetadata> = {}

export interface VimeoMetadata {
  type: string
  version: string
  provider_name: string
  provider_url: string
  title: string
  author_name: string
  author_url: string
  is_plus: string
  account_type: string
  html: string
  width: number
  height: number
  duration: number
  description: string
  thumbnail_url: string
  thumbnail_width: number
  thumbnail_height: number
  thumbnail_url_with_play_button: string
  upload_date: string
  video_id: number
  uri: string
}

export async function getVimeoMetadata(videoId: string): Promise<VimeoMetadata | null> {
  // Check if we have cached data
  if (metadataCache[videoId]) {
    return metadataCache[videoId]
  }

  try {
    const response = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch Vimeo metadata: ${response.status}`)
    }

    const data = await response.json()

    // Cache the result
    metadataCache[videoId] = data

    return data
  } catch (error) {
    console.error("Error fetching Vimeo metadata:", error)
    return null
  }
}

// Function to extract Vimeo video ID from URL
export function extractVimeoId(url: string): string | null {
  // Handle vimeo.com/ID
  const regExp = /vimeo\.com\/([0-9]+)/
  const match = url.match(regExp)
  return match && match[1] ? match[1] : null
}
