import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { ScrollToTop } from "@/components/layout/scrollToTop"
import { Toaster } from "@/components/ui/toaster"
import { SessionProvider } from "@/providers/session-provider"
import { WagmiRainbowProvider } from "@/providers/wagmi-provider"
import { MiniAppInit } from "@/components/miniapp-init"

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
})

export const metadata: Metadata = {
  title: "Booztory - Boost Your Content",
  description: "Advertise your content by paying 1 USDC for a 15-minute featured slot",
  icons: {
    icon: "/favicon.ico",
  },
  other: {
    "base:app_id": "69af300b298d227d6bc5439f",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${inter.variable} font-sans bg-elegance-ethereal-ivory min-h-screen`}>
        <SessionProvider>
          <WagmiRainbowProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
              <MiniAppInit />
              <ScrollToTop />
              <div className="mx-auto max-w-[650px] min-h-screen relative">{children}</div>
              <Toaster />
            </ThemeProvider>
          </WagmiRainbowProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
