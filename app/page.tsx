"use client"

import { useState, useEffect, useRef } from "react"
import { sdk } from "@farcaster/miniapp-sdk"
import { Topbar } from "@/components/layout/topbar"
import { Navbar } from "@/components/layout/navbar"
import { ContentCard } from "@/components/content/contentCard"
import { ContentSubmissionDrawer } from "@/components/modals/submitContent"
import { Button } from "@/components/ui/button"
import { RotatingWords } from "@/components/ui/rotating-words"
import { HiMiniPlus } from "react-icons/hi2"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { useCurrentSlot } from "@/hooks/useContractContent"
import { useIsMobile } from "@/hooks/use-mobile"
import { motion } from "framer-motion"

export default function Home() {
  const { data: session, status } = useSession()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { toast } = useToast()
  const isMobile = useIsMobile()

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
    if (!isConnected) {
      toast({
        title: "Connect Wallet First",
        description: "You need to connect your wallet to submit content.",
        variant: "destructive",
      })
    } else {
      setIsDrawerOpen(true)
    }
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
    <main className="min-h-screen flex flex-col bg-white">
      <Topbar />

      {/* Mobile layout */}
      <div className="md:hidden flex-1 flex flex-col relative pt-4 pb-4 px-6 items-center justify-center mt-12 mb-12">
        {isLoading ? (
          <div className="animate-pulse bg-gray-200 rounded-lg w-full max-w-md h-96" />
        ) : (
          isMobile && cardNode
        )}
      </div>

      {/* Desktop two-column layout — breaks out of max-w-[650px] to fill full viewport */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-12 md:items-center flex-1 px-12 mt-12 md:w-screen md:ml-[calc(50%-50vw)]">
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
            className="w-fit px-6 py-3 text-white font-medium rounded-full elegance-button shadow-custom-sm hover:shadow-custom-sm flex items-center gap-2"
          >
            <HiMiniPlus size={18} />
            Submit Content
          </Button>
        </div>

        {/* Right: content card */}
        <div className="flex items-center justify-center py-8">
          {isLoading ? (
            <div className="animate-pulse bg-gray-200 rounded-lg w-full h-96" />
          ) : (
            !isMobile && cardNode
          )}
        </div>
      </div>

      {/* FAB — mobile only */}
      <Button
        onClick={handleFabClick}
        className="md:hidden fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px))] right-6 h-16 w-16 rounded-full text-white shadow-custom-sm hover:shadow-custom-sm z-50 elegance-button flex items-center justify-center p-0 [&_svg]:size-auto"
        aria-label="Submit Content"
      >
        <HiMiniPlus size={36} />
      </Button>
      <ContentSubmissionDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
      <Navbar />
    </main>
  )
}
