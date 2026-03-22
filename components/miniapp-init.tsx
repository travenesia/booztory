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
      if (!inMiniApp) return
      // Set flag BEFORE connecting wallet so that useAccountEffect.onConnect
      // in ConnectWalletButton can read it synchronously.
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
