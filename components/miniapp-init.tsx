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

    sdk.isInMiniApp().then(async (inMiniApp) => {
      if (inMiniApp) {
        // Farcaster mini app path — set flag so QuickAuth is used for sign-in
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
        return
      }

      // Base App standard web app path (post-April 9 2026 migration)
      // Base App injects window.ethereum with isCoinbaseBrowser = true.
      // Do NOT set isMiniApp flag — SIWE handles sign-in for this path.
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
        }
      } catch {
        // window.top access may throw in sandboxed iframes — safe to ignore
      }
    })
  }, [connect])

  return null
}
