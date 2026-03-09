/**
 * Hash a nonce for additional security
 * Works in both browser and Node.js environments
 */
export function hashNonce(nonce: string): string {
  // Use a simple hash function that works in both browser and Node.js
  let hash = 0
  for (let i = 0; i < nonce.length; i++) {
    const char = nonce.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Convert to hex string and ensure it's positive
  return Math.abs(hash).toString(16)
}

/**
 * Generate a secure random nonce
 */
export function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, "")
}
