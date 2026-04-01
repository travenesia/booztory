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

    // Base App check FIRST — isCoinbaseBrowser takes priority over sdk.isInMiniApp().
    // Base App currently returns true from isInMiniApp(), which would incorrectly set
    // the QuickAuth flag and break reconnect after disconnect. Skip Farcaster path entirely.
    try {
      const eth = (window.top?.ethereum ?? window.ethereum) as any
      if (eth?.isCoinbaseBrowser) {
        connect({
          connector: injected({
            target() {
              return {
                id: "base-app",
                name: "Base App",
                provider: eth,
              }
            },
          }),
        })
        return
      }
    } catch {
      // window.top access may throw in sandboxed iframes — safe to ignore
    }

    // Farcaster mini app path (Warpcast / actual Farcaster client)
    sdk.isInMiniApp().then(async (inMiniApp) => {
      if (!inMiniApp) return
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
