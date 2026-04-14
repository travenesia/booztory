"use client"

import type React from "react"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    // refetchOnWindowFocus disabled: in World App, the WebView loses/regains focus every time
    // MiniKit shows native UI (wallet auth, tx confirmation). Default true would re-fetch the
    // session on each focus event, causing brief status flickers that re-trigger the World App
    // auth flow and make the app appear to hard-refresh.
    <NextAuthSessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </NextAuthSessionProvider>
  )
}
