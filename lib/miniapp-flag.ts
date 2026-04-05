import { sdk } from "@farcaster/miniapp-sdk"
import { getConnectorClient, getPublicClient, waitForCallsStatus } from "wagmi/actions"
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
 * Returns true if the connected wallet is a Smart Account (ERC-4337).
 * Detection: eth_getCode(address) — if the result is not "0x" or undefined,
 * the account has contract code deployed = smart account.
 * EOAs always return "0x" (no code). Works for any smart account type
 * (Coinbase Smart Wallet, Safe, etc.) without relying on wallet_getCapabilities.
 */
export async function canUsePaymaster(paymasterUrl: string | undefined): Promise<boolean> {
  if (!paymasterUrl) return false
  try {
    const connectorClient = await getConnectorClient(wagmiConfig)
    const address = connectorClient.account?.address
    if (!address) return false
    const publicClient = getPublicClient(wagmiConfig)
    if (!publicClient) return false
    const code = await publicClient.getCode({ address })
    return !!code && code !== "0x"
  } catch {
    return false
  }
}

/**
 * Waits for a batch (EIP-5792) to be confirmed using wagmi/actions waitForCallsStatus.
 * This uses the active connector's transport, handles all status formats, and throws on timeout.
 */
export async function waitForPaymasterCalls(callsId: string): Promise<void> {
  await waitForCallsStatus(wagmiConfig, { id: callsId })
}

// Call sdk.actions.ready() whenever running inside any mini app context
// (Warpcast, Farcaster preview tool, Base App, etc).
// Invoked from app/page.tsx after content finishes loading.
export const callReady = () => {
  sdk.isInMiniApp().then((inMiniApp) => {
    if (inMiniApp) sdk.actions.ready()
  })
}
