import { sdk } from "@farcaster/miniapp-sdk"

// Module-level flag set by MiniAppInit when the app runs inside Farcaster.
// Set synchronously before connect() is called, so it is always readable
// in useAccountEffect.onConnect handlers without async delays.
let _isMiniApp = false

export const setMiniApp = (value: boolean) => {
  _isMiniApp = value
}

export const isMiniApp = () => _isMiniApp

// Call sdk.actions.ready() only when in a mini app context.
// Invoked from app/page.tsx after content finishes loading.
export const callReady = () => {
  if (_isMiniApp) sdk.actions.ready()
}
