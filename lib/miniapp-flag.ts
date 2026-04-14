import { sdk } from "@farcaster/miniapp-sdk"
import { MiniKit } from "@worldcoin/minikit-js"
import { getCapabilities, getConnectorClient, getPublicClient, waitForCallsStatus } from "wagmi/actions"
import { wagmiConfig, APP_CHAIN } from "@/lib/wagmi"

// Module-level flag set by MiniAppInit when the app runs inside Farcaster.
// Set synchronously before connect() is called, so it is always readable
// in useAccountEffect.onConnect handlers without async delays.
let _isMiniApp = false

export const setMiniApp = (value: boolean) => {
  _isMiniApp = value
}

export const isMiniApp = () => _isMiniApp

/**
 * Returns true when running inside World App.
 *
 * Detection is two-layered:
 *
 *   1. Module-init IIFE (synchronous, before first render):
 *      World App injects window.WorldApp into the WebView before any page JS runs.
 *      We read it at module import time — if present, _worldAppCached = true immediately,
 *      so every hook and component sees the correct value on the very first render and
 *      wagmi query keys are stable from the start (no Skeleton flash).
 *
 *   2. finalizeWorldAppDetection() (called from MiniKitClientProvider.useEffect):
 *      Runs after MiniKitProvider has called MiniKit.install(). Catches the edge case
 *      where window.WorldApp was not set at module init (very late async injection).
 *      Sets _nonWorldAppConfirmed = true so we stop calling MiniKit.isInstalled() on
 *      subsequent renders (eliminates "MiniKit is not installed" warning spam).
 *      NOTE: _worldAppCached is never locked to false — we keep checking window.WorldApp
 *      on each render in case it was injected after the IIFE ran but before mount.
 *
 * _worldAppCached:
 *   null  — not yet confirmed (first visit, no sessionStorage; detection still in progress)
 *   true  — confirmed World App; cached in sessionStorage for fast subsequent loads
 *   (never set to false — see above)
 */
const _WORLD_APP_KEY = "__bzt_wa"

// IIFE: synchronous check at module import time, before the first React render.
// World App sets window.WorldApp before executing any page JS, so we can detect it here.
// sessionStorage hit covers subsequent loads within the same World App WebView session.
let _worldAppCached: boolean | null = (() => {
  if (typeof window === "undefined") return null
  try { if (sessionStorage.getItem(_WORLD_APP_KEY) === "1") return true } catch { /* storage unavailable */ }
  const w = window as any
  if (w.WorldApp || w.__worldapp) {
    try { sessionStorage.setItem(_WORLD_APP_KEY, "1") } catch { /* storage unavailable */ }
    return true
  }
  return null
})()

// Set to true by finalizeWorldAppDetection() once MiniKit.install() has been tried.
// Stops MiniKit.isInstalled() from being called on subsequent renders (no warning spam).
// Does NOT mean "confirmed not World App" — we still check window.WorldApp each render.
let _nonWorldAppConfirmed = false

export const isWorldApp = (): boolean => {
  // Fast path: already confirmed World App (sessionStorage hit or earlier detection)
  if (_worldAppCached === true) return true
  if (typeof window === "undefined") return false
  const w = window as any
  // Synchronous window globals — set by World App before any page JS; no warning when absent
  if (w.WorldApp || w.__worldapp) {
    _worldAppCached = true
    try { sessionStorage.setItem(_WORLD_APP_KEY, "1") } catch { /* storage unavailable */ }
    return true
  }
  // MiniKit.isInstalled() logs a warning when false.
  // Only call it during the brief pre-mount window; _nonWorldAppConfirmed stops the spam.
  if (!_nonWorldAppConfirmed && MiniKit.isInstalled()) {
    _worldAppCached = true
    try { sessionStorage.setItem(_WORLD_APP_KEY, "1") } catch { /* storage unavailable */ }
    return true
  }
  return false
}

/**
 * Called once from MiniKitClientProvider's useEffect after MiniKitProvider has called
 * MiniKit.install(). By now we have the definitive answer from MiniKit.
 * - If World App: lock _worldAppCached = true (unlikely to reach here if IIFE detected it)
 * - If not: set _nonWorldAppConfirmed = true to stop MiniKit.isInstalled() spam
 *
 * We intentionally do NOT lock _worldAppCached = false so that isWorldApp() continues
 * to check window.WorldApp on each render, handling any edge-case async injection.
 */
export const finalizeWorldAppDetection = (): void => {
  if (_worldAppCached === true) return // already confirmed — nothing to do
  const w = typeof window !== "undefined" ? (window as any) : null
  if (!!w?.WorldApp || !!w?.__worldapp || MiniKit.isInstalled()) {
    _worldAppCached = true
    try { sessionStorage.setItem(_WORLD_APP_KEY, "1") } catch { /* storage unavailable */ }
  } else {
    // Not World App — stop calling MiniKit.isInstalled() but keep window.WorldApp checks
    _nonWorldAppConfirmed = true
  }
}

/**
 * Returns true if the connected wallet explicitly supports EIP-5792 wallet_sendCalls
 * with paymasterService on the app chain.
 *
 * Primary check: wallet_getCapabilities — the wallet declares support.
 * Only wallets that implement EIP-5792 (e.g. Coinbase Smart Wallet) return this.
 * EOAs and non-EIP-5792 smart wallets (Safe, Argent) return nothing or throw,
 * so they correctly fall through to the EOA path.
 */
export async function canUsePaymaster(paymasterUrl: string | undefined): Promise<boolean> {
  if (!paymasterUrl) return false
  try {
    const capabilities = await getCapabilities(wagmiConfig)
    const chainCaps = (capabilities as Record<number, { paymasterService?: { supported?: boolean } }>)[APP_CHAIN.id]
    return chainCaps?.paymasterService?.supported === true
  } catch {
    return false
  }
}

/**
 * Waits for a batch (EIP-5792) to be confirmed using wagmi/actions waitForCallsStatus.
 * Uses a race with a timeout — Coinbase Smart Wallet sometimes confirms the tx on-chain
 * but wagmi's wallet_getCallsStatus polling never resolves. After the timeout, we treat
 * the batch as successful since sendCalls already submitted the user operation.
 */
export async function waitForPaymasterCalls(callsId: string, timeoutMs = 60_000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs)
  })
  try {
    const result = await Promise.race([
      waitForCallsStatus(wagmiConfig, { id: callsId }).then(() => "done" as const),
      timeout,
    ])
    // result is "done" or "timeout" — both are success (tx already submitted)
    void result
  } finally {
    clearTimeout(timer)
  }
}

// Call sdk.actions.ready() whenever running inside any mini app context
// (Warpcast, Farcaster preview tool, Base App, etc).
// Invoked from app/page.tsx after content finishes loading.
export const callReady = () => {
  sdk.isInMiniApp().then((inMiniApp) => {
    if (inMiniApp) sdk.actions.ready()
  })
}

/**
 * Polls the World Developer Portal API until the user operation is confirmed on-chain.
 *
 * Returns the canonical `transaction_hash` when confirmed.
 * Throws if the transaction fails on-chain.
 * Returns null on timeout (op was submitted — caller decides how to proceed).
 *
 * Polls every 2 s. Default timeout: 60 s.
 */
export async function waitForWorldOp(
  userOpHash: string,
  timeoutMs = 60_000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `https://developer.world.org/api/v2/minikit/userop/${userOpHash}`,
      )
      if (res.ok) {
        const data: { status?: string; transaction_hash?: string; debug_url?: string } = await res.json()
        console.log(`[waitForWorldOp] ${userOpHash.slice(0, 10)}… status=${data.status}${data.debug_url ? ` debug=${data.debug_url}` : ""}`)
        if (data.status === "mined" || (data.status === "success" && data.transaction_hash)) {
          return data.transaction_hash ?? userOpHash
        }
        // Explicit failure — throw immediately so callers surface the error
        if (data.status === "failed" || data.status === "reverted" || data.status === "error") {
          const debugInfo = data.debug_url ? ` — debug: ${data.debug_url}` : ""
          throw new Error(`On-chain transaction ${data.status} (userOpHash: ${userOpHash})${debugInfo}`)
        }
      }
    } catch (err) {
      // Re-throw explicit failures; swallow network hiccups
      if (err instanceof Error && err.message.startsWith("On-chain transaction")) throw err
    }
    await new Promise<void>((r) => setTimeout(r, 2_000))
  }
  return null // timed out — op was submitted but confirmation pending
}
