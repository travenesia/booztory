import type React from "react"
import type { Metadata, Viewport } from "next"
import { Nunito } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { ScrollToTop } from "@/components/layout/scrollToTop"
import { Toaster } from "@/components/ui/toaster"
import { SessionProvider } from "@/providers/session-provider"
import { WagmiClientWrapper } from "@/providers/wagmi-client-wrapper"
import { MiniAppInit } from "@/components/miniapp-init"
import { FlickeringGrid } from "@/components/ui/flickering-grid"
import { SubmitDrawerProvider } from "@/providers/submit-drawer-provider"
import { ContentSubmissionDrawer } from "@/components/modals/submitContent"
import { SponsorAdSidebar } from "@/components/ads/sponsorAd"

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
  preload: true,
})

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = process.env.NEXT_PUBLIC_URL as string

  return {
    title: "Booztory",
    description: "Boost Your Content",
    icons: {
      icon: "/favicon.ico",
    },
    other: {
      "base:app_id": "69af300b298d227d6bc5439f",
      "fc:miniapp": JSON.stringify({
        version: "next",
        imageUrl: `${appUrl}/hero.png`,
        button: {
          title: "Launch Booztory",
          action: {
            type: "launch_miniapp",
            name: "Booztory",
            url: appUrl,
            splashImageUrl: `${appUrl}/logo-color.svg`,
            splashBackgroundColor: "#ffffff",
          },
        },
      }),
    },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
  interactiveWidget: "resizes-visual",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body suppressHydrationWarning className={`${nunito.variable} font-sans bg-elegance-ethereal-ivory min-h-screen`}>
        <FlickeringGrid
          className="fixed inset-0 z-0 pointer-events-none"
          color="#000000"
          maxOpacity={0.08}
          flickerChance={0.1}
          squareSize={4}
          gridGap={6}
        />
        <SessionProvider>
          <WagmiClientWrapper>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
              <SubmitDrawerProvider>
                <MiniAppInit />
                <ScrollToTop />
                <div className="mx-auto max-w-[650px] min-h-screen relative z-10">{children}</div>
                <SponsorAdSidebar />
                <ContentSubmissionDrawer />
                <Toaster />
              </SubmitDrawerProvider>
            </ThemeProvider>
          </WagmiClientWrapper>
        </SessionProvider>
      </body>
    </html>
  )
}
