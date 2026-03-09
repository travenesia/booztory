"use client"

import type React from "react"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { wagmiConfig, APP_CHAIN } from "@/lib/wagmi"
import "@rainbow-me/rainbowkit/styles.css"

const queryClient = new QueryClient()

export function WagmiRainbowProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme()} initialChain={APP_CHAIN}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
