"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { formatUnits } from "viem"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useIsMobile } from "@/hooks/use-mobile"
import { YouTubeIcon, YouTubeShortsIcon, TikTokIcon, TwitterIcon, VimeoIcon, SpotifyIcon, TwitchIcon } from "@/components/content/icon"
import { ContentEmbed } from "@/components/content/contentEmbed"
import { Loader2 } from "lucide-react"
import { HiExclamationTriangle, HiCheckCircle, HiBolt } from "react-icons/hi2"
import { cn } from "@/lib/utils"
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
import { TOKEN_ADDRESS, ERC20_ABI, BOOZTORY_ADDRESS, BOOZTORY_ABI } from "@/lib/contract"
import { APP_CHAIN, NFT_CHAIN_ID } from "@/lib/wagmi"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type PaymentMethod = "standard" | "discount" | "free" | "nft-discount" | "nft-free"
type InputMode = "url" | "text"

function formatCooldown(secsLeft: number): string {
  const d = Math.floor(secsLeft / 86400)
  const h = Math.floor((secsLeft % 86400) / 3600)
  const m = Math.floor((secsLeft % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

type ContentType = "youtube" | "youtubeshorts" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch"

const URL_LINK_PATTERN = /https?:\/\/|www\./i

export function ContentSubmissionDrawer() {
  const { isOpen: open, setIsOpen: onOpenChange } = useSubmitDrawer()
  const { data: session } = useSession()
  const { address } = useAccount()
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("standard")
  const [inputMode, setInputMode] = useState<InputMode>("url")
  const [textContent, setTextContent] = useState("")
  const [textLinkError, setTextLinkError] = useState(false)
  const { toast } = useToast()
  const isMobile = useIsMobile()

  // Use ref to track if we're currently processing to prevent race conditions
  const isProcessingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    mintSlot,
    mintSlotWithDiscount,
    mintSlotWithTokens,
    mintSlotWithNFTDiscount,
    mintSlotFreeWithNFT,
    isProcessing,
    paymentStep,
    resetPaymentState,
    slotPrice,
    discountBurnCost,
    freeSlotCost,
    discountAmount,
  } = usePayment()

  // ── NFT state ─────────────────────────────────────────────────────────────────
  const [nftSelectedContract, setNftSelectedContract] = useState<string>("")
  const [nftTokenIdInput, setNftTokenIdInput] = useState<string>("")
  const [nftSelectedTokenId, setNftSelectedTokenId] = useState<string>("")

  const slotPriceDisplay = (Number(slotPrice) / 1_000_000).toFixed(2)
  const discountedPriceDisplay = ((Number(slotPrice) - Number(discountAmount)) / 1_000_000).toFixed(2)
  const discountBurnDisplay = Math.round(Number(formatUnits(discountBurnCost, 18))).toLocaleString()
  const freeSlotCostDisplay = Math.round(Number(formatUnits(freeSlotCost, 18))).toLocaleString()
  const tokenEnabled = TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000"

  // Queue status
  const { data: queueSizeRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getQueueSize",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 15_000 },
  })
  const { data: maxQueueSizeRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "maxQueueSize",
    chainId: APP_CHAIN.id,
  })
  const { data: queueEndTimeRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "queueEndTime",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 15_000 },
  })
  const { data: slotDurationRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "slotDuration",
    chainId: APP_CHAIN.id,
  })

  const slotDurationSecs = Number(slotDurationRaw ?? 900n)
  const slotDurationDisplay = slotDurationSecs >= 3600
    ? `${slotDurationSecs / 3600} hour${slotDurationSecs / 3600 !== 1 ? "s" : ""}`
    : `${slotDurationSecs / 60} minutes`

  const queueSize = Number(queueSizeRaw ?? 0n)
  const maxQueue = Number(maxQueueSizeRaw ?? 96n)
  const isQueueFull = queueSize >= maxQueue

  function formatTimeUntil(unixSeconds: number): string {
    const diff = unixSeconds - Math.floor(Date.now() / 1000)
    if (diff <= 0) return "soon"
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `~${Math.ceil(diff / 60)} min`
    return `~${Math.ceil(diff / 3600)} hr`
  }

  const nextOpenTime = isQueueFull && queueEndTimeRaw && slotDurationRaw
    ? Number(queueEndTimeRaw as bigint) - (maxQueue - 1) * Number(slotDurationRaw as bigint)
    : null

  // BOOZ balance
  const { data: boozBalanceRaw } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: tokenEnabled && !!address },
  })
  const boozBalance = boozBalanceRaw ? Number(formatUnits(boozBalanceRaw as bigint, 18)) : 0
  const boozFormatted = boozBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const canDiscount = tokenEnabled && boozBalance >= Number(formatUnits(discountBurnCost, 18))
  const canFree = tokenEnabled && boozBalance >= Number(formatUnits(freeSlotCost, 18))

  // ── NFT reads ─────────────────────────────────────────────────────────────────
  const isNFTPath = paymentMethod === "nft-discount" || paymentMethod === "nft-free"
  const { data: approvedNFTsRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getApprovedNFTContracts",
    chainId: APP_CHAIN.id,
    query: { enabled: !!address },
  })
  const approvedNFTs = (approvedNFTsRaw as string[] | undefined) ?? []

  const { data: nftBalancesRaw } = useReadContracts({
    contracts: approvedNFTs.map(nft => ({
      address: nft as `0x${string}`,
      abi: [{ name: "balanceOf", type: "function", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" }] as const,
      functionName: "balanceOf" as const,
      args: [address!] as const,
      chainId: NFT_CHAIN_ID,
    })),
    query: { enabled: !!address && approvedNFTs.length > 0 },
  })

  // NFT contracts where user has ≥1 token
  const heldNFTs: string[] = approvedNFTs.filter((_, i) => {
    const bal = nftBalancesRaw?.[i]?.result as bigint | undefined
    return bal != null && bal > 0n
  })
  const hasNFT = heldNFTs.length > 0

  // Auto-select first held NFT contract when switching to NFT path
  const nftContractForMint = (nftSelectedContract || heldNFTs[0] || "") as `0x${string}`

  // Enumerate owned token IDs via Alchemy NFT API (works on any ERC-721, no Enumerable needed)
  const [ownedTokenIds, setOwnedTokenIds] = useState<string[]>([])
  const [isEnumerating, setIsEnumerating] = useState(false)

  const { data: nftCollectionNameRaw } = useReadContract({
    address: nftContractForMint || undefined,
    abi: [{ name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }] as const,
    functionName: "name",
    chainId: NFT_CHAIN_ID,
    query: { enabled: isNFTPath && !!nftContractForMint },
  })
  const nftCollectionName = (nftCollectionNameRaw as string | undefined) ?? ""

  useEffect(() => {
    if (!isNFTPath || !address || !nftContractForMint || nftContractForMint === "") {
      setOwnedTokenIds([])
      return
    }
    const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    if (!alchemyKey) return
    let cancelled = false
    setIsEnumerating(true)
    setOwnedTokenIds([])
    fetch(
      `https://base-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${address}&contractAddresses[]=${nftContractForMint}&withMetadata=false&pageSize=50`
    )
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const ids: string[] = (data?.ownedNfts ?? []).map((n: { tokenId: string }) => n.tokenId)
        setOwnedTokenIds(ids)
      })
      .catch(() => { if (!cancelled) setOwnedTokenIds([]) })
      .finally(() => { if (!cancelled) setIsEnumerating(false) })
    return () => { cancelled = true }
  }, [isNFTPath, address, nftContractForMint])

  const canEnumerate = ownedTokenIds.length > 0

  // Active token ID — from dropdown when enumerable, from manual input as fallback
  const activeTokenIdStr = canEnumerate ? nftSelectedTokenId : nftTokenIdInput
  const nftTokenId = activeTokenIdStr ? BigInt(activeTokenIdStr) : 0n
  const canNFTMint = hasNFT && nftContractForMint !== "" && activeTokenIdStr !== "" && !isNaN(Number(activeTokenIdStr)) && Number(activeTokenIdStr) >= 0

  // ── NFT cooldown reads ─────────────────────────────────────────────────────────
  const { data: lastDiscountRaw } = useReadContract({
    address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI,
    functionName: "nftLastDiscountMint",
    args: [nftContractForMint, nftTokenId],
    chainId: APP_CHAIN.id,
    query: { enabled: canNFTMint },
  })
  const { data: lastFreeRaw } = useReadContract({
    address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI,
    functionName: "nftLastFreeMint",
    args: [nftContractForMint, nftTokenId],
    chainId: APP_CHAIN.id,
    query: { enabled: canNFTMint },
  })
  const nowTs = Math.floor(Date.now() / 1000)
  const discountSecsLeft = Math.max(0, Number(lastDiscountRaw ?? 0n) + 86400 - nowTs)
  const freeSecsLeft     = Math.max(0, Number(lastFreeRaw ?? 0n) + 30 * 86400 - nowTs)
  const discountOnCooldown = canNFTMint && discountSecsLeft > 0
  const freeOnCooldown     = canNFTMint && freeSecsLeft > 0

  // Reset selected token ID when the NFT contract changes
  useEffect(() => {
    setNftSelectedTokenId("")
    setNftTokenIdInput("")
  }, [nftContractForMint])

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
      setPaymentMethod("standard")
      setInputMode("url")
      setTextContent("")
      setTextLinkError(false)
      setNftSelectedContract("")
      setNftTokenIdInput("")
      setNftSelectedTokenId("")
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
    if (url.includes("youtube.com/shorts/")) return "youtubeshorts"
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
      case "youtubeshorts":
        return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/.test(url)
      case "youtube":
        const patterns = [
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(youtu\.be\/)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
          /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setTextContent(val)
    setTextLinkError(URL_LINK_PATTERN.test(val))
  }

  // Pre-fetch thumbnail and metadata
  const fetchContentMetadata = async (contentType: ContentType, contentUrl: string) => {
    console.log("🖼️ Pre-fetching thumbnail and metadata for:", contentType, contentUrl)

    try {
      // Check if operation was aborted
      if (abortControllerRef.current?.signal.aborted) return null

      switch (contentType) {
        case "youtube":
      case "youtubeshorts": {
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
      youtubeshorts: "/placeholder.svg?height=320&width=180&text=YouTube+Shorts",
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
    // ── Text mode path ──────────────────────────────────────────────────────────
    if (inputMode === "text") {
      const trimmed = textContent.trim().replace(/["\\]/g, "")
      if (!trimmed) {
        toast({ title: "Empty Text", description: "Please write something before submitting.", variant: "destructive" })
        return
      }
      if (!session?.user?.id) {
        toast({ title: "Authentication Required", description: "You must be signed in to submit content.", variant: "warning" })
        return
      }
      if (isProcessingRef.current || isSubmitting || isProcessing) return

      isProcessingRef.current = true
      setIsSubmitting(true)
      try {
        setSubmissionStep("processing_payment")
        const slotData = {
          contentUrl: trimmed,
          contentType: "text",
          aspectRatio: "16:9" as const,
          title: trimmed.slice(0, 50),
          authorName: "",
          imageUrl: "",
        }
        const mintResult = await (
          paymentMethod === "nft-discount" ? mintSlotWithNFTDiscount(slotData, nftContractForMint, nftTokenId) :
          paymentMethod === "nft-free"     ? mintSlotFreeWithNFT(slotData, nftContractForMint, nftTokenId) :
          paymentMethod === "discount"     ? mintSlotWithDiscount(slotData) :
          paymentMethod === "free"         ? mintSlotWithTokens(slotData) :
                                             mintSlot(slotData)
        )
        if (!mintResult.success) {
          if (mintResult.error === "Payment was cancelled") {
            toast({ title: "Payment Cancelled", description: "Content submission was cancelled.", variant: "destructive" })
            return
          }
          throw new Error(mintResult.error || "Mint failed")
        }
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("contentSubmitted"))
        if (!abortControllerRef.current?.signal.aborted) {
          onOpenChange(false)
          toast({ title: "Content Submitted!", description: "Your text has been scheduled and will appear shortly.", variant: "success", duration: 5000 })
          confetti({ particleCount: 150, spread: 90, origin: { y: 0.5, x: 0.5 }, angle: 90, startVelocity: 45 })
        }
      } catch (error) {
        if (error instanceof Error && (error.name === "AbortError" || abortControllerRef.current?.signal.aborted)) return
        toast({ title: "Submission Failed", description: error instanceof Error ? error.message : "Failed to submit content. Please try again.", variant: "destructive" })
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsSubmitting(false)
          setSubmissionStep("idle")
          isProcessingRef.current = false
        }
      }
      return
    }

    // ── URL mode path ───────────────────────────────────────────────────────────
    const urlToSubmit = resolvedContentUrl || contentUrl
    if (!contentType || !urlToSubmit || !isValidUrl) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid URL before submitting.",
        variant: "warning",
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
          case "youtubeshorts":
            return "9:16"
          case "youtube":
            return isYouTubeShort(urlToSubmit) ? "9:16" : "16:9"
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

      // Step 2: Mint slot on-chain via selected payment path
      console.log("💳 Minting slot on-chain via:", paymentMethod)
      setSubmissionStep("processing_payment")
      // Strip " and \ — contract rejects them to prevent JSON injection in tokenURI
      const sanitize = (s: string) => s.replace(/["\\]/g, "")
      const slotData = {
        contentUrl: urlToSubmit,
        contentType: contentType,
        aspectRatio: getAspectRatio(),
        title: sanitize(metadata?.title || ""),
        authorName: sanitize(metadata?.authorName || ""),
        imageUrl: metadata?.thumbnailUrl || "/placeholder.svg?height=180&width=320&text=Content",
      }
      const mintResult = await (
        paymentMethod === "nft-discount" ? mintSlotWithNFTDiscount(slotData, nftContractForMint, nftTokenId) :
        paymentMethod === "nft-free"     ? mintSlotFreeWithNFT(slotData, nftContractForMint, nftTokenId) :
        paymentMethod === "discount"     ? mintSlotWithDiscount(slotData) :
        paymentMethod === "free"         ? mintSlotWithTokens(slotData) :
                                           mintSlot(slotData)
      )

      if (abortControllerRef.current?.signal.aborted) return

      if (!mintResult.success) {
        if (mintResult.error === "Payment was cancelled") {
          toast({ title: "Payment Cancelled", description: "Content submission was cancelled.", variant: "destructive" })
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
          variant: "success",
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
      case "youtubeshorts":
        return (
          <div className="pointer-events-none">
            <YouTubeShortsIcon />
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
      case "youtubeshorts":
        return "https://youtube.com/shorts/VIDEO_ID"
      case "youtube":
        return "https://youtube.com/watch?v=ID, youtu.be/ID, /live/ID, etc."
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
      contentType === "youtubeshorts" ||
      (contentType === "tiktok" && detectedTikTokAspectRatio === "9:16")
    if (isPortrait) {
      const width = 200 * (9 / 16)
      return { maxHeight: "200px", height: "200px", width: `${width}px`, margin: "0 auto" }
    }
    return { height: "200px", width: "100%" }
  }

  const getButtonText = () => {
    if (!session?.user?.id) return "Connect Wallet to Submit"

    if (isSubmitting || isProcessing) {
      switch (submissionStep) {
        case "processing_payment": return "Processing Payment..."
        case "submitting": return "Submitting..."
        default: return "Processing..."
      }
    }

    if (isQueueFull) {
      return nextOpenTime
        ? `Queue Full — opens in ${formatTimeUntil(nextOpenTime)}`
        : "Queue Full — Check Back Later"
    }

    if (paymentMethod === "discount") return `Pay ${discountedPriceDisplay} USDC + Burn ${discountBurnDisplay} $BOOZ`
    if (paymentMethod === "free") return `Burn ${freeSlotCostDisplay} $BOOZ to Submit`
    if (paymentMethod === "nft-discount") return `Pay ${(Number(slotPrice) / 2 / 1_000_000).toFixed(2)} USDC (NFT 50% off)`
    if (paymentMethod === "nft-free") return "Free (NFT Pass)"
    return `Pay ${slotPriceDisplay} USDC to Submit`
  }

  const isTextValid = inputMode === "text"
    ? textContent.trim().length > 0 && textContent.trim().length <= 200 && !textLinkError
    : false
  const contentReady = inputMode === "url" ? isValidUrl : isTextValid
  const canSubmit = contentReady && (!isNFTPath || canNFTMint)

  // Check if any operation is in progress
  const isAnyOperationInProgress = isSubmitting || isProcessing || isProcessingRef.current

  return (
    <>
    {/* Transaction lock overlay — blocks UI during 2-step approve+mint flow */}
    {isProcessing && (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl px-8 py-7 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4">
          <Loader2 className="animate-spin text-indigo-600" size={28} />
          <p className="text-sm font-semibold text-gray-900 text-center">Processing payment…</p>
          {paymentMethod !== "free" && (
            <div className="w-full flex flex-col gap-2">
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: paymentStep === 1 ? "50%" : "100%" }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span className={paymentStep >= 1 ? "text-indigo-600 font-medium" : ""}>
                  {paymentStep > 1 ? "✓ " : "⏳ "}Approving USDC
                </span>
                <span className={paymentStep >= 2 ? "text-indigo-600 font-medium" : ""}>
                  {paymentStep === 2 ? "⏳ " : ""}Minting slot
                </span>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Please keep this page open{paymentMethod !== "free" ? " and confirm both transactions" : ""} in your wallet.
          </p>
        </div>
      </div>
    )}
    {isMobile ? (
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
            Pay {slotPriceDisplay} USDC to feature your content for {slotDurationDisplay}
          </SheetDescription>
        </SheetHeader>

        {/* Content area */}
        <div className="px-4 space-y-4 overflow-y-auto flex-1 min-h-0">

          {inputMode === "text" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs font-medium bg-gray-100 rounded-md p-0.5">
                  <button type="button" onClick={() => setInputMode("url")} disabled={isAnyOperationInProgress} className="px-2.5 py-1 rounded-[5px] text-gray-400 hover:text-gray-600 transition-colors">Content URL</button>
                  <span className="px-2.5 py-1 rounded-[5px] bg-white text-gray-900 shadow-sm">Text</span>
                </div>
                <span className={cn("text-xs", textContent.length > 200 ? "text-red-500" : "text-gray-400")}>
                  {textContent.length}/200
                </span>
              </div>
              <textarea
                rows={4}
                placeholder={"Write up to 200 characters...\n\nTip: *italic*  **bold**"}
                value={textContent}
                onChange={handleTextChange}
                disabled={isAnyOperationInProgress}
                className={cn(
                  "w-full rounded-[5px] border px-3 py-2 text-sm text-gray-900 outline-none transition-colors duration-200 resize-none disabled:cursor-not-allowed disabled:opacity-50",
                  textLinkError
                    ? "bg-red-50 border-red-300 focus:border-red-400"
                    : textContent.length > 200
                      ? "bg-red-50 border-red-300 focus:border-red-400"
                      : textContent.length > 0
                        ? "bg-green-50 border-green-200 focus:border-green-400"
                        : "bg-blue-50 border-blue-200 focus:border-blue-400 placeholder:text-blue-300"
                )}
              />
              {textLinkError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <HiExclamationTriangle className="h-3.5 w-3.5" />
                  Links are not allowed in text posts
                </p>
              )}
              {/* Live text preview */}
              {textContent.trim().length > 0 && !textLinkError && textContent.length <= 200 && (
                <div className="border rounded-[5px] p-3 bg-gray-50 border-gray-200">
                  <div className="text-xs font-medium mb-2 text-gray-900">Preview</div>
                  <p
                    className="text-sm text-gray-900 leading-relaxed break-words whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: textContent
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.+?)\*/g, "<em>$1</em>"),
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
          <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-xs font-medium bg-gray-100 rounded-md p-0.5">
                <span className="px-2.5 py-1 rounded-[5px] bg-white text-gray-900 shadow-sm">Content URL</span>
                <button type="button" onClick={() => setInputMode("text")} disabled={isAnyOperationInProgress} className="px-2.5 py-1 rounded-[5px] text-gray-400 hover:text-gray-600 transition-colors">Text</button>
              </div>
              {contentType ? (
                <div className="flex-shrink-0">{renderPlatformIcon()}</div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/youtube.svg" alt="YouTube" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/youtubeshorts.svg" alt="YouTube Shorts" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/tiktok.svg" alt="TikTok" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/x.svg" alt="X" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/spotify.svg" alt="Spotify" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/vimeo.svg" alt="Vimeo" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/twitch.svg" alt="Twitch" width={14} height={14} />
                </div>
              )}
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
                      contentType === "youtubeshorts"
                        ? "9:16"
                        : contentType === "tiktok"
                          ? detectedTikTokAspectRatio
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
          </>
          )}
        </div>

        {/* Payment method selector — pinned above button, only when authenticated + token enabled */}
        {session?.user?.id && tokenEnabled && (
          <div className="flex-shrink-0 px-4 pt-3 pb-0 bg-white space-y-2">
            {/* Label row */}
            <div className="flex items-center justify-between">
              {hasNFT ? (
                <div className="bg-gray-100 rounded-md p-0.5 flex">
                  <button
                    type="button"
                    disabled={isAnyOperationInProgress}
                    onClick={() => setPaymentMethod("standard")}
                    className={cn(
                      "px-2.5 py-0.5 rounded text-[11px] font-medium transition-all",
                      !isNFTPath ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    Payment
                  </button>
                  <button
                    type="button"
                    disabled={isAnyOperationInProgress}
                    onClick={() => setPaymentMethod("nft-discount")}
                    className={cn(
                      "px-2.5 py-0.5 rounded text-[11px] font-medium transition-all",
                      isNFTPath ? "bg-white shadow-sm text-amber-700" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    NFT Pass
                  </button>
                </div>
              ) : (
                <label className="text-gray-900 font-medium text-xs">Payment Method</label>
              )}
              {(paymentMethod === "discount" || paymentMethod === "free") && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  Balance: <span className="font-semibold text-gray-800">{boozFormatted}</span>
                  <HiBolt className="text-yellow-500" size={11} />
                  <span>$BOOZ</span>
                </span>
              )}
            </div>

            {/* Standard payment buttons — hidden when NFT Pass is active */}
            {!isNFTPath && (
              <div className="grid grid-cols-3 gap-2">
                {/* Standard */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("standard")}
                  disabled={isAnyOperationInProgress}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                    paymentMethod === "standard"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <span className="text-xs font-bold text-gray-900">{slotPriceDisplay} USDC</span>
                  <span className="text-[10px] text-gray-500">Standard</span>
                </button>

                {/* Discount */}
                <button
                  type="button"
                  onClick={() => canDiscount && setPaymentMethod("discount")}
                  disabled={isAnyOperationInProgress || !canDiscount}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                    paymentMethod === "discount"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white",
                    !canDiscount && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="text-xs font-bold text-gray-900">{discountedPriceDisplay} USDC</span>
                  <div className="flex items-center gap-0.5">
                    <HiBolt className="text-yellow-500" size={10} />
                    <span className="text-[10px] text-gray-500">-{discountBurnDisplay}</span>
                  </div>
                </button>

                {/* Free */}
                <button
                  type="button"
                  onClick={() => canFree && setPaymentMethod("free")}
                  disabled={isAnyOperationInProgress || !canFree}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                    paymentMethod === "free"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white",
                    !canFree && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="text-xs font-bold text-gray-900">Free</span>
                  <div className="flex items-center gap-0.5">
                    <HiBolt className="text-yellow-500" size={10} />
                    <span className="text-[10px] text-gray-500">{freeSlotCostDisplay}</span>
                  </div>
                </button>
              </div>
            )}

            {/* NFT Pass options — shown when NFT Pass tab is active */}
            {isNFTPath && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2 items-stretch">
                  <button
                    type="button"
                    onClick={() => !discountOnCooldown && setPaymentMethod("nft-discount")}
                    disabled={isAnyOperationInProgress || discountOnCooldown}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                      discountOnCooldown
                        ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                        : paymentMethod === "nft-discount"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                    )}
                  >
                    {discountOnCooldown ? (
                      <>
                        <span className="text-xs font-bold text-gray-400">in {formatCooldown(discountSecsLeft)}</span>
                        <span className="text-[10px] text-gray-400">-50% on cooldown</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-gray-900">{(Number(slotPrice) / 2 / 1_000_000).toFixed(2)} USDC</span>
                        <span className="text-[10px] text-gray-500">-50% Discount</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => !freeOnCooldown && setPaymentMethod("nft-free")}
                    disabled={isAnyOperationInProgress || freeOnCooldown}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                      freeOnCooldown
                        ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                        : paymentMethod === "nft-free"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                    )}
                  >
                    {freeOnCooldown ? (
                      <>
                        <span className="text-xs font-bold text-gray-400">in {formatCooldown(freeSecsLeft)}</span>
                        <span className="text-[10px] text-gray-400">Free on cooldown</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-gray-900">Free</span>
                        <span className="text-[10px] text-gray-500">30d cooldown</span>
                      </>
                    )}
                  </button>
                  {isEnumerating ? (
                    <div className="flex flex-col items-center justify-center gap-0.5 border border-gray-200 rounded-lg px-2.5 text-xs text-gray-400 bg-white">
                      <Loader2 size={11} className="animate-spin" />
                      <span>Loading…</span>
                    </div>
                  ) : canEnumerate ? (
                    <Select
                      value={nftSelectedTokenId}
                      onValueChange={setNftSelectedTokenId}
                      disabled={isAnyOperationInProgress}
                    >
                      <SelectTrigger className="h-full text-xs font-bold bg-white border-gray-200 text-gray-900 rounded-lg px-2.5 focus:ring-0 focus:ring-offset-0 [&>svg]:text-gray-400 hover:border-gray-300">
                        <SelectValue placeholder="Select NFT" />
                      </SelectTrigger>
                      <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                        <SelectGroup>
                          {ownedTokenIds.map(id => (
                            <SelectItem key={id} value={id} className="text-xs font-medium">
                              {nftCollectionName ? `${nftCollectionName} #${id}` : `#${id}`}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      placeholder="Token ID"
                      value={nftTokenIdInput}
                      onChange={e => setNftTokenIdInput(e.target.value)}
                      disabled={isAnyOperationInProgress}
                      className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 w-full"
                    />
                  )}
                </div>
                {heldNFTs.length > 1 && (
                  <select
                    value={nftSelectedContract}
                    onChange={e => setNftSelectedContract(e.target.value)}
                    disabled={isAnyOperationInProgress}
                    className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    {heldNFTs.map(addr => (
                      <option key={addr} value={addr}>{addr.slice(0, 10)}…{addr.slice(-6)}</option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-muted-foreground">No BOOZ earned · 1 raffle ticket · 24h cooldown (discount) / 30d cooldown (free)</p>
              </div>
            )}

          </div>
        )}

        {/* Button — always pinned at bottom */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 mt-0.5 border-t border-gray-100 bg-white">
          <button
            className="w-full elegance-button h-10 !shadow-custom-sm hover:!shadow-custom-sm transition-all duration-200 inline-flex items-center justify-center text-sm font-medium disabled:pointer-events-none disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!canSubmit || isAnyOperationInProgress || !session?.user?.id || isQueueFull}
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
    ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white text-gray-900 flex flex-col overflow-hidden max-h-[90vh] p-0 gap-0 rounded-xl">
        <DialogHeader className="px-4 pt-5 pb-3 flex-shrink-0 text-left">
          <DialogTitle className="text-lg text-gray-900 font-medium">Submit Content</DialogTitle>
          <DialogDescription className="text-xs text-gray-500 mt-1">
            Pay {slotPriceDisplay} USDC to feature your content for {slotDurationDisplay}
          </DialogDescription>
        </DialogHeader>

        {/* Content area */}
        <div className="px-4 space-y-4 overflow-y-auto flex-1 min-h-0">

          {inputMode === "text" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs font-medium bg-gray-100 rounded-md p-0.5">
                  <button type="button" onClick={() => setInputMode("url")} disabled={isAnyOperationInProgress} className="px-2.5 py-1 rounded-[5px] text-gray-400 hover:text-gray-600 transition-colors">Content URL</button>
                  <span className="px-2.5 py-1 rounded-[5px] bg-white text-gray-900 shadow-sm">Text</span>
                </div>
                <span className={cn("text-xs", textContent.length > 200 ? "text-red-500" : "text-gray-400")}>
                  {textContent.length}/200
                </span>
              </div>
              <textarea
                rows={4}
                placeholder={"Write up to 200 characters...\n\nTip: *italic*  **bold**"}
                value={textContent}
                onChange={handleTextChange}
                disabled={isAnyOperationInProgress}
                className={cn(
                  "w-full rounded-[5px] border px-3 py-2 text-sm text-gray-900 outline-none transition-colors duration-200 resize-none disabled:cursor-not-allowed disabled:opacity-50",
                  textLinkError
                    ? "bg-red-50 border-red-300 focus:border-red-400"
                    : textContent.length > 200
                      ? "bg-red-50 border-red-300 focus:border-red-400"
                      : textContent.length > 0
                        ? "bg-green-50 border-green-200 focus:border-green-400"
                        : "bg-blue-50 border-blue-200 focus:border-blue-400 placeholder:text-blue-300"
                )}
              />
              {textLinkError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <HiExclamationTriangle className="h-3.5 w-3.5" />
                  Links are not allowed in text posts
                </p>
              )}
              {textContent.trim().length > 0 && !textLinkError && textContent.length <= 200 && (
                <div className="border rounded-[5px] p-3 bg-gray-50 border-gray-200">
                  <div className="text-xs font-medium mb-2 text-gray-900">Preview</div>
                  <p
                    className="text-sm text-gray-900 leading-relaxed break-words whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: textContent
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.+?)\*/g, "<em>$1</em>"),
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
          <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-xs font-medium bg-gray-100 rounded-md p-0.5">
                <span className="px-2.5 py-1 rounded-[5px] bg-white text-gray-900 shadow-sm">Content URL</span>
                <button type="button" onClick={() => setInputMode("text")} disabled={isAnyOperationInProgress} className="px-2.5 py-1 rounded-[5px] text-gray-400 hover:text-gray-600 transition-colors">Text</button>
              </div>
              {contentType ? (
                <div className="flex-shrink-0">{renderPlatformIcon()}</div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/youtube.svg" alt="YouTube" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/youtubeshorts.svg" alt="YouTube Shorts" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/tiktok.svg" alt="TikTok" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/x.svg" alt="X" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/spotify.svg" alt="Spotify" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/vimeo.svg" alt="Vimeo" width={14} height={14} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/social/twitch.svg" alt="Twitch" width={14} height={14} />
                </div>
              )}
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
                      contentType === "youtubeshorts"
                        ? "9:16"
                        : contentType === "tiktok"
                          ? detectedTikTokAspectRatio
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
          </>
          )}
        </div>

        {/* Payment method selector */}
        {session?.user?.id && tokenEnabled && (
          <div className="flex-shrink-0 px-4 pt-3 pb-0 bg-white space-y-2">
            <div className="flex items-center justify-between">
              {hasNFT ? (
                <div className="bg-gray-100 rounded-md p-0.5 flex">
                  <button
                    type="button"
                    disabled={isAnyOperationInProgress}
                    onClick={() => setPaymentMethod("standard")}
                    className={cn(
                      "px-2.5 py-0.5 rounded text-[11px] font-medium transition-all",
                      !isNFTPath ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    Payment
                  </button>
                  <button
                    type="button"
                    disabled={isAnyOperationInProgress}
                    onClick={() => setPaymentMethod("nft-discount")}
                    className={cn(
                      "px-2.5 py-0.5 rounded text-[11px] font-medium transition-all",
                      isNFTPath ? "bg-white shadow-sm text-amber-700" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    NFT Pass
                  </button>
                </div>
              ) : (
                <label className="text-gray-900 font-medium text-xs">Payment Method</label>
              )}
              {(paymentMethod === "discount" || paymentMethod === "free") && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  Balance: <span className="font-semibold text-gray-800">{boozFormatted}</span>
                  <HiBolt className="text-yellow-500" size={11} />
                  <span>$BOOZ</span>
                </span>
              )}
            </div>

            {!isNFTPath && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("standard")}
                  disabled={isAnyOperationInProgress}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                    paymentMethod === "standard"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <span className="text-xs font-bold text-gray-900">{slotPriceDisplay} USDC</span>
                  <span className="text-[10px] text-gray-500">Standard</span>
                </button>

                <button
                  type="button"
                  onClick={() => canDiscount && setPaymentMethod("discount")}
                  disabled={isAnyOperationInProgress || !canDiscount}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                    paymentMethod === "discount"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white",
                    !canDiscount && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="text-xs font-bold text-gray-900">{discountedPriceDisplay} USDC</span>
                  <div className="flex items-center gap-0.5">
                    <HiBolt className="text-yellow-500" size={10} />
                    <span className="text-[10px] text-gray-500">-{discountBurnDisplay}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => canFree && setPaymentMethod("free")}
                  disabled={isAnyOperationInProgress || !canFree}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                    paymentMethod === "free"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white",
                    !canFree && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="text-xs font-bold text-gray-900">Free</span>
                  <div className="flex items-center gap-0.5">
                    <HiBolt className="text-yellow-500" size={10} />
                    <span className="text-[10px] text-gray-500">{freeSlotCostDisplay}</span>
                  </div>
                </button>
              </div>
            )}

            {isNFTPath && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2 items-stretch">
                  <button
                    type="button"
                    onClick={() => !discountOnCooldown && setPaymentMethod("nft-discount")}
                    disabled={isAnyOperationInProgress || discountOnCooldown}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                      discountOnCooldown
                        ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                        : paymentMethod === "nft-discount"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                    )}
                  >
                    {discountOnCooldown ? (
                      <>
                        <span className="text-xs font-bold text-gray-400">in {formatCooldown(discountSecsLeft)}</span>
                        <span className="text-[10px] text-gray-400">-50% on cooldown</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-gray-900">{(Number(slotPrice) / 2 / 1_000_000).toFixed(2)} USDC</span>
                        <span className="text-[10px] text-gray-500">-50% Discount</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => !freeOnCooldown && setPaymentMethod("nft-free")}
                    disabled={isAnyOperationInProgress || freeOnCooldown}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all",
                      freeOnCooldown
                        ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                        : paymentMethod === "nft-free"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                    )}
                  >
                    {freeOnCooldown ? (
                      <>
                        <span className="text-xs font-bold text-gray-400">in {formatCooldown(freeSecsLeft)}</span>
                        <span className="text-[10px] text-gray-400">Free on cooldown</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-gray-900">Free</span>
                        <span className="text-[10px] text-gray-500">30d cooldown</span>
                      </>
                    )}
                  </button>
                  {isEnumerating ? (
                    <div className="flex flex-col items-center justify-center gap-0.5 border border-gray-200 rounded-lg px-2.5 text-xs text-gray-400 bg-white">
                      <Loader2 size={11} className="animate-spin" />
                      <span>Loading…</span>
                    </div>
                  ) : canEnumerate ? (
                    <Select
                      value={nftSelectedTokenId}
                      onValueChange={setNftSelectedTokenId}
                      disabled={isAnyOperationInProgress}
                    >
                      <SelectTrigger className="h-full text-xs font-bold bg-white border-gray-200 text-gray-900 rounded-lg px-2.5 focus:ring-0 focus:ring-offset-0 [&>svg]:text-gray-400 hover:border-gray-300">
                        <SelectValue placeholder="Select NFT" />
                      </SelectTrigger>
                      <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                        <SelectGroup>
                          {ownedTokenIds.map(id => (
                            <SelectItem key={id} value={id} className="text-xs font-medium">
                              {nftCollectionName ? `${nftCollectionName} #${id}` : `#${id}`}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      placeholder="Token ID"
                      value={nftTokenIdInput}
                      onChange={e => setNftTokenIdInput(e.target.value)}
                      disabled={isAnyOperationInProgress}
                      className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 w-full"
                    />
                  )}
                </div>
                {heldNFTs.length > 1 && (
                  <select
                    value={nftSelectedContract}
                    onChange={e => setNftSelectedContract(e.target.value)}
                    disabled={isAnyOperationInProgress}
                    className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    {heldNFTs.map(addr => (
                      <option key={addr} value={addr}>{addr.slice(0, 10)}…{addr.slice(-6)}</option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-muted-foreground">No BOOZ earned · 1 raffle ticket · 24h cooldown (discount) / 30d cooldown (free)</p>
              </div>
            )}

          </div>
        )}

        {/* Button */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 mt-0.5 border-t border-gray-100 bg-white">
          <button
            className="w-full elegance-button h-10 !shadow-custom-sm hover:!shadow-custom-sm transition-all duration-200 inline-flex items-center justify-center text-sm font-medium disabled:pointer-events-none disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!canSubmit || isAnyOperationInProgress || !session?.user?.id || isQueueFull}
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
      </DialogContent>
    </Dialog>
    )}
    </>
  )
}
