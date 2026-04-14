"use client"

import type React from "react"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit"
import { wagmiConfig } from "@/lib/wagmi"
import "@rainbow-me/rainbowkit/styles.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // World App's WebView loses/regains focus on every MiniKit flow (sendTransaction,
      // walletAuth). With the default true, ALL wagmi useReadContract queries fire
      // simultaneously on each focus event — a burst that can cause the WebView to
      // appear frozen and World App to hard-reload the mini app. Time-based
      // refetchInterval is sufficient for keeping contract data fresh.
      refetchOnWindowFocus: false,
    },
  },
})

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
