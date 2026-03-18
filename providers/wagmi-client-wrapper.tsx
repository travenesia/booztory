"use client"

import dynamic from "next/dynamic"
import type React from "react"

const WagmiRainbowProvider = dynamic(
  () => import("./wagmi-provider").then((m) => m.WagmiRainbowProvider),
  { ssr: false },
)

export function WagmiClientWrapper({ children }: { children: React.ReactNode }) {
  return <WagmiRainbowProvider>{children}</WagmiRainbowProvider>
}
