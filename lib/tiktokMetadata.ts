// Cache for TikTok metadata to avoid repeated API calls
const metadataCache: Record<string, TikTokMetadata> = {}

export interface TikTokMetadata {
  version: string
  type: string
  title: string
  author_url: string
  author_name: string
  width: string
  height: string
  html: string
  thumbnail_width: number
  thumbnail_height: number
  thumbnail_url: string
  provider_url: string
  provider_name: string
}

export async function getTikTokMetadata(url: string): Promise<TikTokMetadata | null> {
  // Check if we have cached data
  if (metadataCache[url]) {
    return metadataCache[url]
  }

  try {
    // Encode the URL to ensure it's properly formatted for the API request
    const encodedUrl = encodeURIComponent(url)
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodedUrl}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch TikTok metadata: ${response.status}`)
    }

    const data = await response.json()

    // Cache the result
    metadataCache[url] = data

    return data
  } catch (error) {
    console.error("Error fetching TikTok metadata:", error)
    return null
  }
}

// Function to extract TikTok video ID from URL
export function extractTikTokId(url: string): string | null {
  // Handle tiktok.com/@user/video/ID
  const standardRegExp = /\/video\/(\d+)/
  const standardMatch = url.match(standardRegExp)

  if (standardMatch) {
    return standardMatch[1]
  }

  // Handle vm.tiktok.com/XYZ or vt.tiktok.com/XYZ
  if (url.includes("vm.tiktok.com/") || url.includes("vt.tiktok.com/")) {
    // For short URLs, we need to follow the redirect to get the actual ID
    // This is a simplified approach - in a real app, you might need to make a server request
    // to follow the redirect and get the actual video ID
    const shortCodeRegExp = /tiktok\.com\/([a-zA-Z0-9]+)/
    const shortCodeMatch = url.match(shortCodeRegExp)

    if (shortCodeMatch) {
      return shortCodeMatch[1] // Return the short code as the ID
    }
  }

  // Try to extract from any URL format that contains a numeric ID
  const numericIdRegExp = /(\d{18,19})/
  const numericMatch = url.match(numericIdRegExp)

  if (numericMatch) {
    return numericMatch[1]
  }

  return null
}

// Function to extract TikTok username from URL
export function extractTikTokUsername(url: string): string | null {
  // For standard URLs
  const regExp = /@([^/]+)/
  const match = url.match(regExp)

  if (match) {
    return match[1]
  }

  return null
}
