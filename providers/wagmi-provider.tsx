"use client"

import type React from "react"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit"
import { wagmiConfig } from "@/lib/wagmi"
import "@rainbow-me/rainbowkit/styles.css"

const queryClient = new QueryClient()

export function WagmiRainbowProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme()} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
