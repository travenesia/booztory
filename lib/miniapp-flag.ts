import { sdk } from "@farcaster/miniapp-sdk"

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caps = await (window as any).ethereum?.request({ method: "wallet_getCapabilities" })
    return !!caps
  } catch {
    return false
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
