"use client"

import { useState, useEffect, useRef } from "react"
import { sdk } from "@farcaster/miniapp-sdk"
import { Topbar } from "@/components/layout/topbar"
import { Navbar } from "@/components/layout/navbar"
import { ContentCard } from "@/components/content/contentCard"
import { Button } from "@/components/ui/button"
import { RotatingWords } from "@/components/ui/rotating-words"
import { HiMiniPlus } from "react-icons/hi2"
import { useToast } from "@/hooks/use-toast"
import { useSubmitDrawer } from "@/providers/submit-drawer-provider"
import { useSession } from "next-auth/react"
import { useCurrentSlot } from "@/hooks/useContractContent"
import { useIsMobile } from "@/hooks/use-mobile"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"

export default function Home() {
  const { data: session, status } = useSession()
  const { setIsOpen: setDrawerOpen } = useSubmitDrawer()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1280)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const isConnected = status === "authenticated"

  const { content, isPlaceholder, isLoading, refetch, contractUsdcBalance } = useCurrentSlot()
  const readyCalled = useRef(false)

  // Signal to the Farcaster/Base mini app shell that the app is ready once content loads
  useEffect(() => {
    if (!isLoading && !readyCalled.current) {
      readyCalled.current = true
      sdk.isInMiniApp().then((inMiniApp) => {
        if (inMiniApp) sdk.actions.ready()
      })
    }
  }, [isLoading])

  // Refresh on content events and suspension resume
  useEffect(() => {
    const handleContentSubmitted = () => refetch()
    const handleDonationCompleted = () => refetch()
    const handleRefreshNeeded = () => refetch()

    window.addEventListener("contentSubmitted", handleContentSubmitted)
    window.addEventListener("donationCompleted", handleDonationCompleted)
    window.addEventListener("contentRefreshNeeded", handleRefreshNeeded)

    return () => {
      window.removeEventListener("contentSubmitted", handleContentSubmitted)
      window.removeEventListener("donationCompleted", handleDonationCompleted)
      window.removeEventListener("contentRefreshNeeded", handleRefreshNeeded)
    }
  }, [refetch])

  // Auto-refetch exactly when the current slot expires so the next slot loads immediately
  useEffect(() => {
    if (!content || isPlaceholder) return
    const msLeft = content.endTime - Date.now()
    if (msLeft <= 0) {
      refetch()
      return
    }
    const timer = setTimeout(() => refetch(), msLeft + 500)
    return () => clearTimeout(timer)
  }, [content?.id, content?.endTime, isPlaceholder, refetch])

  const handleFabClick = () => {
    if (status !== "authenticated") {
      toast({
        title: "Connect Wallet First",
        description: "You need to connect your wallet to submit content.",
        variant: "destructive",
      })
      return
    }
    setDrawerOpen(true)
  }

  const getTimeLeft = () => {
    if (!content || isPlaceholder) return 2
    return Math.ceil(Math.max(0, content.endTime - Date.now()) / 60000)
  }

  const cardNode = content && (
    <ContentCard
      username={content.username}
      contentType={content.contentType}
      imageUrl={content.imageUrl}
      timeLeft={getTimeLeft()}
      donations={isPlaceholder ? contractUsdcBalance : content.donations}
      aspectRatio={content.aspectRatio}
      contentUrl={content.contentUrl}
      isPlaceholder={isPlaceholder}
      endTime={content.endTime}
      isConnected={isConnected}
      tokenId={isPlaceholder ? undefined : BigInt(content.id)}
      submittedBy={content.submittedBy}
      authorName={content.authorName}
    />
  )

  return (
    <main className="min-h-screen flex flex-col">
      <Topbar />

      {/* Mobile + tablet layout */}
      <div className="xl:hidden flex-1 flex flex-col relative pt-4 pb-4 px-6 items-center justify-center mt-12 mb-12">
        <div className="w-full max-w-md flex flex-col gap-2">
          {isLoading ? (
            <div className="w-full animate-pulse">
              <Skeleton className="w-full rounded-t-[5px] bg-gray-200" style={{ height: "320px" }} />
              <div className="h-8 w-full bg-red-900/20 rounded-b-[5px] flex items-center px-2 gap-2">
                <Skeleton className="h-5 w-5 rounded bg-red-300/40 flex-shrink-0" />
                <Skeleton className="h-3 w-24 bg-red-300/40" />
                <div className="ml-auto flex items-center gap-3 pr-1">
                  <Skeleton className="h-3 w-10 bg-red-300/40" />
                  <Skeleton className="h-3 w-10 bg-red-300/40" />
                </div>
              </div>
            </div>
          ) : (
            !isDesktop && cardNode
          )}
        </div>
      </div>

      {/* Desktop two-column layout — breaks out of max-w-[650px] to fill full viewport */}
      <div className="hidden xl:grid xl:grid-cols-2 xl:gap-12 xl:items-center flex-1 px-12 mt-12 xl:w-screen xl:ml-[calc(50%-50vw)]">
        {/* Left: platform info + CTA */}
        <div className="flex flex-col justify-center space-y-6 py-12">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-red-600 uppercase">
            <motion.span
              className="inline-block w-2 h-2 rounded-full bg-red-600"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            Live Spotlight
          </p>
          <h1 className="text-[48px] font-bold text-gray-900 leading-snug">
            Your content{" "}
            <RotatingWords
              words={["seen", "live", "rewarded"]}
              className="text-amber-500"
            />
          </h1>
          <p className="text-base text-gray-500 leading-relaxed">
            <span className="italic">No algorithm. No gatekeepers.</span>
            <br />
            Every <span className="font-bold text-gray-900">15 minutes</span>, one creator owns the spotlight.
            <br />
            Pay <span className="font-bold text-gray-900">1 USDC</span> and make it yours.
          </p>
          <Button
            onClick={handleFabClick}
            className="w-fit px-6 py-3 text-white font-medium elegance-button shadow-custom-sm hover:shadow-custom-sm flex items-center gap-2"
          >
            <HiMiniPlus size={18} />
            Submit Content
          </Button>
        </div>

        {/* Right: content card */}
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          {isLoading ? (
            <div className="w-full animate-pulse">
              <Skeleton className="w-full rounded-t-[5px] bg-gray-200" style={{ height: "320px" }} />
              <div className="h-8 w-full bg-red-900/20 rounded-b-[5px] flex items-center px-2 gap-2">
                <Skeleton className="h-5 w-5 rounded bg-red-300/40 flex-shrink-0" />
                <Skeleton className="h-3 w-24 bg-red-300/40" />
                <div className="ml-auto flex items-center gap-3 pr-1">
                  <Skeleton className="h-3 w-10 bg-red-300/40" />
                  <Skeleton className="h-3 w-10 bg-red-300/40" />
                </div>
              </div>
            </div>
          ) : (
            isDesktop && cardNode
          )}
        </div>
      </div>

      <Navbar />
    </main>
  )
}
