import { sdk } from "@farcaster/miniapp-sdk"
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
