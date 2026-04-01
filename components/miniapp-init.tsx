"use client"

import { useEffect, useRef } from "react"
import { sdk } from "@farcaster/miniapp-sdk"
import { useConnect } from "wagmi"
import { injected } from "wagmi/connectors"
import { setMiniApp } from "@/lib/miniapp-flag"

export function MiniAppInit() {
  const { connect } = useConnect()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Farcaster mini app path only.
    // Base App returns true from isInMiniApp() until April 9 2026, but its in-app browser
    // does NOT include "Warpcast" in the user agent — use that to distinguish real Farcaster.
    sdk.isInMiniApp().then(async (inMiniApp) => {
      if (!inMiniApp) return
      const isWarpcast = /Warpcast/i.test(navigator.userAgent)
      if (!isWarpcast) return // Base App or other non-Farcaster host — treat as standard browser
      setMiniApp(true)
      const provider = await sdk.wallet.getEthereumProvider()
      if (!provider) return
      connect({
        connector: injected({
          target() {
            return {
              id: "farcaster",
              name: "Farcaster Wallet",
              provider: provider as any,
            }
          },
        }),
      })
    })
  }, [connect])

  return null
}
