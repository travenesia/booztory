"use client"

import { useState, useEffect, useMemo } from "react"
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient, useChainId, useSwitchChain } from "wagmi"
import { useSession } from "next-auth/react"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig, DATA_SUFFIX_PARAM, sendBatchWithAttribution, APP_CHAIN as _APP_CHAIN, WORLD_CHAIN } from "@/lib/wagmi"
import { canUsePaymaster, waitForPaymasterCalls, isWorldApp } from "@/lib/miniapp-flag"
import { MiniKit } from "@worldcoin/minikit-js"
import { useVerifyHuman } from "@/hooks/useVerifyHuman"
import { WorldIDVerifyButton } from "@/components/world/WorldIDVerifyButton"
import { formatUnits, parseAbiItem, encodeFunctionData } from "viem"
import Link from "next/link"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { HiBolt, HiTrophy } from "react-icons/hi2"
import { FaCoins, FaRankingStar } from "react-icons/fa6"
import { Ticket, BadgeCheck, Flame } from "lucide-react"
import { APP_CHAIN, NFT_CHAIN_ID } from "@/lib/wagmi"
import { WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI, WORLD_RAFFLE_ADDRESS, WORLD_RAFFLE_ABI, WORLD_TOKEN_ADDRESS, WORLD_USDC_ADDRESS, WORLD_WLD_ADDRESS } from "@/lib/contractWorld"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import {
  BOOZTORY_ADDRESS, BOOZTORY_ABI,
  RAFFLE_ADDRESS, RAFFLE_ABI,
  TOKEN_ADDRESS, USDC_ADDRESS, ERC20_ABI,
} from "@/lib/contract"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { GMContent } from "@/components/modals/gmModal"
import { useIdentity } from "@/hooks/useIdentity"
import { WorldVerifiedBadge } from "@/components/world/WorldVerifiedBadge"
import { ScrollReveal } from "@/components/layout/scrollReveal"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"

const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL

// ── Constants ──────────────────────────────────────────────────────────────────
const MILESTONES = [
  { day: 7,  label: "Warrior", emoji: "⚔️",  bit: 0 },
  { day: 14, label: "Elite",   emoji: "🛡️",  bit: 1 },
  { day: 30, label: "Epic",    emoji: "👑",  bit: 2 },
  { day: 60, label: "Legend",  emoji: "🔥",  bit: 3 },
  { day: 90, label: "Mythic",  emoji: "🔱",  bit: 4 },
]
const GM_DAY_REWARDS = [5, 10, 15, 20, 25, 30, 35]
const GM_FLAT_REWARD = 50

function getUtcDay() {
  return Math.floor(Date.now() / 1000 / 86400)
}

// ── Sponsor helpers ─────────────────────────────────────────────────────────────
interface AcceptedSponsor {
  appId: number
  sponsorName: string
  duration: number    // seconds
  prizePaid: bigint   // USDC 6-decimal
  adLink: string      // raw JSON
  acceptedAt: number  // unix seconds
}

function parseAdLink(raw: string): { website: string; x: string; discord: string; telegram: string } {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null) {
      return {
        website:  parsed.website  ?? "",
        x:        parsed.x        ?? "",
        discord:  parsed.discord  ?? "",
        telegram: parsed.telegram ?? "",
      }
    }
  } catch { /* fallback */ }
  return { website: raw, x: "", discord: "", telegram: "" }
}

const SPONSOR_LINK_ICONS = [
  { key: "website",  icon: "/social/web.svg",      alt: "Website"  },
  { key: "x",        icon: "/social/x.svg",        alt: "X"        },
  { key: "discord",  icon: "/social/discord.svg",  alt: "Discord"  },
  { key: "telegram", icon: "/social/telegram.svg", alt: "Telegram" },
] as const

function groupPrizes(prizeList: bigint[]): { start: number; end: number; amount: bigint }[] {
  if (prizeList.length === 0) return []
  const groups: { start: number; end: number; amount: bigint }[] = []
  let i = 0
  while (i < prizeList.length) {
    let j = i
    while (j < prizeList.length && prizeList[j] === prizeList[i]) j++
    groups.push({ start: i + 1, end: j, amount: prizeList[i] })
    i = j
  }
  return groups
}

const ERC721_NFT_ABI = [
  { name: "name",      type: "function", stateMutability: "view", inputs: [],                                    outputs: [{ type: "string"  }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const

// TODO: move to NEXT_PUBLIC_RAFFLE_DEPLOY_BLOCK env var once confirmed on mainnet
const RAFFLE_DEPLOY_BLOCK = 38_200_000n

// ── WinnerName ────────────────────────────────────────────────────────────────
// Wrapper so useIdentity can be called per winner without violating Rules of Hooks
function WinnerName({ address, isYou }: { address: string; isYou: boolean }) {
  const inWorldApp = isWorldApp()
  const identity = useIdentity(address as `0x${string}`)
  const isRawAddress = (s: string) => /^0x[0-9a-fA-F]{3,6}\.\.\./.test(s)
  const name = inWorldApp
    ? (identity.displayName && !isRawAddress(identity.displayName) ? identity.displayName : "World User")
    : (identity.walletName ?? `${address.slice(0, 6)}...${address.slice(-4)}`)
  return (
    <span className={cn(
      "font-mono text-xs truncate flex items-center gap-1",
      isYou ? "text-green-700 font-bold" : "text-gray-600"
    )}>
      {inWorldApp && <WorldVerifiedBadge verified={identity.isWorldVerified} />}
      {name}{isYou ? " (you)" : ""}
    </span>
  )
}

// ── Chain-aware contract selectors (evaluated per render — "use client" is safe) ──
function worldOr<T>(worldVal: T, baseVal: T): T {
  return isWorldApp() ? worldVal : baseVal
}
const W_RAFFLE  = () => worldOr(WORLD_RAFFLE_ADDRESS,  RAFFLE_ADDRESS)
const W_RABI    = () => worldOr(WORLD_RAFFLE_ABI,      RAFFLE_ABI)
const W_BOOZT   = () => worldOr(WORLD_BOOZTORY_ADDRESS, BOOZTORY_ADDRESS)
const W_BABI    = () => worldOr(WORLD_BOOZTORY_ABI,    BOOZTORY_ABI)
const W_TOKEN   = () => worldOr(WORLD_TOKEN_ADDRESS,   TOKEN_ADDRESS)
const W_USDC    = () => worldOr(WORLD_USDC_ADDRESS,    USDC_ADDRESS)
const W_CHAIN   = () => worldOr(WORLD_CHAIN.id,        APP_CHAIN.id)

// ── ActiveRaffleCard ───────────────────────────────────────────────────────────
function ActiveRaffleCard({
  raffleId: initialRaffleId,
  userAddress,
  isOwner,
  totalRaffles,
  userTicketBalance,
  acceptedSponsorApps,
  boozTokenAddress,
}: {
  raffleId: bigint
  userAddress?: `0x${string}`
  isOwner: boolean
  totalRaffles: number
  userTicketBalance: number
  acceptedSponsorApps: AcceptedSponsor[]
  // FIX: passed from parent (RewardPage already reads boozToken) — avoids a duplicate
  // useReadContract that was previously run independently inside this component.
  boozTokenAddress?: string
}) {
  const [selectedId, setSelectedId] = useState<bigint>(initialRaffleId)
  const [ticketInput, setTicketInput] = useState("")
  // Sync to latest raffle whenever totalRaffles increases (e.g. after owner creates a new one)
  useEffect(() => { setSelectedId(initialRaffleId) }, [initialRaffleId])
  const [isEntering, setIsEntering] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [rtThreshold, setRtThreshold] = useState("")
  const [rtMinUnique, setRtMinUnique] = useState("")
  const [isSettingRt, setIsSettingRt] = useState(false)
  const [nftGatedMap, setNftGatedMap] = useState<Record<number, string>>({})
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const inWorldApp = isWorldApp()
  const rAddr = inWorldApp ? WORLD_RAFFLE_ADDRESS : RAFFLE_ADDRESS
  const rAbi  = inWorldApp ? WORLD_RAFFLE_ABI     : RAFFLE_ABI
  const aChain = inWorldApp ? WORLD_CHAIN.id       : APP_CHAIN.id
  const { handleIDKitSuccess: raffleVerifySuccess, canProceed: raffleCanProceed, isVerifying: raffleIsVerifying } = useVerifyHuman(userAddress)
  async function ensureChain() {
    if (chainId !== aChain) await switchChainAsync({ chainId: aChain })
  }

  const { data: raffleRaw, refetch: refetchRaffle } = useReadContract({
    address: rAddr,
    abi: rAbi,
    functionName: "getRaffle",
    args: [selectedId],
    chainId: aChain,
    query: { refetchInterval: 60_000 },
  })

  // Pre-fill threshold inputs when raffle data loads or selection changes
  useEffect(() => {
    if (!raffleRaw) return
    const r = raffleRaw as readonly [readonly string[], bigint, bigint, bigint, number, bigint, bigint, boolean, bigint, bigint]
    setRtThreshold(r[5].toString())
    setRtMinUnique(r[6].toString())
  }, [raffleRaw, selectedId])

  const { data: prizeAmountsRaw } = useReadContract({
    address: rAddr,
    abi: rAbi,
    functionName: "getRafflePrizeAmounts",
    args: [selectedId],
    chainId: aChain,
  })

  const { data: userRaffleTicketsRaw, refetch: refetchUserTickets } = useReadContract({
    address: rAddr,
    abi: rAbi,
    functionName: "raffleTickets",
    args: userAddress ? [selectedId, userAddress] : undefined,
    chainId: aChain,
    query: { enabled: !!userAddress, refetchInterval: 60_000 },
  })

  const { data: hasEnteredRaw, refetch: refetchHasEntered } = useReadContract({
    address: rAddr,
    abi: rAbi,
    functionName: "hasEntered",
    args: userAddress ? [selectedId, userAddress] : undefined,
    chainId: aChain,
    query: { enabled: !!userAddress, refetchInterval: 60_000 },
  })

  const { data: winnersRaw } = useReadContract({
    address: rAddr,
    abi: rAbi,
    functionName: "getRaffleWinners",
    args: [selectedId],
    chainId: aChain,
  })

  // Base getRaffle: (prizeTokens, winnerCount, startTime, endTime, status,
  //   drawThreshold, minUniqueEntrants, drawRequested, totalTickets, uniqueEntrants) — 10 fields
  // World getRaffle: (prizeTokens, winnerCount, startTime, endTime, status,
  //   drawThreshold, minUniqueEntrants, commitment, commitBlock, totalTickets, uniqueEntrants) — 11 fields
  const raffle = raffleRaw as readonly [
    readonly string[], bigint, bigint, bigint, number,
    bigint, bigint, boolean | `0x${string}`, bigint, bigint, bigint?,
  ] | undefined

  const prizeAmounts = prizeAmountsRaw as readonly (readonly bigint[])[] | undefined
  const winners = (winnersRaw as string[] | undefined) ?? []
  const userRaffleTickets = Number(userRaffleTicketsRaw ?? 0n)
  const hasEntered = hasEnteredRaw as boolean | undefined

  const { data: raffleDrawBlockRaw } = useReadContract({
    address: rAddr, abi: rAbi,
    functionName: "raffleDrawBlock",
    args: [selectedId],
    chainId: aChain,
    query: { enabled: winners.length > 0, refetchInterval: 60_000 },
  })

  const { data: winnerTicketsRaw } = useReadContracts({
    contracts: winners.map(addr => ({
      address: rAddr, abi: rAbi,
      functionName: "raffleTickets" as const,
      args: [selectedId, addr as `0x${string}`] as const,
      chainId: aChain,
    })),
    query: { enabled: winners.length > 0 },
  })

  // Draw tx hash — fetched via getLogs once drawBlock is known (must be before early return)
  const drawBlock = Number(raffleDrawBlockRaw ?? 0n)
  const basescanHost = inWorldApp ? "worldscan.org" : ((APP_CHAIN.id as number) === 8453 ? "basescan.org" : "sepolia.basescan.org")
  const publicClient = usePublicClient({ chainId: aChain })
  const [drawTxHash, setDrawTxHash] = useState<string | undefined>()
  useEffect(() => {
    setDrawTxHash(undefined)
    if (!drawBlock || !publicClient) return
    let cancelled = false
    // FIX (Issue 1): use drawBlock as both bounds (1-block window) with RAFFLE_DEPLOY_BLOCK as
    // a defensive floor so we never query before the contract existed.
    // FIX (Issue 2): raffleId is an indexed topic — viem's args filter ensures we only get
    // the DrawCompleted event for this specific raffle, not all historical draws.
    const safeFrom = BigInt(Math.max(drawBlock, Number(RAFFLE_DEPLOY_BLOCK)))
    publicClient.getLogs({
      address: rAddr as `0x${string}`,
      event: parseAbiItem("event DrawCompleted(uint256 indexed raffleId, address[] winners)"),
      args: { raffleId: selectedId },
      fromBlock: safeFrom,
      toBlock: BigInt(drawBlock),
    }).then(logs => {
      if (!cancelled && logs[0]?.transactionHash) setDrawTxHash(logs[0].transactionHash)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [drawBlock, publicClient, selectedId])


  // Live countdown — re-renders every second
  const [nowTs, setNowTs] = useState(Date.now() / 1000)
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now() / 1000), 1000)
    return () => clearInterval(t)
  }, [])

  // Refetch raffle data when user returns to this tab
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return
      refetchRaffle()
      refetchUserTickets()
      refetchHasEntered()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refetchRaffle, refetchUserTickets, refetchHasEntered])

  // Read NFT-gated raffle map from localStorage (written by admin raffle page)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("booztory_nft_gated_raffles")
      if (stored) setNftGatedMap(JSON.parse(stored))
    } catch {}
  }, [])
  const nftContract = nftGatedMap[Number(selectedId)] as string | undefined
  const nftAddr = (nftContract ?? "0x0000000000000000000000000000000000000000") as `0x${string}`
  const { data: nftCollectionNameRaw } = useReadContract({
    address: nftAddr, abi: ERC721_NFT_ABI, functionName: "name",
    chainId: NFT_CHAIN_ID, query: { enabled: !!nftContract },
  })
  const { data: nftBalanceRaw } = useReadContract({
    address: nftAddr, abi: ERC721_NFT_ABI, functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: NFT_CHAIN_ID, query: { enabled: !!nftContract && !!userAddress },
  })
  const nftCollectionName = nftCollectionNameRaw as string | undefined
  const holdsNft  = !nftContract || (nftBalanceRaw !== undefined && Number(nftBalanceRaw) > 0)
  const blockedByNft = !!nftContract && nftBalanceRaw !== undefined && !holdsNft

  if (!raffle) return null

  // FIX (Issue 3): Wait for boozToken read to resolve before computing prize decimals.
  // Without this guard, the initial render uses prizeDecimals=6 (USDC fallback) for BOOZ
  // prizes, causing raw 18-decimal amounts to display as astronomically large USDC values.
  if (boozTokenAddress === undefined) return null

  // status: 0 = Active, 1 = Drawn, 2 = Cancelled
  // World returns 11 fields (commitment + commitBlock before totalTickets/uniqueEntrants).
  // Base returns 10 fields (drawRequested bool instead).
  const [prizeTokens, winnerCount, startTime, endTime, raffleStatus, drawThreshold, minUniqueEntrants, _field7, _field8, _field9, _field10] = raffle
  const totalTickets    = inWorldApp ? (_field9  ?? 0n) : (_field8 ?? 0n)
  const uniqueEntrants  = inWorldApp ? (_field10 ?? 0n) : (_field9 ?? 0n)
  const worldCommitBlock = inWorldApp ? (_field8 ?? 0n) : 0n
  const drawRequested   = inWorldApp ? false : !!_field7

  const isCancelled = raffleStatus === 2

  // Determine prize token type — compare against contract's boozToken state (not env var)
  const boozTokenAddr = (boozTokenAddress as string | undefined) ?? TOKEN_ADDRESS
  const isBoozPrize = (prizeTokens as string[]).length > 0 &&
    (prizeTokens as string[])[0]?.toLowerCase() === boozTokenAddr.toLowerCase()
  const prizeDecimals = isBoozPrize ? 18 : 6



  // prizeAmounts is [tokenIndex][winnerIndex] — take token 0's per-winner amounts
  const prizeList = Array.from(
    { length: Number(winnerCount) },
    (_, i) => prizeAmounts?.[0]?.[i] ?? 0n
  )
  const totalPrize = prizeList.reduce((a, b) => a + b, 0n)

  // Match raffle to a sponsor application — requires:
  //   1. startTime within acceptedAt → acceptedAt+duration window
  //   2. prize token is USDC (sponsors always pay in USDC, never BOOZ)
  //   3. total prize matches sponsor's prizePaid (within 1 USDC tolerance)
  const raffleSponsor = isBoozPrize ? undefined : acceptedSponsorApps.find(s => {
    if (Number(startTime) < s.acceptedAt || Number(startTime) >= s.acceptedAt + s.duration) return false
    const diff = totalPrize > s.prizePaid ? totalPrize - s.prizePaid : s.prizePaid - totalPrize
    return diff <= 1_000_000n // 1 USDC tolerance
  })
  const sponsorLinks = raffleSponsor ? parseAdLink(raffleSponsor.adLink) : null
  const totalPrizeFormatted = Number(formatUnits(totalPrize, prizeDecimals)).toLocaleString(undefined,
    prizeDecimals === 6
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }
  )

  const winnerTickets = (winnerTicketsRaw ?? []).map(r => Number(r.result ?? 0n))
  const drawTxUrl = drawTxHash ? `https://${basescanHost}/tx/${drawTxHash}` : undefined

  const ended = Number(endTime) <= nowTs
  const isDrawn = winners.length > 0

  const secondsLeft = Math.max(0, Number(endTime) - nowTs)
  const d = Math.floor(secondsLeft / 86400)
  const h = Math.floor((secondsLeft % 86400) / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = Math.floor(secondsLeft % 60)
  const timeDisplay = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`

  const thresholdMet = Number(totalTickets) >= Number(drawThreshold)
  const uniqueMet = Number(uniqueEntrants) >= Number(minUniqueEntrants)
  const drawable = ended && thresholdMet && uniqueMet && !drawRequested && !isDrawn && !isCancelled && !inWorldApp
  const isStuckDraw = !inWorldApp && drawRequested && !isDrawn && !isCancelled
  const worldCommitted = inWorldApp && worldCommitBlock > 0n && !isDrawn && !isCancelled

  async function handleEnter() {
    const amount = parseInt(ticketInput)
    if (!amount || amount < 1 || !userAddress) return
    setIsEntering(true)
    try {
      if (inWorldApp) {
        const result = await MiniKit.sendTransaction({
          transactions: [{ to: rAddr, data: encodeFunctionData({ abi: rAbi, functionName: "enterRaffle", args: [selectedId, BigInt(amount)] }) }],
          chainId: aChain,
        })
        if (!result?.data?.userOpHash) throw new Error("No userOpHash")
      } else {
        await ensureChain()
        let ranPaymaster = false
        if (await canUsePaymaster(PAYMASTER_URL)) {
          try {
            const callsId = await sendBatchWithAttribution([
              { address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "enterRaffle", args: [selectedId, BigInt(amount)] },
            ], PAYMASTER_URL!)
            await waitForPaymasterCalls(callsId)
            ranPaymaster = true
          } catch { /* fall through */ }
        }
        if (!ranPaymaster) {
          const tx = await writeContractAsync({
            address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
            functionName: "enterRaffle", args: [selectedId, BigInt(amount)],
            chainId: APP_CHAIN.id, ...DATA_SUFFIX_PARAM,
          })
          await waitForTransactionReceipt(wagmiConfig, { hash: tx })
        }
      }
      setTicketInput("")
      refetchRaffle()
      refetchUserTickets()
      refetchHasEntered()
      toast({ title: "Entered Raffle!", description: `${amount} ticket${amount > 1 ? "s" : ""} used for Raffle #${Number(selectedId) + 1}.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({
        title: "Failed to Enter",
        description: msg.includes("InsufficientTickets") ? "You don't have enough tickets." : "Transaction failed.",
        variant: "destructive",
      })
    } finally {
      setIsEntering(false)
    }
  }

  async function handleDraw() {
    setIsDrawing(true)
    try {
      await ensureChain()
      const tx = await writeContractAsync({
        address: rAddr, abi: rAbi,
        functionName: "triggerDraw", args: [selectedId],
        chainId: aChain, ...DATA_SUFFIX_PARAM,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffle()
      toast({ title: "Draw Triggered!", description: `Draw requested for Raffle #${Number(selectedId) + 1}.`, variant: "success" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      const clean = msg.includes("BelowThreshold") ? "Not enough ticket entries."
        : msg.includes("NotEnoughUnique") ? "Not enough unique entrants."
        : msg.includes("InsufficientPrize") ? "Prize funds not yet deposited."
        : msg.includes("StillRunning") ? "Raffle hasn't ended yet."
        : msg.includes("AlreadyDrawRequested") ? "Draw already requested."
        : "Transaction failed."
      toast({ title: "Draw Failed", description: clean, variant: "destructive" })
    } finally { setIsDrawing(false) }
  }

  async function handleReset() {
    setIsResetting(true)
    try {
      await ensureChain()
      const tx = await writeContractAsync({
        address: rAddr, abi: rAbi,
        functionName: "resetDraw", args: [selectedId],
        chainId: aChain, ...DATA_SUFFIX_PARAM,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffle()
      toast({ title: "Draw Reset", description: `Raffle #${Number(selectedId) + 1} ready to re-trigger.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsResetting(false) }
  }

  async function handleCancel() {
    setIsCancelling(true)
    try {
      await ensureChain()
      const tx = await writeContractAsync({
        address: rAddr, abi: rAbi,
        functionName: "cancelRaffle", args: [selectedId],
        chainId: aChain, ...DATA_SUFFIX_PARAM,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffle()
      toast({ title: "Raffle Cancelled", description: `Raffle #${Number(selectedId) + 1} has been cancelled.`, variant: "destructive" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsCancelling(false) }
  }

  async function handleSetThresholds() {
    const t = parseInt(rtThreshold)
    const u = parseInt(rtMinUnique)
    if (!rtThreshold && !rtMinUnique) return
    if (rtThreshold && (isNaN(t) || t < 1)) return
    if (rtMinUnique && (isNaN(u) || u < 1)) return
    setIsSettingRt(true)
    try {
      await ensureChain()
      const tx = await writeContractAsync({
        address: rAddr, abi: rAbi,
        functionName: "setRaffleThresholds",
        args: [selectedId, rtThreshold ? BigInt(t) : drawThreshold, rtMinUnique ? BigInt(u) : minUniqueEntrants],
        chainId: aChain, ...DATA_SUFFIX_PARAM,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffle()
      toast({ title: "Thresholds Updated", description: `Raffle #${Number(selectedId) + 1}: ${rtThreshold || drawThreshold} tickets · ${rtMinUnique || minUniqueEntrants} wallets` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsSettingRt(false) }
  }

  return (<>
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Hero header */}
      <div
        className="p-5 text-white"
        style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HiTrophy className="text-yellow-300" size={16} />
            <span className="text-sm font-bold text-white/80">Prize Pool</span>
          </div>
          {totalRaffles > 1 ? (
            <Select
              value={selectedId.toString()}
              onValueChange={v => setSelectedId(BigInt(v))}
            >
              <SelectTrigger className="h-7 w-32 text-xs font-bold bg-white/15 border-white/20 text-white rounded-full px-2.5 focus:ring-0 focus:ring-offset-0 [&>svg]:text-white/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-blue-700 border-blue-500 [&_*]:text-white">
                <SelectGroup>
                  <SelectLabel className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">Raffles</SelectLabel>
                  {Array.from({ length: totalRaffles }, (_, i) => totalRaffles - 1 - i).map(i => (
                    <SelectItem key={i} value={i.toString()} className="text-sm font-medium focus:bg-blue-600 focus:text-white">
                      Raffle #{i + 1}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-bold text-white/80">Raffle #{Number(selectedId) + 1}</span>
          )}
        </div>
        <div className="text-4xl font-bold text-center my-6">
          {totalPrize > 0n
            ? (isBoozPrize ? totalPrizeFormatted : `$${totalPrizeFormatted}`)
            : "—"}
        </div>

        {/* Sponsor info */}
        {raffleSponsor && (
          <div className="flex flex-col items-center gap-2 mt-4 mb-4 border-t border-white/10">
            <span className="text-xs text-white/60 text-center mt-4">Sponsored by</span>
            <span className="text-sm font-semibold text-white text-center">{raffleSponsor.sponsorName}</span>
            {sponsorLinks && (() => {
              const links = SPONSOR_LINK_ICONS.filter(({ key }) => sponsorLinks[key])
              if (links.length === 0) return null
              return (
                <div className="flex items-center justify-center gap-3">
                  {links.map(({ key, icon, alt }) => (
                    <a key={key} href={sponsorLinks[key]} target="_blank" rel="noopener noreferrer"
                      className="opacity-60 hover:opacity-100 transition-opacity">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={icon} width={14} height={14} alt={alt} className="invert" />
                    </a>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* NFT-gated raffle info */}
        {!raffleSponsor && nftContract && (
          <div className="flex flex-col items-center gap-2 mt-4 mb-4 border-t border-white/10">
            <span className="text-xs text-white/60 text-center mt-4">Sponsored by</span>
            <span className="text-sm font-semibold text-white text-center">
              {nftCollectionName ?? `${nftContract.slice(0, 6)}…${nftContract.slice(-4)}`}
            </span>
            <div className="flex items-center justify-center gap-3">
              <a href={`https://opensea.io/assets/base/${nftContract}`} target="_blank" rel="noopener noreferrer"
                className="opacity-60 hover:opacity-100 transition-opacity">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/social/opensea.svg" width={14} height={14} alt="OpenSea" className="invert" />
              </a>
              <a href={`https://basescan.org/address/${nftContract}`} target="_blank" rel="noopener noreferrer"
                className="opacity-60 hover:opacity-100 transition-opacity">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/social/basescan.svg" width={14} height={14} alt="Basescan" className="invert" />
              </a>
            </div>
          </div>
        )}

        <div className="mt-4 text-center space-y-1.5">
          {(isDrawn || ended || isCancelled) && Number(startTime) > 0 && Number(endTime) > 0 && (() => {
            const fmt = (ts: bigint) => {
              const d = new Date(Number(ts) * 1000)
              const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
              const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
              return `${date} · ${time} UTC`
            }
            return (
              <p className="text-[10px] text-white mb-4">Ended: {fmt(endTime)}</p>
            )
          })()}
          <div className="text-xs">
            {isCancelled ? (
              <span className="bg-red-400/20 border border-red-300/30 rounded-full px-2.5 py-0.5 text-red-200">
                Cancelled
              </span>
            ) : isDrawn ? (
              <span className="bg-emerald-400/20 border border-emerald-300/30 rounded-full px-2.5 py-0.5 text-emerald-200">
                Drawn ✓
              </span>
            ) : worldCommitted ? (
              <span className="bg-blue-400/20 border border-blue-300/30 rounded-full px-2.5 py-0.5 text-blue-200 animate-pulse">
                Committed · Awaiting reveal
              </span>
            ) : isStuckDraw ? (
              <span className="bg-green-400/20 border border-green-300/30 rounded-full px-2.5 py-0.5 text-green-200 animate-pulse">
                VRF pending...
              </span>
            ) : ended ? (
              <span className="bg-yellow-400/20 border border-yellow-300/30 rounded-full px-2.5 py-0.5 text-yellow-200">
                Awaiting draw
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-2.5 py-0.5 text-white/80 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                Ends in {timeDisplay}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Body */}
      <div className="bg-white p-4 space-y-3">

        {/* Prize breakdown — always shows POSITION / PRIZE grouped */}
        {prizeList.length > 0 && (
          <div className="bg-gray-50 rounded-xl overflow-hidden text-sm">
            <div className="flex justify-between px-3 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide border-b border-gray-100">
              <span>Position</span><span>Prize</span>
            </div>
            {groupPrizes(prizeList).map(({ start, end, amount }) => {
              const amtFormatted = Number(formatUnits(amount, prizeDecimals)).toLocaleString(undefined,
                prizeDecimals === 6
                  ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  : { maximumFractionDigits: 0 }
              )
              const label = start === end ? `${start}` : `${start}–${end}`
              return (
                <div key={start} className="flex justify-between px-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-800">
                    {isBoozPrize ? `${amtFormatted} $BOOZ` : `$${amtFormatted} USDC`}
                  </span>
                </div>
              )
            })}
            <div className="flex justify-between px-3 py-2 text-xs text-gray-400 border-t border-gray-100 bg-gray-50/80">
              <span>{Number(winnerCount)} winner{Number(winnerCount) !== 1 ? "s" : ""}</span>
              <span className="font-semibold">
                Total {isBoozPrize ? `${totalPrizeFormatted} $BOOZ` : `$${totalPrizeFormatted} USDC`}
              </span>
            </div>
            {Number(startTime) > 0 && (
              <div className="px-3 py-1.5 text-[10px] text-gray-400 text-center border-t border-gray-100">
                {(() => {
                    const d = new Date(Number(startTime) * 1000)
                    const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
                    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
                    return `Started: ${date} · ${time} UTC`
                  })()}
              </div>
            )}
          </div>
        )}

        {/* Threshold progress (not yet drawn) */}
        {!isDrawn && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Tickets threshold</span>
              <span className={thresholdMet ? "text-green-600 font-semibold" : ""}>
                {Number(totalTickets).toLocaleString()} / {Number(drawThreshold).toLocaleString()}{thresholdMet ? " ✓" : ""}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={cn("h-3 rounded-full transition-all", thresholdMet && uniqueMet ? "bg-green-500" : "bg-blue-500")}
                style={{ width: `${Math.min((Number(totalTickets) / Math.max(Number(drawThreshold), 1)) * 50, 50) + Math.min((Number(uniqueEntrants) / Math.max(Number(minUniqueEntrants), 1)) * 50, 50)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Unique entrants</span>
              <span className={uniqueMet ? "text-green-600 font-semibold" : ""}>
                {Number(uniqueEntrants)} / {Number(minUniqueEntrants)}{uniqueMet ? " ✓" : ""}
              </span>
            </div>
          </div>
        )}

        {/* User entry status (active raffles only — drawn results shown in results section below) */}
        {userAddress && !isDrawn && hasEntered && (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <BadgeCheck size={14} /> You&apos;re entered
            </span>
            <span className="text-xs text-green-600">{userRaffleTickets} ticket{userRaffleTickets !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* NFT gate — shown only once balanceOf resolves to 0 */}
        {userAddress && !ended && !isDrawn && !isCancelled && blockedByNft && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
            <BadgeCheck size={14} className="shrink-0 text-amber-500" />
            <span>Hold a <strong>{nftCollectionName ?? "required NFT"}</strong> to enter this raffle.</span>
          </div>
        )}

        {/* Enter raffle input */}
        {userAddress && !ended && !isDrawn && !isCancelled && holdsNft && (
          <div className="flex gap-2">
            <div className="flex-1 flex border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <input
                type="number"
                min="1"
                value={ticketInput}
                onChange={e => setTicketInput(e.target.value)}
                placeholder="Tickets to use"
                className="flex-1 px-3 py-2 text-sm focus:outline-none min-w-0"
              />
              {userTicketBalance > 0 && (
                <button
                  onClick={() => setTicketInput(String(userTicketBalance))}
                  className="px-2.5 text-xs font-bold text-blue-600 hover:text-blue-800 border-l border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  Max
                </button>
              )}
            </div>
            {inWorldApp && !raffleCanProceed ? (
              <WorldIDVerifyButton
                onSuccess={raffleVerifySuccess}
                isVerifying={raffleIsVerifying}
                signal={userAddress}
                className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5"
              >
                Verify to Enter
              </WorldIDVerifyButton>
            ) : (
              <button
                onClick={handleEnter}
                disabled={isEntering || !ticketInput || parseInt(ticketInput) < 1 || parseInt(ticketInput) > userTicketBalance}
                className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {isEntering ? "Entering..." : hasEntered ? "Add More" : "Enter"}
              </button>
            )}
          </div>
        )}


        {/* Owner: trigger draw */}
        {isOwner && drawable && (
          <button
            onClick={handleDraw}
            disabled={isDrawing}
            className="w-full bg-amber-500 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {isDrawing ? "Triggering Draw..." : "Trigger Draw"}
          </button>
        )}

        {/* Owner: stuck VRF reset (Base only) */}
        {isOwner && isStuckDraw && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
              <span>⚠️</span>
              <span>VRF callback stuck. If 30+ min have passed, reset and re-trigger.</span>
            </div>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="w-full bg-yellow-50 border border-yellow-400 text-yellow-800 text-sm font-bold py-2 rounded-lg hover:bg-yellow-100 disabled:opacity-50 transition-colors"
            >
              {isResetting ? "Resetting..." : "Reset Stuck Draw"}
            </button>
          </div>
        )}

        {/* World: committed — inform user draw is pending reveal in admin */}
        {worldCommitted && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
            <span>🔐</span>
            <span>Draw committed. Waiting for owner to reveal in the admin panel.</span>
          </div>
        )}

        {/* Owner: cancel raffle */}
        {isOwner && !isDrawn && !ended && (
          <button
            onClick={handleCancel}
            disabled={isCancelling || isCancelled}
            className={cn(
              "w-full text-xs font-semibold py-2 rounded-lg transition-colors",
              isCancelled
                ? "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
            )}
          >
            {isCancelled ? "Raffle Cancelled" : isCancelling ? "Cancelling..." : "Cancel Raffle"}
          </button>
        )}

        {/* Owner: override thresholds for this raffle */}
        {isOwner && !isDrawn && !isCancelled && (
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500">Override Thresholds — Raffle #{Number(selectedId) + 1}</p>
            <div className="flex gap-2">
              <input
                type="number" min={1} value={rtThreshold} onChange={e => setRtThreshold(e.target.value)}
                placeholder="Tickets"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="number" min={1} value={rtMinUnique} onChange={e => setRtMinUnique(e.target.value)}
                placeholder="Wallets"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={handleSetThresholds}
                disabled={isSettingRt || (!rtThreshold && !rtMinUnique)}
                className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {isSettingRt ? "Saving..." : "Set"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Results section (shown separately when drawn) ─────────────────── */}
    {isDrawn && winners.length > 0 && (
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        {/* Results header */}
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiTrophy className="text-blue-500" size={16} />
              <span className="text-sm font-bold text-blue-900">Raffle #{Number(selectedId) + 1} Results</span>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
              Drawn ✓
            </span>
          </div>
        </div>

        {/* Requirements met row */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100 text-xs text-gray-500">
          <span>Requirements at draw time</span>
          <span className="text-green-600 font-semibold">
            {Number(totalTickets).toLocaleString()} entries · {Number(uniqueEntrants).toLocaleString()} wallets ✓
          </span>
        </div>

        {/* Winners table */}
        <div className="bg-white">
          <div className="grid grid-cols-[2rem_1fr_auto] gap-x-3 px-4 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide border-b border-gray-100">
            <span>#</span>
            <span>Winner</span>
            <span>Prize</span>
          </div>
          {winners.map((addr, i) => {
            const isYou = !!(userAddress && addr.toLowerCase() === userAddress.toLowerCase())
            const tickets = winnerTickets[i] ?? 0
            const amtFormatted = Number(formatUnits(prizeList[i] ?? 0n, prizeDecimals)).toLocaleString(undefined,
              prizeDecimals === 6
                ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                : { maximumFractionDigits: 0 }
            )
            return (
              <div key={addr + i} className={cn(
                "grid grid-cols-[2rem_1fr_auto] gap-x-3 px-4 py-2.5 border-b border-gray-50 last:border-0 items-center",
                isYou && "bg-green-50"
              )}>
                <span className="text-xs text-gray-400 font-mono">{i + 1}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  {tickets > 0 && (
                    <span className="text-xs text-gray-400 shrink-0">{tickets}×</span>
                  )}
                  <WinnerName address={addr} isYou={isYou} />
                </div>
                {/* FIX (Issue 4): prize button links to Basescan draw tx; VRF proof link added below */}
                <div className="flex flex-col items-end gap-1">
                  {drawTxUrl ? (
                    <a
                      href={drawTxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap",
                        isYou
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      )}
                    >
                      {isBoozPrize ? `${amtFormatted} $BOOZ` : `$${amtFormatted} USDC`}
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 2.5H9.5M9.5 2.5V9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  ) : (
                    <span className={cn(
                      "text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap",
                      isYou ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    )}>
                      {isBoozPrize ? `${amtFormatted} $BOOZ` : `$${amtFormatted} USDC`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}
  </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RewardPage() {
  const { address: wagmiAddress } = useAccount()
  const { data: session } = useSession()
  const inWorldApp = isWorldApp()
  const address = wagmiAddress ?? (inWorldApp ? (session?.user?.walletAddress as `0x${string}` | undefined) : undefined)
  const { handleIDKitSuccess: convertVerifySuccess, canProceed: convertCanProceed, isVerifying: convertIsVerifying } = useVerifyHuman(address)

  // Chain-aware contract references
  const pBoozt  = inWorldApp ? WORLD_BOOZTORY_ADDRESS : BOOZTORY_ADDRESS
  const pBabi   = inWorldApp ? WORLD_BOOZTORY_ABI     : BOOZTORY_ABI
  const pRaffle = inWorldApp ? WORLD_RAFFLE_ADDRESS   : RAFFLE_ADDRESS
  const pRabi   = inWorldApp ? WORLD_RAFFLE_ABI       : RAFFLE_ABI
  const pToken  = inWorldApp ? WORLD_TOKEN_ADDRESS    : TOKEN_ADDRESS
  const pUsdc   = inWorldApp ? WORLD_USDC_ADDRESS     : USDC_ADDRESS
  const pChain  = inWorldApp ? WORLD_CHAIN.id         : APP_CHAIN.id

  const isMobile = useIsMobile()
  const [tab, setTab] = useState<"raffle" | "streak">("raffle")
  const [gmOpen, setGmOpen] = useState(false)
  const [convertAmount, setConvertAmount] = useState("")
  const [isConverting, setIsConverting] = useState(false)
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const rewardChainId = useChainId()
  const { switchChainAsync: rewardSwitchChain } = useSwitchChain()
  async function ensureRewardChain() {
    if (rewardChainId !== pChain) await rewardSwitchChain({ chainId: pChain })
  }

  // ── User balances ──────────────────────────────────────────────────────────
  const { data: boozBalanceRaw } = useReadContract({
    address: pToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: pChain,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  const { data: usdcBalanceRaw } = useReadContract({
    address: pUsdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: pChain,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  const { data: wldBalanceRaw } = useReadContract({
    address: WORLD_WLD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: WORLD_CHAIN.id,
    query: { enabled: !!address && inWorldApp, refetchInterval: 60_000 },
  })

  const { data: pointsRaw, refetch: refetchPoints } = useReadContract({
    address: pBoozt,
    abi: pBabi,
    functionName: "points",
    args: address ? [address] : undefined,
    chainId: pChain,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  const { data: ticketBalanceRaw, refetch: refetchTickets } = useReadContract({
    address: pRaffle,
    abi: pRabi,
    functionName: "tickets",
    args: address ? [address] : undefined,
    chainId: pChain,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  const { data: pointsPerTicketRaw } = useReadContract({
    address: pBoozt,
    abi: pBabi,
    functionName: "pointsPerTicket",
    chainId: pChain,
  })

  // ── Raffle reads ────────────────────────────────────────────────────────────
  const { data: pageBoozToken } = useReadContract({
    address: pRaffle,
    abi: pRabi,
    functionName: "boozToken",
    chainId: pChain,
  })

  const { data: nextRaffleIdRaw, refetch: refetchNextRaffleId } = useReadContract({
    address: pRaffle,
    abi: pRabi,
    functionName: "nextRaffleId",
    chainId: pChain,
    query: { refetchInterval: 60_000, refetchOnWindowFocus: true },
  })

  const _raffleCount = Number(nextRaffleIdRaw ?? 0n)
  // FIX: was polling every 60s — tickets committed to past raffles are immutable so
  // periodic refetch was wasting N calls/min (one per raffle). Fetch once and cache.
  // Note: the active raffle's per-user ticket count is handled separately inside
  // ActiveRaffleCard (refetchUserTickets), so this display stat stays accurate enough.
  const { data: burnedTicketsRaw } = useReadContracts({
    contracts: Array.from({ length: _raffleCount }, (_, i) => ({
      address: pRaffle,
      abi: pRabi,
      functionName: "raffleTickets" as const,
      args: [BigInt(i), address!] as const,
      chainId: pChain,
    })),
    query: { enabled: !!address && _raffleCount > 0 },
  })

  const _recentCount = Math.min(_raffleCount, 5)
  const _recentOffset = _raffleCount - _recentCount

  const { data: allRafflesRaw } = useReadContracts({
    contracts: Array.from({ length: _recentCount }, (_, i) => ({
      address: pRaffle,
      abi: pRabi,
      functionName: "getRaffle" as const,
      args: [BigInt(_recentOffset + i)] as const,
      chainId: pChain,
    })),
    query: { enabled: _recentCount > 0, refetchInterval: 60_000 },
  })

  const { data: allRafflePrizesRaw } = useReadContracts({
    contracts: Array.from({ length: _recentCount }, (_, i) => ({
      address: pRaffle,
      abi: pRabi,
      functionName: "getRafflePrizeAmounts" as const,
      args: [BigInt(_recentOffset + i)] as const,
      chainId: pChain,
    })),
    query: { enabled: _recentCount > 0, refetchInterval: 60_000 },
  })

  const { data: activeRaffleIdsRaw, refetch: refetchActiveRaffles } = useReadContract({
    address: pRaffle,
    abi: pRabi,
    functionName: "getActiveRaffles",
    chainId: pChain,
    query: { refetchInterval: 30_000 },
  })

  // ── Owner reads ─────────────────────────────────────────────────────────────
  const { data: raffleOwnerRaw } = useReadContract({
    address: pRaffle,
    abi: pRabi,
    functionName: "owner",
    chainId: pChain,
  })

  // ── Streak reads ────────────────────────────────────────────────────────────
  const { data: streakRaw } = useReadContract({
    address: pBoozt,
    abi: pBabi,
    functionName: "gmStreaks",
    args: address ? [address] : undefined,
    chainId: pChain,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  // ── Computed ────────────────────────────────────────────────────────────────
  const boozNum = boozBalanceRaw ? Number(formatUnits(boozBalanceRaw as bigint, 18)) : 0
  const boozFormatted = boozNum.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const usdcNum = usdcBalanceRaw ? Number(usdcBalanceRaw as bigint) / 1_000_000 : 0
  const usdcFormatted = usdcNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const wldNum = wldBalanceRaw ? Number(formatUnits(wldBalanceRaw as bigint, 18)) : 0
  const wldFormatted = wldNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const pointsBalance = Number(pointsRaw ?? 0n)
  const ticketBalance = Number(ticketBalanceRaw ?? 0n)
  const burnedTickets = burnedTicketsRaw ? burnedTicketsRaw.reduce((sum, r) => sum + Number(r.result ?? 0n), 0) : 0
  const pointsPerTicket = Number(pointsPerTicketRaw ?? 100n)
  const maxConvertible = Math.floor(pointsBalance / pointsPerTicket)

  const totalRaffles = Number(nextRaffleIdRaw ?? 0n)

  const raffleOwner = raffleOwnerRaw as string | undefined
  const isOwner = !!(address && raffleOwner && address.toLowerCase() === raffleOwner.toLowerCase())

  const activeRaffleIds = (activeRaffleIdsRaw as bigint[] | undefined) ?? []

  // ── Sponsor apps parsed ──────────────────────────────────────────────────────
  // acceptedSponsorApps: derived from accepted sponsor applications for ActiveRaffleCard sponsor matching
  const { data: nextAppIdRaw } = useReadContract({
    address: pRaffle,
    abi: pRabi,
    functionName: "nextApplicationId",
    chainId: pChain,
    query: { refetchInterval: 60_000 },
  })
  const _appCount = Number(nextAppIdRaw ?? 0n)
  const { data: allAppsRaw } = useReadContracts({
    contracts: Array.from({ length: _appCount }, (_, i) => ({
      address: pRaffle,
      abi: pRabi,
      functionName: "applications" as const,
      args: [BigInt(i)] as const,
      chainId: pChain,
    })),
    query: { enabled: _appCount > 0, refetchInterval: 5 * 60_000 },
  })

  const acceptedSponsorApps = useMemo((): AcceptedSponsor[] => {
    if (!allAppsRaw) return []
    return allAppsRaw.flatMap((r, i) => {
      const app = r.result as readonly [string, string, string, string, bigint, bigint, bigint, bigint, bigint, number] | undefined
      if (!app) return []
      const [, , adContent, adLink, duration, prizePaid, , , acceptedAt, status] = app
      if (status !== 1) return []
      let sponsorName = ""
      try { sponsorName = (JSON.parse(adContent) as Record<string, string>).sponsorName ?? "" } catch { /* */ }
      if (!sponsorName) return []
      return [{ appId: i, sponsorName, duration: Number(duration), prizePaid, adLink, acceptedAt: Number(acceptedAt) }]
    })
  }, [allAppsRaw])

  const streakData = streakRaw as [bigint, number, number] | undefined
  const lastClaimDay = streakData?.[0] ?? 0n
  const streakDay = Number(streakData?.[1] ?? 0)
  const claimedMask = Number(streakData?.[2] ?? 0)
  const today = BigInt(getUtcDay())
  const claimedToday = lastClaimDay === today
  const journeyComplete = streakDay >= 90
  const isConsecutive = lastClaimDay === today - 1n && streakDay > 0 && streakDay < 90
  const nextDay = claimedToday ? streakDay : isConsecutive ? streakDay + 1 : 1
  const displayReward = nextDay <= 7 ? (GM_DAY_REWARDS[nextDay - 1] ?? 5) : GM_FLAT_REWARD
  const MILESTONE_POINT_BONUSES: Record<number, number> = { 7: 1, 14: 1, 30: 2, 60: 2, 90: 3 }
  const displayPoints = 1 + (MILESTONE_POINT_BONUSES[nextDay] ?? 0) + (nextDay > 90 && (nextDay - 90) % 30 === 0 ? 3 : 0)
  const progressPctStreak = Math.min((streakDay / 90) * 100, 100)

  // Refetch all live data when user returns to this tab
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return
      refetchPoints()
      refetchTickets()
      refetchActiveRaffles()
      refetchNextRaffleId()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refetchPoints, refetchTickets, refetchActiveRaffles, refetchNextRaffleId])

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleConvert() {
    const amount = parseInt(convertAmount)
    if (!amount || amount < 1 || amount > maxConvertible || !address) return
    setIsConverting(true)
    try {
      if (inWorldApp) {
        const result = await MiniKit.sendTransaction({
          transactions: [{ to: pBoozt, data: encodeFunctionData({ abi: pBabi, functionName: "convertToTickets", args: [BigInt(amount)] }) }],
          chainId: pChain,
        })
        if (!result?.data?.userOpHash) throw new Error("No userOpHash")
      } else {
        await ensureRewardChain()
        let ranPaymaster = false
        if (await canUsePaymaster(PAYMASTER_URL)) {
          try {
            const callsId = await sendBatchWithAttribution([
              { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "convertToTickets", args: [BigInt(amount)] },
            ], PAYMASTER_URL!)
            await waitForPaymasterCalls(callsId)
            ranPaymaster = true
          } catch { /* fall through */ }
        }
        if (!ranPaymaster) {
          const tx = await writeContractAsync({
            address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI,
            functionName: "convertToTickets", args: [BigInt(amount)],
            chainId: APP_CHAIN.id, ...DATA_SUFFIX_PARAM,
          })
          await waitForTransactionReceipt(wagmiConfig, { hash: tx })
        }
      }
      setConvertAmount("")
      refetchPoints()
      refetchTickets()
      toast({ title: "Converted!", description: `${amount} ticket${amount > 1 ? "s" : ""} added to your balance.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar
        title="Rewards"
        rightExtra={
          <Link href="/leaderboard" aria-label="Leaderboard" className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-900 transition-colors">
            <FaRankingStar size={20} />
          </Link>
        }
      />

      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full">

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("raffle")}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "raffle" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Raffle
          </button>
          <button
            onClick={() => setTab("streak")}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
              tab === "streak" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Daily Streak
            {address && !claimedToday && (
              <span className="w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
        </div>

        {/* ── RAFFLE TAB ──────────────────────────────────────────────────── */}
        {tab === "raffle" && (
          <ScrollReveal>
          <div className="space-y-4">

            {/* Single raffle card — defaults to latest, dropdown inside to switch */}
            {totalRaffles > 0 ? (
              <ActiveRaffleCard
                raffleId={BigInt(totalRaffles - 1)}
                userAddress={address}
                isOwner={isOwner}
                totalRaffles={totalRaffles}
                userTicketBalance={ticketBalance}
                acceptedSponsorApps={acceptedSponsorApps}
                boozTokenAddress={pageBoozToken as string | undefined}
              />
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <HiTrophy className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm font-semibold text-gray-500">No active raffles right now</p>
                <p className="text-xs text-gray-400 mt-1">Earn points by minting slots and donating, then convert to tickets</p>
              </div>
            )}

            {/* Convert points → tickets */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ticket size={15} className="text-indigo-600" />
                <span className="text-sm font-bold text-indigo-900">Convert Points → Tickets</span>
              </div>

              {/* Inline stats */}
              <div className="flex items-center mb-3 bg-indigo-100/60 rounded-lg overflow-hidden">
                <div className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2">
                  <FaCoins className="text-orange-500" size={13} />
                  <span className="text-xs text-indigo-700">Points</span>
                  <span className="text-xs font-bold text-gray-900">{pointsBalance.toLocaleString()}</span>
                </div>
                <div className="w-px self-stretch bg-indigo-200" />
                <div className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2">
                  <Ticket size={13} className="text-indigo-500" />
                  <span className="text-xs text-indigo-700">Tickets</span>
                  <span className="text-xs font-bold text-indigo-600">{ticketBalance.toLocaleString()}</span>
                </div>
                <div className="w-px self-stretch bg-indigo-200" />
                <div className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2">
                  <Flame size={13} className="text-rose-500" />
                  <span className="text-xs text-indigo-700">Burned</span>
                  <span className="text-xs font-bold text-rose-500">{burnedTickets.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-xs text-indigo-700 mb-3">
                {pointsPerTicket} points = 1 ticket{maxConvertible > 0 ? ` · up to ${maxConvertible} ticket${maxConvertible !== 1 ? "s" : ""} available` : ""}
              </p>
              <div className="flex gap-2">
                <div className={cn("flex flex-1 border rounded-lg overflow-hidden", maxConvertible > 0 ? "border-indigo-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500" : "border-indigo-100 bg-indigo-100/40")}>
                  <input
                    type="number"
                    min="1"
                    max={maxConvertible}
                    value={convertAmount}
                    onChange={e => setConvertAmount(e.target.value)}
                    placeholder={maxConvertible > 0 ? `1–${maxConvertible}` : "0"}
                    disabled={maxConvertible === 0}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none min-w-0 disabled:cursor-not-allowed bg-transparent"
                  />
                  {maxConvertible > 0 && (
                    <button
                      onClick={() => setConvertAmount(String(maxConvertible))}
                      className="px-2.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 border-l border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      Max
                    </button>
                  )}
                </div>
                {inWorldApp && !convertCanProceed ? (
                  <WorldIDVerifyButton
                    onSuccess={convertVerifySuccess}
                    isVerifying={convertIsVerifying}
                    signal={address}
                    className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                  >
                    Verify to Convert
                  </WorldIDVerifyButton>
                ) : (
                  <button
                    onClick={handleConvert}
                    disabled={
                      isConverting ||
                      maxConvertible === 0 ||
                      !convertAmount ||
                      parseInt(convertAmount) < 1 ||
                      parseInt(convertAmount) > maxConvertible
                    }
                    className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isConverting ? "Converting..." : "Convert"}
                  </button>
                )}
              </div>

            </div>

            {/* How it works */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">How to earn points</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Mint a content slot</span>
                  <span className="text-xs font-bold text-indigo-600">+15 pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Donate to a creator <span className="text-xs text-gray-400">(once per 24h)</span></span>
                  <span className="text-xs font-bold text-indigo-600">+5 pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Daily GM streak <span className="text-xs text-gray-400">(+bonus on milestones)</span></span>
                  <span className="text-xs font-bold text-indigo-600">+1–4 pts</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 border-t border-gray-200 pt-3">
                {pointsPerTicket} points = 1 ticket · more tickets = better odds · you choose how many to use per raffle
              </p>
            </div>

          </div>
          </ScrollReveal>
        )}

        {/* ── STREAK TAB ──────────────────────────────────────────────────── */}
        {tab === "streak" && (
          <ScrollReveal>
          <div className="space-y-4">

            {/* Balances — WLD+USDC+BOOZ (World) or USDC+BOOZ+Points (Base) */}
            {address && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {/* WLD — World App only */}
                {inWorldApp && (
                  <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/world.svg" alt="WLD" className="flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9" />
                    <div className="flex flex-col">
                      <span className="text-[9px] sm:text-[10px] font-semibold text-gray-600 uppercase tracking-wide leading-none mb-0.5">$WLD</span>
                      <span className="text-sm sm:text-xl font-black text-gray-900 leading-tight">{wldFormatted}</span>
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/usdc.svg" alt="USDC" className="flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9" />
                  <div className="flex flex-col">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-blue-600 uppercase tracking-wide leading-none mb-0.5">$USDC</span>
                    <span className="text-sm sm:text-xl font-black text-blue-900 leading-tight">{usdcFormatted}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/booz.svg" alt="BOOZ" className="flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9" />
                  <div className="flex flex-col">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-[#E63946] uppercase tracking-wide leading-none mb-0.5">$BOOZ</span>
                    <span className="text-sm sm:text-xl font-black text-red-900 leading-tight">{boozFormatted}</span>
                  </div>
                </div>
                {/* Points — Base only */}
                {!inWorldApp && (
                  <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
                    <FaCoins className="text-orange-500 flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9" />
                    <div className="flex flex-col">
                      <span className="text-[9px] sm:text-[10px] font-semibold text-orange-600 uppercase tracking-wide leading-none mb-0.5">Points</span>
                      <span className="text-base sm:text-xl font-black text-orange-900 leading-tight">{pointsBalance.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GM Streak Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <span className="text-gray-900 font-semibold">Daily Streak</span>
                </div>
                {address && claimedToday && (
                  <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                    Claimed today
                  </span>
                )}
              </div>

              {/* Journey progress */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">
                    {journeyComplete ? "Journey Complete 🔱" : `Day ${streakDay} / 90`}
                  </span>
                  <span className="text-xs text-gray-400">{Math.round(progressPctStreak)}%</span>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full mb-4">
                  <div
                    className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPctStreak}%` }}
                  />
                  {MILESTONES.map(m => {
                    const pct = (m.day / 90) * 100
                    const claimed = !!(claimedMask & (1 << m.bit))
                    const reached = streakDay >= m.day
                    return (
                      <div
                        key={m.day}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                        style={{ left: `${pct}%` }}
                      >
                        <div className={cn(
                          "w-3 h-3 rounded-full border-2 border-white",
                          claimed ? "bg-emerald-500" : reached ? "bg-emerald-300" : "bg-gray-300"
                        )} />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Reward preview */}
              {address && !journeyComplete && (
                <div className="flex items-center justify-between mb-5 py-3 border-y border-gray-100">
                  <span className="text-gray-500 text-sm">
                    {claimedToday ? "Tomorrow's reward" : "Today's reward"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <HiBolt className="text-yellow-500" size={14} />
                    <span className="text-gray-900 font-bold text-sm">{displayReward}</span>
                    <span className="text-gray-400 text-sm">$BOOZ</span>
                    <span className="text-gray-300 text-sm">+</span>
                    <FaCoins className="text-orange-500" size={13} />
                    <span className="text-gray-900 font-bold text-sm">{displayPoints}</span>
                    <span className="text-gray-400 text-sm">points</span>
                  </div>
                </div>
              )}

              {!address && (
                <p className="text-center text-gray-400 text-sm py-2">
                  Connect wallet to claim your daily BOOZ
                </p>
              )}
              {address && journeyComplete && (
                <div className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-black uppercase tracking-widest py-3.5 rounded-xl text-sm text-center opacity-80">
                  Journey Complete 🔱
                </div>
              )}
              {address && !journeyComplete && !claimedToday && (
                <button
                  onClick={() => setGmOpen(true)}
                  className="w-full bg-blue-600 text-white font-black uppercase tracking-widest py-3.5 rounded-xl text-sm hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <HiBolt size={16} className="text-yellow-300" />
                  GM — Claim Now
                </button>
              )}
              {address && !journeyComplete && claimedToday && (
                <p className="text-center text-gray-400 text-sm py-2">
                  Come back tomorrow for Day {streakDay + 1} ✨
                </p>
              )}
            </div>

            {/* How to Earn */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-gray-900 font-semibold text-sm mb-4">How to Earn $BOOZ & Points</p>
              <div className="space-y-2">
                {[
                  { label: "Mint a slot (1 USDC)",          booz: "+1,000",    pts: "+15" },
                  { label: "Donation (1 USDC/24 Hour)",     booz: "+1,000",    pts: "+5"  },
                  { label: "Daily GM – Days 1–7",           booz: "+5 to +35", pts: "+1"  },
                  { label: "Daily GM – Days 8–90",          booz: "+50",       pts: "+1"  },
                ].map(({ label, booz, pts }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 text-xs">{label}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <HiBolt className="text-yellow-500" size={11} />
                        <span className="text-gray-900 text-xs font-semibold">{booz} $BOOZ</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FaCoins className="text-orange-500" size={10} />
                        <span className="text-gray-900 text-xs font-semibold">{pts} pts</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Milestone bonuses (one-time)</p>
                  {[
                    { label: "⚔️ Warrior (day 7)",  booz: "+50",    pts: "+1" },
                    { label: "🛡️ Elite (day 14)",   booz: "+250",   pts: "+1" },
                    { label: "👑 Epic (day 30)",     booz: "+350",   pts: "+2" },
                    { label: "🔥 Legend (day 60)",   booz: "+500",   pts: "+2" },
                    { label: "🔱 Mythic (day 90)",   booz: "+4,560", pts: "+3" },
                  ].map(({ label, booz, pts }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-gray-500 text-xs">{label}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <HiBolt className="text-yellow-500" size={11} />
                          <span className="text-gray-900 text-xs font-semibold">{booz} $BOOZ</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FaCoins className="text-orange-500" size={10} />
                          <span className="text-gray-900 text-xs font-semibold">{pts} pts</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 border-t border-gray-100 flex justify-center pt-4">
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5">
                      <HiBolt className="text-emerald-500" size={13} />
                      <span className="text-xs font-bold text-emerald-700">10,000 $BOOZ total over 90 days</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </ScrollReveal>
        )}
      </section>

      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 h-20 pointer-events-none z-40">
        <div className="relative h-full">
          <ProgressiveBlur height="100%" position="bottom" />
        </div>
      </div>
      <Navbar />

      {/* GM Modal — Vaul drawer (mobile) / Dialog (desktop) */}
      {isMobile ? (
        <Sheet open={gmOpen} onOpenChange={setGmOpen}>
          <SheetContent
            side="bottom"
            className="rounded-tl-2xl rounded-tr-2xl border-t border-gray-200 outline-none p-0"
            style={{ background: "linear-gradient(160deg, #f0f4ff 0%, #e8f0fe 40%, #f5f7ff 100%)" }}
          >
            <SheetTitle className="sr-only">Daily GM</SheetTitle>
            <SheetDescription className="sr-only">Daily GM streak claim</SheetDescription>
            <GMContent onClose={() => setGmOpen(false)} />
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={gmOpen} onOpenChange={setGmOpen}>
          <DialogContent
            className="p-0 max-w-sm rounded-2xl overflow-hidden border border-gray-200"
            style={{ background: "linear-gradient(160deg, #f0f4ff 0%, #e8f0fe 40%, #f5f7ff 100%)" }}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Daily GM</DialogTitle>
            </DialogHeader>
            <GMContent onClose={() => setGmOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </main>
  )
}
