"use client"

import { useEffect } from "react"
import { MiniKit } from "@worldcoin/minikit-js"
import { finalizeWorldAppDetection } from "@/lib/miniapp-flag"
import type React from "react"

/**
 * Calls MiniKit.install() on the client without wrapping children in MiniKitProvider.
 *
 * Why not MiniKitProvider?
 * MiniKitProvider reads window.WorldApp during SSR — it doesn't exist on the server.
 * This causes a hydration mismatch that silently breaks event handlers and triggers
 * World App's WebView watchdog hard-refresh every ~45–60 seconds.
 *
 * Fix (per World docs): never let MiniKit-related code run on the server.
 * We don't use MiniKit's React context (we call MiniKit.sendTransaction() directly),
 * so calling MiniKit.install() in a useEffect is all we need.
 *
 * children are rendered normally by the server — no hydration mismatch.
 */
export function MiniKitClientProvider({
  appId,
  children,
}: {
  appId: string
  children: React.ReactNode
}) {
  useEffect(() => {
    MiniKit.install(appId)
    finalizeWorldAppDetection()
  }, [appId])

  return <>{children}</>
}
