import { sdk } from "@farcaster/miniapp-sdk"
import { getConnectorClient } from "wagmi/actions"
import { wagmiConfig } from "@/lib/wagmi"

// Module-level flag set by MiniAppInit when the app runs inside Farcaster.
// Set synchronously before connect() is called, so it is always readable
// in useAccountEffect.onConnect handlers without async delays.
let _isMiniApp = false

export const setMiniApp = (value: boolean) => {
  _isMiniApp = value
}

export const isMiniApp = () => _isMiniApp

/**
 * Returns true if the connected wallet is a Smart Account (ERC-4337) that supports
 * EIP-5792 batch calls + paymaster. EOAs throw on wallet_getCapabilities, so this
 * correctly excludes them even inside Base App or Warpcast.
 */
export async function canUsePaymaster(paymasterUrl: string | undefined): Promise<boolean> {
  if (!paymasterUrl) return false
  try {
    const client = await getConnectorClient(wagmiConfig)
    const caps = await client.transport.request({ method: "wallet_getCapabilities", params: [] })
    return !!caps
  } catch {
    return false
  }
}

/**
 * Polls wallet_getCallsStatus until the batch is confirmed.
 * Uses the active connector's provider (same one used by writeContractsAsync) so it
 * works correctly when Coinbase Wallet is discovered via EIP-6963 rather than window.ethereum.
 * Handles both EIP-5792 string status ("CONFIRMED") and older numeric codes (200),
 * with a receipts-array fallback for wallets that populate receipts before updating status.
 */
export async function waitForPaymasterCalls(callsId: string): Promise<void> {
  // Resolve the provider once — use the active connector's transport, fall back to window.ethereum
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let request: (args: { method: string; params: unknown[] }) => Promise<any>
  try {
    const client = await getConnectorClient(wagmiConfig)
    request = (args) => client.transport.request(args)
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request = (args) => (window as any).ethereum?.request(args)
  }

  for (let i = 0; i < 60; i++) {
    try {
      const res = await request({ method: "wallet_getCallsStatus", params: [callsId] })
      const s = res?.status
      if (
        s === "CONFIRMED" ||      // EIP-5792 current spec
        s === 200 ||              // older Coinbase numeric code
        s === "200" ||
        (Array.isArray(res?.receipts) && res.receipts.length > 0)  // receipts-first wallets
      ) return
    } catch {}
    await new Promise<void>((r) => setTimeout(r, 1000))
  }
  throw new Error("Transaction timed out")
}

// Call sdk.actions.ready() whenever running inside any mini app context
// (Warpcast, Farcaster preview tool, Base App, etc).
// Invoked from app/page.tsx after content finishes loading.
export const callReady = () => {
  sdk.isInMiniApp().then((inMiniApp) => {
    if (inMiniApp) sdk.actions.ready()
  })
}
