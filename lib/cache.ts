// Cache manager for performance optimization
interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

class CacheManager {
  private static instance: CacheManager
  private cache: Map<string, CacheItem<any>> = new Map()

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })

    // Also store in localStorage for persistence
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `cache_${key}`,
          JSON.stringify({
            data,
            timestamp: Date.now(),
            ttl,
          }),
        )
      } catch (error) {
        console.warn("Failed to store cache in localStorage:", error)
      }
    }
  }

  get<T>(key: string): T | null {
    // Check memory cache first
    const memoryItem = this.cache.get(key)
    if (memoryItem && Date.now() - memoryItem.timestamp < memoryItem.ttl) {
      return memoryItem.data
    }

    // Check localStorage cache
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`cache_${key}`)
        if (stored) {
          const item: CacheItem<T> = JSON.parse(stored)
          if (Date.now() - item.timestamp < item.ttl) {
            // Restore to memory cache
            this.cache.set(key, item)
            return item.data
          } else {
            // Expired, remove from localStorage
            localStorage.removeItem(`cache_${key}`)
          }
        }
      } catch (error) {
        console.warn("Failed to read cache from localStorage:", error)
      }
    }

    // Remove expired item from memory cache
    this.cache.delete(key)
    return null
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key)
      if (typeof window !== "undefined") {
        localStorage.removeItem(`cache_${key}`)
      }
    } else {
      this.cache.clear()
      if (typeof window !== "undefined") {
        // Clear all cache items from localStorage
        const keys = Object.keys(localStorage).filter((k) => k.startsWith("cache_"))
        keys.forEach((k) => localStorage.removeItem(k))
      }
    }
  }

  // Clean up expired items
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp >= item.ttl) {
        this.cache.delete(key)
        if (typeof window !== "undefined") {
          localStorage.removeItem(`cache_${key}`)
        }
      }
    }
  }

  // Invalidate content cache when new content appears
  invalidateContentCache(): void {
    const contentKeys = Array.from(this.cache.keys()).filter(
      (key) => key.startsWith("featured_content") || key.startsWith("content_metadata"),
    )

    contentKeys.forEach((key) => {
      this.cache.delete(key)
      if (typeof window !== "undefined") {
        localStorage.removeItem(`cache_${key}`)
      }
    })

    console.log("🗑️ Content cache invalidated for new content")
  }
}

// Cache duration constants
export const CACHE_DURATIONS = {
  CRYPTO_PRICES: 5 * 60 * 1000, // 5 minutes
  USER_PROFILE: 10 * 60 * 1000, // 10 minutes
  METADATA: 60 * 60 * 1000, // 1 hour
  FEATURED_CONTENT: 2 * 60 * 1000, // 2 minutes (increased from 30 seconds)
  CONTENT_METADATA: 10 * 60 * 1000, // 10 minutes (increased from 5 minutes)
} as const

export const cache = CacheManager.getInstance()

// Cleanup expired cache items every 5 minutes
if (typeof window !== "undefined") {
  setInterval(
    () => {
      cache.cleanup()
    },
    5 * 60 * 1000,
  )
}
