"use client"

import { useState, useEffect } from "react"
import { Topbar } from "@/components/layout/topbar"
import { Navbar } from "@/components/layout/navbar"
import { ContentCard } from "@/components/content/contentCard"
import { ContentSubmissionDrawer } from "@/components/modals/submitContent"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { useCurrentSlot } from "@/hooks/useContractContent"

export default function Home() {
  const { data: session, status } = useSession()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { toast } = useToast()

  const isConnected = status === "authenticated"

  const { content, isPlaceholder, isLoading, refetch } = useCurrentSlot()

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

  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Topbar />
      <div className="flex-1 flex flex-col relative pt-4 pb-4 px-6 items-center justify-center mt-12 mb-12">
        {isLoading ? (
          <div className="animate-pulse bg-gray-200 rounded-lg w-full max-w-md h-96" />
        ) : (
          content && (
            <ContentCard
              username={content.username}
              contentType={content.contentType}
              imageUrl={content.imageUrl}
              timeLeft={getTimeLeft()}
              donations={content.donations}
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
        )}
      </div>
      <Button
        onClick={handleFabClick}
        className="fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px))] right-6 h-16 w-16 rounded-full bg-red-700 hover:bg-red-800 text-white shadow-custom-sm hover:shadow-custom-sm z-50 elegance-button flex items-center justify-center p-0"
        aria-label="Submit Content"
      >
        <Plus size={48} strokeWidth={2.5} />
      </Button>
      <ContentSubmissionDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
      <Navbar />
    </main>
  )
}
