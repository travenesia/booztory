"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { YouTubeIcon, TikTokIcon, TwitterIcon, VimeoIcon, SpotifyIcon, TwitchIcon } from "@/components/content/icon"
import { ContentEmbed } from "@/components/content/contentEmbed"
import { Loader2 } from "lucide-react"
import { HiExclamationTriangle, HiCheckCircle } from "react-icons/hi2"
import { isValidSpotifyUrl } from "@/lib/spotifyMetadata"
import { useToast } from "@/hooks/use-toast"
import confetti from "canvas-confetti"
import { extractTikTokId } from "@/lib/tiktokMetadata"
import { usePayment } from "@/hooks/usePayment"
import { useSession } from "next-auth/react"
import { extractYouTubeId, getYouTubeMetadata, isYouTubeShort } from "@/lib/youtubeMetadata"
import { getTikTokMetadata } from "@/lib/tiktokMetadata"
import { getVimeoMetadata, extractVimeoId } from "@/lib/vimeoMetadata"
import { getSpotifyMetadata } from "@/lib/spotifyMetadata"
import { getTwitchMetadata, extractTwitchInfo } from "@/lib/twitchMetadata"
import { useSubmitDrawer } from "@/providers/submit-drawer-provider"

type ContentType = "youtube" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch"

export function ContentSubmissionDrawer() {
  const { isOpen: open, setIsOpen: onOpenChange } = useSubmitDrawer()
  const { data: session } = useSession()
  const [contentUrl, setContentUrl] = useState("")
  const [resolvedContentUrl, setResolvedContentUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidUrl, setIsValidUrl] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [submissionStep, setSubmissionStep] = useState<"idle" | "processing_payment" | "submitting">("idle")
  const [detectedTikTokAspectRatio, setDetectedTikTokAspectRatio] = useState<"16:9" | "9:16">("9:16")
  const [isInputFocused, setIsInputFocused] = useState(false)
  const { toast } = useToast()

  // Use ref to track if we're currently processing to prevent race conditions
  const isProcessingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const { mintSlot, isProcessing, resetPaymentState, slotPrice } = usePayment()
  const slotPriceDisplay = (Number(slotPrice) / 1_000_000).toFixed(2)

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      setContentUrl("")
      setResolvedContentUrl(null)
      setContentType(null)
      setIsSubmitting(false)
      setIsValidUrl(false)
      setIsPreviewLoading(false)
      setPreviewError(null)
      setSubmissionStep("idle")
      isProcessingRef.current = false
      resetPaymentState()
    } else {
      abortControllerRef.current = new AbortController()
    }
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [open, resetPaymentState])

  const detectContentType = (url: string): ContentType | null => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
    if (url.includes("tiktok.com") || url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) return "tiktok"
    if (url.includes("twitter.com") || url.includes("x.com")) return "twitter"
    if (url.includes("vimeo.com")) return "vimeo"
    if (url.includes("spotify.com") || url.includes("open.spotify.com")) return "spotify"
    if (url.includes("twitch.tv") || url.includes("clips.twitch.tv")) return "twitch"
    return null
  }

  const extractTwitterId = (url: string): string | null => {
    const regExp = /\/status\/(\d+)/
    const match = url.match(regExp)
    return match ? match[1] : null
  }

  const validateUrl = (url: string, type: ContentType | null): boolean => {
    if (!type || !url) return false
    switch (type) {
      case "youtube":
        const patterns = [
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(youtu\.be\/)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]+)/,
        ]
        return patterns.some((pattern) => pattern.test(url))
      case "tiktok":
        return /^(https?:\/\/)?(www\.)?(tiktok\.com\/@[^/]+\/video\/\d+|vm\.tiktok\.com\/[a-zA-Z0-9]+|vt\.tiktok\.com\/[a-zA-Z0-9]+)/.test(
          url,
        )
      case "twitter":
        return !!extractTwitterId(url)
      case "vimeo":
        return /^(https?:\/\/)?(www\.)?vimeo\.com\/(\d+)/.test(url)
      case "spotify":
        return isValidSpotifyUrl(url)
      case "twitch":
        return !!extractTwitchInfo(url)
      default:
        return false
    }
  }

  const handleUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setContentUrl(url)
    setResolvedContentUrl(null)
    setDetectedTikTokAspectRatio("9:16")
    const type = detectContentType(url)
    setContentType(type)

    // Reset verification when URL changes
    setSubmissionStep("idle")

    const isGenerallyValid = validateUrl(url, type)
    setIsValidUrl(isGenerallyValid)

    if (isGenerallyValid) {
      setIsPreviewLoading(true)
      setPreviewError(null)

      if (type === "tiktok" && (url.includes("vm.tiktok.com/") || url.includes("vt.tiktok.com/"))) {
        try {
          // Check if operation was aborted
          if (abortControllerRef.current?.signal.aborted) return

          const response = await fetch(`/api/resolveTiktok?shortUrl=${encodeURIComponent(url)}`, {
            signal: abortControllerRef.current?.signal,
          })

          if (!response.ok) {
            throw new Error("Failed to resolve TikTok URL")
          }
          const data = await response.json()

          // Check again if operation was aborted
          if (abortControllerRef.current?.signal.aborted) return

          if (data.resolvedUrl) {
            setResolvedContentUrl(data.resolvedUrl)
            const finalId = extractTikTokId(data.resolvedUrl)
            if (!finalId) {
              setIsValidUrl(false)
              setPreviewError("Could not extract video ID from resolved TikTok URL.")
            } else {
              setIsValidUrl(true)
              // Detect aspect ratio from oEmbed metadata
              const meta = await getTikTokMetadata(data.resolvedUrl)
              if (meta) {
                setDetectedTikTokAspectRatio(meta.thumbnail_width > meta.thumbnail_height ? "16:9" : "9:16")
              }
            }
          } else {
            throw new Error(data.error || "Could not resolve TikTok shortlink")
          }
        } catch (error: any) {
          // Don't show error if operation was aborted
          if (error.name === "AbortError" || abortControllerRef.current?.signal.aborted) return

          setIsValidUrl(false)
          setPreviewError(error.message || "Failed to resolve TikTok shortlink.")
        }
      } else {
        setResolvedContentUrl(url)
        // Detect TikTok aspect ratio from oEmbed metadata for direct URLs
        if (type === "tiktok") {
          const meta = await getTikTokMetadata(url)
          if (meta) {
            setDetectedTikTokAspectRatio(meta.thumbnail_width > meta.thumbnail_height ? "16:9" : "9:16")
          }
        }
      }

      setTimeout(() => {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsPreviewLoading(false)
        }
      }, 500)
    } else {
      setPreviewError(url.length > 0 ? "Invalid URL format or unsupported link." : null)
      setIsPreviewLoading(false)
    }
  }

  // Pre-fetch thumbnail and metadata
  const fetchContentMetadata = async (contentType: ContentType, contentUrl: string) => {
    console.log("🖼️ Pre-fetching thumbnail and metadata for:", contentType, contentUrl)

    try {
      // Check if operation was aborted
      if (abortControllerRef.current?.signal.aborted) return null

      switch (contentType) {
        case "youtube": {
          const videoId = extractYouTubeId(contentUrl)
          if (videoId) {
            const metadata = await getYouTubeMetadata(videoId)
            return {
              title: metadata?.title,
              authorName: metadata?.author_name,
              thumbnailUrl: metadata?.thumbnail_url,
            }
          }
          break
        }
        case "tiktok": {
          const metadata = await getTikTokMetadata(contentUrl)
          const tiktokAspectRatio: "16:9" | "9:16" =
            metadata && metadata.thumbnail_width > metadata.thumbnail_height ? "16:9" : "9:16"
          return {
            title: metadata?.title,
            authorName: metadata?.author_name,
            thumbnailUrl: metadata?.thumbnail_url,
            aspectRatio: tiktokAspectRatio,
          }
        }
        case "vimeo": {
          const videoId = extractVimeoId(contentUrl)
          if (videoId) {
            const metadata = await getVimeoMetadata(videoId)
            return {
              title: metadata?.title,
              authorName: metadata?.author_name,
              thumbnailUrl: metadata?.thumbnail_url,
            }
          }
          break
        }
        case "spotify": {
          const metadata = await getSpotifyMetadata(contentUrl)
          return {
            title: metadata?.title,
            authorName: metadata?.author_name || "Spotify",
            thumbnailUrl: metadata?.thumbnail_url,
          }
        }
        case "twitter": {
          return {
            title: "Twitter Post",
            authorName: "Twitter User",
            thumbnailUrl: "/placeholder.svg?height=180&width=320&text=Twitter+Post",
          }
        }
        case "twitch": {
          const metadata = await getTwitchMetadata(contentUrl)
          return {
            title: metadata?.title,
            authorName: metadata?.author_name,
            thumbnailUrl: metadata?.thumbnail_url,
          }
        }
      }
    } catch (error) {
      // Don't log error if operation was aborted
      if (abortControllerRef.current?.signal.aborted) return null
      console.error("❌ Error fetching content metadata:", error)
    }

    // Fallback thumbnail based on content type
    const fallbackThumbnails = {
      youtube: "/placeholder.svg?height=180&width=320&text=YouTube+Video",
      tiktok: "/placeholder.svg?height=320&width=180&text=TikTok+Video",
      twitter: "/placeholder.svg?height=180&width=320&text=Twitter+Post",
      vimeo: "/placeholder.svg?height=180&width=320&text=Vimeo+Video",
      spotify: "/placeholder.svg?height=180&width=320&text=Spotify+Music",
      twitch: "/placeholder.svg?height=180&width=320&text=Twitch+Stream",
    }

    return {
      title: "Content Title",
      authorName: "Creator",
      thumbnailUrl: fallbackThumbnails[contentType],
    }
  }

  const handleSubmit = async () => {
    const urlToSubmit = resolvedContentUrl || contentUrl
    if (!contentType || !urlToSubmit || !isValidUrl) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid URL before submitting.",
        variant: "destructive",
      })
      return
    }

    // Check authentication
    if (!session?.user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be signed in to submit content.",
        variant: "destructive",
      })
      return
    }

    // Prevent multiple submissions
    if (isProcessingRef.current || isSubmitting || isProcessing) {
      console.log("🚫 Submission already in progress, ignoring...")
      return
    }

    isProcessingRef.current = true
    setIsSubmitting(true)

    try {
      // Check if operation was aborted
      if (abortControllerRef.current?.signal.aborted) return

      console.log("🚀 Starting content submission process...")
      console.log("User:", { id: session.user.id, username: session.user.username, wallet: session.user.walletAddress })
      console.log("Content:", { type: contentType, url: urlToSubmit })

      // Check if operation was aborted
      if (abortControllerRef.current?.signal.aborted) return

      // Step 1: Fetch metadata and thumbnail
      console.log("🖼️ Fetching content metadata and thumbnail...")
      setSubmissionStep("submitting")
      const metadata = await fetchContentMetadata(contentType, urlToSubmit)

      if (abortControllerRef.current?.signal.aborted) return

      const getAspectRatio = (): "16:9" | "9:16" => {
        switch (contentType) {
          case "youtube":
            return urlToSubmit.includes("shorts") || isYouTubeShort(urlToSubmit) ? "9:16" : "16:9"
          case "twitter":
          case "vimeo":
          case "spotify":
          case "twitch":
            return "16:9"
          case "tiktok":
            return (metadata?.aspectRatio as "16:9" | "9:16") ?? detectedTikTokAspectRatio
          default:
            return "16:9"
        }
      }

      // Step 2: Approve USDC + mint slot on-chain
      console.log("💳 Minting slot on-chain...")
      setSubmissionStep("processing_payment")
      const mintResult = await mintSlot({
        contentUrl: urlToSubmit,
        contentType: contentType,
        aspectRatio: getAspectRatio(),
        title: metadata?.title || "",
        authorName: metadata?.authorName || "",
        imageUrl: metadata?.thumbnailUrl || "/placeholder.svg?height=180&width=320&text=Content",
      })

      if (abortControllerRef.current?.signal.aborted) return

      if (!mintResult.success) {
        if (mintResult.error === "Payment was cancelled") {
          toast({ title: "Payment Cancelled", description: "Content submission was cancelled." })
          return
        }
        throw new Error(mintResult.error || "Mint failed")
      }

      console.log("✅ Slot minted on-chain")

      // Trigger immediate content refresh on the main page
      if (typeof window !== "undefined") {
        // Dispatch a custom event to notify the main page
        window.dispatchEvent(new CustomEvent("contentSubmitted"))
      }


      // Only proceed with success actions if not aborted
      if (!abortControllerRef.current?.signal.aborted) {
        onOpenChange(false)

        toast({
          title: "Content Submitted!",
          description: "Your content has been scheduled and will appear shortly.",
          duration: 5000,
        })

        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.5, x: 0.5 },
          angle: 90,
          startVelocity: 45,
        })
      }

      // Note: State will be reset by the useEffect when drawer closes
    } catch (error) {
      // Don't show error if operation was aborted
      if (error instanceof Error && (error.name === "AbortError" || abortControllerRef.current?.signal.aborted)) {
        console.log("🚫 Operation was aborted")
        return
      }

      console.error("❌ Content submission failed:", error)
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit content. Please try again.",
        variant: "destructive",
      })
    } finally {
      // Only reset states if not aborted (drawer closing will handle reset)
      if (!abortControllerRef.current?.signal.aborted) {
        setIsSubmitting(false)
        setSubmissionStep("idle")
        isProcessingRef.current = false
      }
    }
  }

  const renderPlatformIcon = () => {
    switch (contentType) {
      case "youtube":
        return (
          <div className="pointer-events-none">
            <YouTubeIcon />
          </div>
        )
      case "tiktok":
        return (
          <div className="pointer-events-none">
            <TikTokIcon />
          </div>
        )
      case "twitter":
        return (
          <div className="pointer-events-none">
            <TwitterIcon />
          </div>
        )
      case "vimeo":
        return (
          <div className="pointer-events-none">
            <VimeoIcon />
          </div>
        )
      case "spotify":
        return (
          <div className="pointer-events-none">
            <SpotifyIcon />
          </div>
        )
      case "twitch":
        return (
          <div className="pointer-events-none">
            <TwitchIcon />
          </div>
        )
      default:
        return null
    }
  }

  const getPlaceholderText = () => {
    switch (contentType) {
      case "youtube":
        return "https://youtube.com/watch?v=ID, youtu.be/ID, /shorts/ID, /live/ID, etc."
      case "tiktok":
        return "https://tiktok.com/@username/video/ID or vm.tiktok.com/XYZ"
      case "twitter":
        return "https://twitter.com/username/status/ID"
      case "vimeo":
        return "https://vimeo.com/ID"
      case "spotify":
        return "https://open.spotify.com/track/ID or album/ID etc."
      case "twitch":
        return "https://twitch.tv/channel, twitch.tv/videos/ID, or clips.twitch.tv/ClipID"
      default:
        return "Paste YouTube, TikTok, Twitter, Vimeo, Spotify, or Twitch URL"
    }
  }

  const urlForPreview = resolvedContentUrl || contentUrl

  const getPreviewContainerStyle = () => {
    const isPortrait =
      (contentType === "tiktok" && detectedTikTokAspectRatio === "9:16") ||
      (contentType === "youtube" && urlForPreview.includes("shorts"))
    if (isPortrait) {
      const width = 200 * (9 / 16)
      return { maxHeight: "200px", height: "200px", width: `${width}px`, margin: "0 auto" }
    }
    return { height: "200px", width: "100%" }
  }

  const getButtonText = () => {
    if (!session?.user?.id) return "Connect Wallet to Submit"

    if (isSubmitting) {
      switch (submissionStep) {
        case "processing_payment":
          return "Processing Payment..."
        case "submitting":
          return "Submitting..."
        default:
          return "Submitting..."
      }
    }

    if (isProcessing) return "Processing Payment..."

    return `Pay ${slotPriceDisplay} USDC to Submit`
  }

  // Check if any operation is in progress
  const isAnyOperationInProgress = isSubmitting || isProcessing || isProcessingRef.current

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl bg-white text-gray-900 outline-none flex flex-col overflow-hidden max-h-[90vh] p-0"
      >
        {/* Drag handle */}
        <div className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-gray-300 flex-shrink-0" />

        <SheetHeader className="px-4 pt-2 pb-3 flex-shrink-0 text-left">
          <SheetTitle className="text-lg text-gray-900 font-medium">Submit Content</SheetTitle>
          <SheetDescription className="text-xs text-gray-500 mt-1">
            Pay {slotPriceDisplay} USDC to feature your content for 15 minutes
          </SheetDescription>
        </SheetHeader>

        {/* Content area */}
        <div className="px-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="content-url" className="text-gray-900 font-medium text-xs">
                Content URL
              </label>
              {contentType && <div className="flex-shrink-0">{renderPlatformIcon()}</div>}
            </div>
            <div className="relative">
              {contentUrl && previewError && !isInputFocused && (
                <HiExclamationTriangle className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 h-4 w-4 pointer-events-none z-10" />
              )}
              {contentUrl && isValidUrl && (
                <HiCheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 h-4 w-4 pointer-events-none z-10" />
              )}
              <input
                id="content-url"
                type="text"
                placeholder={getPlaceholderText()}
                value={contentUrl}
                onChange={handleUrlChange}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                disabled={isAnyOperationInProgress}
                className={`w-full h-9 rounded-[5px] border px-3 text-sm text-gray-900 outline-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  !contentUrl
                    ? "bg-blue-50 border-blue-200 focus:border-blue-400 placeholder:text-blue-300"
                    : previewError && !isInputFocused
                      ? "bg-white border-gray-300 focus:border-gray-400 pl-9"
                      : isValidUrl
                        ? "bg-green-50 border-green-200 focus:border-green-400 pl-9"
                        : "bg-white border-gray-300 focus:border-gray-400"
                }`}
              />
            </div>
          </div>

          {contentType && urlForPreview && (
            <div className="border rounded-[5px] p-3 bg-gray-0 border-gray-300 transition-all duration-200">
              <div className="text-xs font-medium mb-2 text-gray-900">Preview</div>
              {isPreviewLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : isValidUrl && urlForPreview ? (
                <div className="rounded-[5px] overflow-hidden" style={getPreviewContainerStyle()}>
                  <ContentEmbed
                    contentType={contentType}
                    contentUrl={urlForPreview}
                    aspectRatio={
                      contentType === "tiktok"
                        ? detectedTikTokAspectRatio
                        : contentType === "youtube" && urlForPreview.includes("shorts")
                          ? "9:16"
                          : "16:9"
                    }
                    isPreview={true}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] bg-gray-100 rounded-[5px]">
                  <span className="text-xs text-gray-700">Invalid URL format or unable to load preview.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Button — always pinned at bottom */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 mt-0.5 border-t border-gray-100 bg-white">
          <button
            className="w-full elegance-button h-10 !shadow-custom-sm hover:!shadow-custom-sm transition-all duration-200 inline-flex items-center justify-center text-sm font-medium disabled:pointer-events-none disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!isValidUrl || isAnyOperationInProgress || !session?.user?.id}
          >
            {isAnyOperationInProgress ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {getButtonText()}
              </>
            ) : (
              getButtonText()
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
