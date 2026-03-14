"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
import { sdk } from "@farcaster/miniapp-sdk"

interface ContentSubmissionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ContentType = "youtube" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch"

export function ContentSubmissionDrawer({ open, onOpenChange }: ContentSubmissionDrawerProps) {
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
  const { toast } = useToast()

  // Keyboard and viewport handling
  const [viewportHeight, setViewportHeight] = useState<number>(0)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0)
  const initialViewportHeight = useRef<number>(0)
  const keyboardDetectionTimeout = useRef<NodeJS.Timeout | null>(null)

  const [isMiniApp, setIsMiniApp] = useState(false)

  // Use ref to track if we're currently processing to prevent race conditions
  const isProcessingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const { mintSlot, isProcessing, resetPaymentState, slotPrice } = usePayment()
  const slotPriceDisplay = (Number(slotPrice) / 1_000_000).toFixed(2)

  // Enhanced keyboard detection with debouncing
  const detectKeyboard = useCallback(() => {
    if (typeof window === "undefined") return

    const currentHeight = window.innerHeight
    const visualViewportHeight = window.visualViewport?.height || currentHeight

    // Clear any existing timeout
    if (keyboardDetectionTimeout.current) {
      clearTimeout(keyboardDetectionTimeout.current)
    }

    // Debounce the keyboard detection to prevent flickering
    keyboardDetectionTimeout.current = setTimeout(() => {
      // Store initial height on first load
      if (initialViewportHeight.current === 0) {
        initialViewportHeight.current = currentHeight
      }

      // Calculate if keyboard is visible (significant height reduction)
      const heightDifference = initialViewportHeight.current - visualViewportHeight
      const isKeyboard = heightDifference > 150 // More than 150px reduction indicates keyboard

      // Calculate keyboard height for positioning
      const calculatedKeyboardHeight = isKeyboard ? heightDifference : 0

      setIsKeyboardVisible(isKeyboard)
      setViewportHeight(visualViewportHeight)
      setKeyboardHeight(calculatedKeyboardHeight)

      console.log("🎹 Keyboard detection:", {
        isKeyboard,
        currentHeight,
        visualViewportHeight,
        heightDifference,
        keyboardHeight: calculatedKeyboardHeight,
      })
    }, 100) // 100ms debounce
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Set initial viewport height
      const initialHeight = window.innerHeight
      setViewportHeight(initialHeight)
      initialViewportHeight.current = initialHeight

      // Add event listeners with passive option for better performance
      window.addEventListener("resize", detectKeyboard, { passive: true })
      window.addEventListener("orientationchange", detectKeyboard, { passive: true })

      // Also listen for visual viewport changes (better keyboard detection on iOS)
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", detectKeyboard, { passive: true })
        window.visualViewport.addEventListener("scroll", detectKeyboard, { passive: true })
      }

      return () => {
        window.removeEventListener("resize", detectKeyboard)
        window.removeEventListener("orientationchange", detectKeyboard)

        if (window.visualViewport) {
          window.visualViewport.removeEventListener("resize", detectKeyboard)
          window.visualViewport.removeEventListener("scroll", detectKeyboard)
        }

        if (keyboardDetectionTimeout.current) {
          clearTimeout(keyboardDetectionTimeout.current)
        }
      }
    }
  }, [detectKeyboard])

  useEffect(() => {
    sdk.isInMiniApp().then(setIsMiniApp)
  }, [])

  // Complete state reset when drawer opens/closes
  const resetAllState = () => {
    console.log("🔄 Resetting all drawer state...")

    // Cancel any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Clear keyboard detection timeout
    if (keyboardDetectionTimeout.current) {
      clearTimeout(keyboardDetectionTimeout.current)
      keyboardDetectionTimeout.current = null
    }

    // Reset all form state
    setContentUrl("")
    setResolvedContentUrl(null)
    setContentType(null)
    setIsSubmitting(false)
    setIsValidUrl(false)
    setIsPreviewLoading(false)
    setPreviewError(null)
    setSubmissionStep("idle")

    // Reset keyboard state
    setIsKeyboardVisible(false)
    setKeyboardHeight(0)
    if (typeof window !== "undefined") {
      setViewportHeight(window.innerHeight)
      initialViewportHeight.current = window.innerHeight
    }

    // Reset processing flag
    isProcessingRef.current = false

    // Reset payment state
    resetPaymentState()

    console.log("✅ All drawer state reset complete")
  }

  useEffect(() => {
    if (!open) {
      resetAllState()
    } else {
      // When opening, create new abort controller and reset viewport
      abortControllerRef.current = new AbortController()
      if (typeof window !== "undefined") {
        const currentHeight = window.innerHeight
        setViewportHeight(currentHeight)
        initialViewportHeight.current = currentHeight
        setIsKeyboardVisible(false)
        setKeyboardHeight(0)
      }
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (keyboardDetectionTimeout.current) {
        clearTimeout(keyboardDetectionTimeout.current)
      }
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
    } else {
      const height = Math.min(200, (typeof window !== "undefined" ? window.innerWidth - 32 : 300) * (9 / 16))
      return { height: `${height}px`, width: "100%" }
    }
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

  // Calculate dynamic height and positioning to prevent flickering and ensure button visibility
  const getSheetContentStyle = () => {
    if (typeof window === "undefined") {
      return {
        maxHeight: "90vh",
        height: "auto",
        transition: "max-height 0.3s ease, bottom 0.3s ease",
      }
    }

    if (!isKeyboardVisible) {
      return {
        maxHeight: `${Math.min(window.innerHeight * 0.9, 700)}px`,
        height: "auto",
        transition: "max-height 0.3s ease, bottom 0.3s ease",
        bottom: "0px",
      }
    }

    // When keyboard is visible: shrink maxHeight to visual viewport, lift above keyboard.
    // In mini app WebViews the viewport already repositions — skip the bottom offset to avoid double-offset.
    const availableHeight = viewportHeight - 16

    return {
      maxHeight: `${availableHeight}px`,
      height: "auto",
      transition: "max-height 0.3s ease, bottom 0.3s ease",
      bottom: isMiniApp ? "0px" : `${keyboardHeight}px`,
    }
  }

  // Calculate content area height when keyboard is visible
  const getContentAreaStyle = () => {
    if (!isKeyboardVisible) {
      return {
        paddingBottom: "24px",
      }
    }

    // When keyboard is visible, leave room for header (~80px) and button (~60px)
    const availableContentHeight = viewportHeight - 80 - 60 - 20

    return {
      maxHeight: `${Math.max(availableContentHeight, 80)}px`,
      overflowY: "auto" as const,
      paddingBottom: "8px",
    }
  }

  // Button container style to keep it above keyboard
  const getButtonContainerStyle = () => {
    if (!isKeyboardVisible) {
      return {
        position: "relative" as const,
        paddingTop: "8px",
        paddingBottom: "24px",
      }
    }

    return {
      position: "sticky" as const,
      bottom: 0,
      backgroundColor: "#FFFFFF", // Match drawer background
      paddingTop: "12px",
      paddingBottom: "12px",
      borderTop: "1px solid #E5E7EB", // Light border to separate from content
      marginTop: "8px",
      zIndex: 10,
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl p-4 bg-gray-0 text-gray-900 overflow-hidden transition-all duration-400 ease-out"
        style={getSheetContentStyle()}
      >
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle className="text-lg text-gray-900 font-medium">Submit Content</SheetTitle>
          <SheetDescription className="text-xs text-gray-500">
            Pay {slotPriceDisplay} USDC to feature your content for 15 minutes
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {/* Scrollable content area */}
          <div className="flex-1 space-y-4" style={getContentAreaStyle()}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content-url" className="text-gray-900 font-medium text-xs">
                  Content URL
                </Label>
                {contentType && <div className="flex-shrink-0">{renderPlatformIcon()}</div>}
              </div>
              <div className="relative">
                {contentUrl && previewError && (
                  <HiExclamationTriangle className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 h-4 w-4 pointer-events-none z-10" />
                )}
                {contentUrl && isValidUrl && (
                  <HiCheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 h-4 w-4 pointer-events-none z-10" />
                )}
                <Input
                  id="content-url"
                  placeholder={getPlaceholderText()}
                  value={contentUrl}
                  onChange={handleUrlChange}
                  disabled={isAnyOperationInProgress}
                  className={`rounded-[5px] transition-colors duration-200 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                    !contentUrl
                      ? "bg-blue-50 border-blue-200 focus:border-blue-400 placeholder:text-blue-300"
                      : previewError
                        ? "bg-gray-0 border-gray-300 focus:border-gray-400 pl-9"
                        : isValidUrl
                          ? "bg-green-50 border-green-200 focus:border-green-400 pl-9"
                          : "bg-gray-0 border-gray-300 focus:border-gray-400"
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

          {/* Fixed button container */}
          <div style={getButtonContainerStyle()}>
            <Button
              className="w-full elegance-button h-10 !shadow-custom-sm hover:!shadow-custom-sm transition-all duration-200"
              onClick={handleSubmit}
              disabled={!isValidUrl || isAnyOperationInProgress || !session?.user?.id}
            >
              {isAnyOperationInProgress ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {getButtonText()}
                </div>
              ) : (
                getButtonText()
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
