"use client"

import { useState, useEffect, useMemo } from "react"
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig } from "@/lib/wagmi"
import { formatUnits, parseAbiItem } from "viem"
import { HiBolt, HiTrophy } from "react-icons/hi2"
import { Ticket, BadgeCheck } from "lucide-react"
import { APP_CHAIN } from "@/lib/wagmi"
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
import { usePriceTiers } from "@/hooks/usePriceTiers"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"

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

const RAFFLE_DURATION_OPTIONS = [
  { label: "7 days",       seconds: 7  * 86400 },
  { label: "14 days",      seconds: 14 * 86400 },
  { label: "30 days",      seconds: 30 * 86400 },
  { label: "Custom",       seconds: 0 },
]

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

// TODO: move to NEXT_PUBLIC_RAFFLE_DEPLOY_BLOCK env var once confirmed on mainnet
const RAFFLE_DEPLOY_BLOCK = 38_200_000n

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
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const { data: raffleRaw, refetch: refetchRaffle } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffle",
    args: [selectedId],
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 60_000 },
  })

  const { data: prizeAmountsRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRafflePrizeAmounts",
    args: [selectedId],
    chainId: APP_CHAIN.id,
  })

  const { data: userRaffleTicketsRaw, refetch: refetchUserTickets } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "raffleTickets",
    args: userAddress ? [selectedId, userAddress] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!userAddress, refetchInterval: 60_000 },
  })

  const { data: hasEnteredRaw, refetch: refetchHasEntered } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "hasEntered",
    args: userAddress ? [selectedId, userAddress] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!userAddress, refetchInterval: 60_000 },
  })

  const { data: winnersRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffleWinners",
    args: [selectedId],
    chainId: APP_CHAIN.id,
  })

  // getRaffle returns tuple: (prizeTokens, winnerCount, startTime, endTime, status,
  //   drawThreshold, minUniqueEntrants, drawRequested, totalTickets, uniqueEntrants)
  const raffle = raffleRaw as readonly [
    readonly string[], bigint, bigint, bigint, number,
    bigint, bigint, boolean, bigint, bigint,
  ] | undefined

  const prizeAmounts = prizeAmountsRaw as readonly (readonly bigint[])[] | undefined
  const winners = (winnersRaw as string[] | undefined) ?? []
  const userRaffleTickets = Number(userRaffleTicketsRaw ?? 0n)
  const hasEntered = hasEnteredRaw as boolean | undefined

  const { data: raffleDrawBlockRaw } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
    functionName: "raffleDrawBlock",
    args: [selectedId],
    chainId: APP_CHAIN.id,
    query: { enabled: winners.length > 0, refetchInterval: 60_000 },
  })

  const { data: winnerTicketsRaw } = useReadContracts({
    contracts: winners.map(addr => ({
      address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
      functionName: "raffleTickets" as const,
      args: [selectedId, addr as `0x${string}`] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: winners.length > 0 },
  })

  // Draw tx hash — fetched via getLogs once drawBlock is known (must be before early return)
  const drawBlock = Number(raffleDrawBlockRaw ?? 0n)
  const basescanHost = (APP_CHAIN.id as number) === 8453 ? "basescan.org" : "sepolia.basescan.org"
  const publicClient = usePublicClient({ chainId: APP_CHAIN.id })
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
      address: RAFFLE_ADDRESS as `0x${string}`,
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

  if (!raffle) return null

  // FIX (Issue 3): Wait for boozToken read to resolve before computing prize decimals.
  // Without this guard, the initial render uses prizeDecimals=6 (USDC fallback) for BOOZ
  // prizes, causing raw 18-decimal amounts to display as astronomically large USDC values.
  if (boozTokenAddress === undefined) return null

  // status: 0 = Active, 1 = Drawn, 2 = Cancelled
  const [prizeTokens, winnerCount, startTime, endTime, raffleStatus, drawThreshold, minUniqueEntrants, drawRequested, totalTickets, uniqueEntrants] = raffle

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
  const drawable = ended && thresholdMet && uniqueMet && !drawRequested && !isDrawn && !isCancelled
  const isStuckDraw = drawRequested && !isDrawn && !isCancelled

  async function handleEnter() {
    const amount = parseInt(ticketInput)
    if (!amount || amount < 1 || !userAddress) return
    setIsEntering(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "enterRaffle",
        args: [selectedId, BigInt(amount)],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
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
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "triggerDraw",
        args: [selectedId],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffle()
      toast({ title: "Draw Triggered!", description: `VRF request submitted for Raffle #${Number(selectedId) + 1}.` })
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
    } finally {
      setIsDrawing(false)
    }
  }

  async function handleReset() {
    setIsResetting(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "resetDraw",
        args: [selectedId],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffle()
      toast({ title: "Draw Reset", description: `Raffle #${Number(selectedId) + 1} ready to re-trigger.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setIsResetting(false)
    }
  }

  async function handleCancel() {
    setIsCancelling(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "cancelRaffle",
        args: [selectedId],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffle()
      toast({ title: "Raffle Cancelled", description: `Raffle #${Number(selectedId) + 1} has been cancelled.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setIsCancelling(false)
    }
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
        <div className="text-2xl font-bold text-center mt-3">
          {totalPrize > 0n
            ? (isBoozPrize ? `${totalPrizeFormatted} $BOOZ` : `$${totalPrizeFormatted}`)
            : "—"}
        </div>
        <div className="text-xs text-white/60 text-center mt-2">
          {Number(winnerCount)} winner{Number(winnerCount) !== 1 ? "s" : ""} ·{" "}
          {Number(totalTickets).toLocaleString()} ticket{Number(totalTickets) !== 1 ? "s" : ""} ·{" "}
          {Number(uniqueEntrants).toLocaleString()} unique entrant{Number(uniqueEntrants) !== 1 ? "s" : ""}
        </div>

        {/* Sponsor info */}
        {raffleSponsor && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
            <span className="text-xs text-white/60">
              Sponsored by <span className="font-semibold text-white">{raffleSponsor.sponsorName}</span>
            </span>
            {sponsorLinks && (
              <div className="flex items-center gap-2">
                {SPONSOR_LINK_ICONS.map(({ key, icon, alt }) => {
                  const href = sponsorLinks[key]
                  if (!href) return null
                  return (
                    <a key={key} href={href} target="_blank" rel="noopener noreferrer"
                      className="opacity-60 hover:opacity-100 transition-opacity">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={icon} width={14} height={14} alt={alt} className="invert" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-center mt-2">
          {isCancelled ? (
            <span className="bg-red-400/20 border border-red-300/30 rounded-full px-2.5 py-0.5 text-red-200">
              Cancelled
            </span>
          ) : isDrawn ? (
            <span className="bg-emerald-400/20 border border-emerald-300/30 rounded-full px-2.5 py-0.5 text-emerald-200">
              Drawn ✓
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
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={cn("h-2 rounded-full transition-all", thresholdMet ? "bg-green-500" : "bg-blue-500")}
                style={{ width: `${Math.min((Number(totalTickets) / Math.max(Number(drawThreshold), 1)) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Unique entrants</span>
              <span className={uniqueMet ? "text-green-600 font-semibold" : ""}>
                {Number(uniqueEntrants)} / {Number(minUniqueEntrants)} min{uniqueMet ? " ✓" : ""}
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

        {/* Enter raffle input */}
        {userAddress && !ended && !isDrawn && !isCancelled && (
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
            <button
              onClick={handleEnter}
              disabled={isEntering || !ticketInput || parseInt(ticketInput) < 1}
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isEntering ? "Entering..." : hasEntered ? "Add More" : "Enter"}
            </button>
          </div>
        )}


        {/* Owner: trigger draw */}
        {isOwner && drawable && (
          <button
            onClick={handleDraw}
            disabled={isDrawing}
            className="w-full bg-amber-500 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {isDrawing ? "Requesting VRF..." : "Trigger Draw"}
          </button>
        )}

        {/* Owner: stuck VRF reset */}
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
          <p className="text-xs text-blue-500 mt-0.5">
            {Number(totalTickets).toLocaleString()} entries · {Number(uniqueEntrants).toLocaleString()} unique minters
          </p>
        </div>

        {/* Requirements met row */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100 text-xs text-gray-500">
          <span>Requirements at draw time</span>
          <span className="text-green-600 font-semibold">
            {Number(totalTickets).toLocaleString()} entries · {Number(uniqueEntrants).toLocaleString()} unique ✓
          </span>
        </div>

        {/* Winners table */}
        <div className="bg-white">
          <div className="grid grid-cols-[2rem_1fr_auto] gap-x-3 px-4 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide border-b border-gray-100">
            <span>#</span>
            <span>Minter</span>
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
                  <span className={cn(
                    "font-mono text-xs truncate",
                    isYou ? "text-green-700 font-bold" : "text-gray-600"
                  )}>
                    {`${addr.slice(0, 6)}...${addr.slice(-4)}`}{isYou ? " (you)" : ""}
                  </span>
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
  const { address } = useAccount()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<"raffle" | "streak">("raffle")
  const [gmOpen, setGmOpen] = useState(false)
  const [convertAmount, setConvertAmount] = useState("")
  const [isConverting, setIsConverting] = useState(false)
  const [thresholdInput, setThresholdInput] = useState("")
  const [minUniqueInput, setMinUniqueInput] = useState("")
  const [isSettingThreshold, setIsSettingThreshold] = useState(false)
  const [isSettingMinUnique, setIsSettingMinUnique] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [crToken, setCrToken] = useState<"usdc" | "booz">("usdc")
  const [crPrizes, setCrPrizes] = useState<string[]>(["", "", ""])
  const [crWinnerCount, setCrWinnerCount] = useState("3")
  const [crDurationIdx, setCrDurationIdx] = useState(1)
  const [crCustomHours, setCrCustomHours] = useState("1")
  const [isCreatingRaffle, setIsCreatingRaffle] = useState(false)
  const [crSponsorAppId, setCrSponsorAppId] = useState<number | null>(null)
  const [ptHours, setPtHours] = useState("")
  const [ptMinPrize, setPtMinPrize] = useState("")
  const [ptFee, setPtFee] = useState("")
  const [isSettingTier, setIsSettingTier] = useState(false)
  const [removingTierSeconds, setRemovingTierSeconds] = useState<number | null>(null)
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  // ── User balances ──────────────────────────────────────────────────────────
  const { data: boozBalanceRaw } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  const { data: pointsRaw, refetch: refetchPoints } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "points",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  const { data: ticketBalanceRaw, refetch: refetchTickets } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "tickets",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  const { data: pointsPerTicketRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "pointsPerTicket",
    chainId: APP_CHAIN.id,
  })

  // ── Raffle reads ────────────────────────────────────────────────────────────
  // Read boozToken from contract directly — avoids env-var mismatch in token detection
  const { data: pageBoozToken } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "boozToken",
    chainId: APP_CHAIN.id,
  })

  const { data: nextRaffleIdRaw, refetch: refetchNextRaffleId } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "nextRaffleId",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 60_000, refetchOnWindowFocus: true },
  })

  const _raffleCount = Number(nextRaffleIdRaw ?? 0n)
  // FIX: was polling every 60s — tickets committed to past raffles are immutable so
  // periodic refetch was wasting N calls/min (one per raffle). Fetch once and cache.
  // Note: the active raffle's per-user ticket count is handled separately inside
  // ActiveRaffleCard (refetchUserTickets), so this display stat stays accurate enough.
  const { data: burnedTicketsRaw } = useReadContracts({
    contracts: Array.from({ length: _raffleCount }, (_, i) => ({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "raffleTickets" as const,
      args: [BigInt(i), address!] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: !!address && _raffleCount > 0 },
  })

  const _recentCount = Math.min(_raffleCount, 5)
  const _recentOffset = _raffleCount - _recentCount

  const { data: allRafflesRaw } = useReadContracts({
    contracts: Array.from({ length: _recentCount }, (_, i) => ({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "getRaffle" as const,
      args: [BigInt(_recentOffset + i)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: _recentCount > 0, refetchInterval: 60_000 },
  })

  const { data: allRafflePrizesRaw } = useReadContracts({
    contracts: Array.from({ length: _recentCount }, (_, i) => ({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "getRafflePrizeAmounts" as const,
      args: [BigInt(_recentOffset + i)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: _recentCount > 0, refetchInterval: 60_000 },
  })

  // FIX: data result was never consumed — only refetch() is called after writes and on
  // tab focus. Removed the 60s poll since there is nothing to display from this read.
  const { refetch: refetchActiveRaffles } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getActiveRaffles",
    chainId: APP_CHAIN.id,
  })

  // ── Owner reads ─────────────────────────────────────────────────────────────
  const { data: raffleOwnerRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "owner",
    chainId: APP_CHAIN.id,
  })

  const { data: defaultThresholdRaw, refetch: refetchThreshold } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "defaultDrawThreshold",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 60_000, refetchOnWindowFocus: true },
  })

  const { data: defaultMinUniqueRaw, refetch: refetchMinUnique } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "defaultMinUniqueEntrants",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 60_000, refetchOnWindowFocus: true },
  })

  const { data: raffleUsdcRaw, refetch: refetchRaffleUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [RAFFLE_ADDRESS],
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 60_000 },
  })

  const { tiers: priceTiers, loading: tiersLoading, refetch: refetchTiers } = usePriceTiers()

  // ── Sponsor application reads ────────────────────────────────────────────────
  const { data: nextAppIdRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "nextApplicationId",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 60_000 },
  })
  const _appCount = Number(nextAppIdRaw ?? 0n)
  // FIX: was polling every 60s — accepted sponsor applications are immutable and new
  // submissions are infrequent. Reduced to 5-min interval to limit fan-out (N calls
  // per poll where N = total application count).
  const { data: allAppsRaw } = useReadContracts({
    contracts: Array.from({ length: _appCount }, (_, i) => ({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "applications" as const,
      args: [BigInt(i)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: _appCount > 0, refetchInterval: 5 * 60_000 },
  })

  // ── Streak reads ────────────────────────────────────────────────────────────
  const { data: streakRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "gmStreaks",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address, refetchInterval: 60_000 },
  })

  // ── Computed ────────────────────────────────────────────────────────────────
  const boozNum = boozBalanceRaw ? Number(formatUnits(boozBalanceRaw as bigint, 18)) : 0
  const boozFormatted = boozNum.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const usdcNum = usdcBalanceRaw ? Number(usdcBalanceRaw as bigint) / 1_000_000 : 0
  const usdcFormatted = usdcNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const pointsBalance = Number(pointsRaw ?? 0n)
  const ticketBalance = Number(ticketBalanceRaw ?? 0n)
  const burnedTickets = burnedTicketsRaw ? burnedTicketsRaw.reduce((sum, r) => sum + Number(r.result ?? 0n), 0) : 0
  const pointsPerTicket = Number(pointsPerTicketRaw ?? 100n)
  const maxConvertible = Math.floor(pointsBalance / pointsPerTicket)

  const totalRaffles = Number(nextRaffleIdRaw ?? 0n)

  const raffleOwner = raffleOwnerRaw as string | undefined
  const isOwner = !!(address && raffleOwner && address.toLowerCase() === raffleOwner.toLowerCase())

  const defaultThreshold = Number(defaultThresholdRaw ?? 100n)
  const defaultMinUnique = Number(defaultMinUniqueRaw ?? 5n)

  const raffleUsdc = raffleUsdcRaw as bigint | undefined
  const raffleUsdcNum = raffleUsdc !== undefined ? Number(raffleUsdc) / 1_000_000 : undefined

  // ── Sponsor apps parsed ──────────────────────────────────────────────────────
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

  // Active sponsors available for a new raffle — started, non-expired, and not already matched to a live/drawn raffle
  const activeSponsors = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    return acceptedSponsorApps.filter(s => {
      if (s.acceptedAt > now) return false              // not started yet (queued)
      if (s.acceptedAt + s.duration <= now) return false // expired
      // Check if any non-cancelled raffle already matches this sponsor
      const alreadyUsed = (allRafflesRaw ?? []).some((r, i) => {
        const rData = r.result as readonly [readonly string[], bigint, bigint, bigint, number, ...unknown[]] | undefined
        if (!rData) return false
        const [prizeTokens, , startTime, , raffleStatus] = rData
        if (raffleStatus === 2) return false // cancelled — doesn't count
        if (Number(startTime) < s.acceptedAt || Number(startTime) >= s.acceptedAt + s.duration) return false
        // Must be USDC prize (skip BOOZ raffles — check against contract's boozToken)
        const boozAddr = ((pageBoozToken as string | undefined) ?? TOKEN_ADDRESS).toLowerCase()
        if ((prizeTokens as string[])[0]?.toLowerCase() === boozAddr) return false
        // Prize amount must match
        const prizeData = (allRafflePrizesRaw ?? [])[i]?.result as readonly (readonly bigint[])[] | undefined
        const totalPrize = (prizeData?.[0] ?? []).reduce((a: bigint, b: bigint) => a + b, 0n)
        const diff = totalPrize > s.prizePaid ? totalPrize - s.prizePaid : s.prizePaid - totalPrize
        return diff <= 1_000_000n
      })
      return !alreadyUsed
    })
  }, [acceptedSponsorApps, allRafflesRaw, allRafflePrizesRaw])

  // USDC balance actually available for a new owner-funded raffle:
  // total contract balance minus prizes already committed to active raffles.
  const availableUsdcBn = useMemo(() => {
    let committed = 0n
    ;(allRafflesRaw ?? []).forEach((r, i) => {
      const rData = r.result as readonly [readonly string[], bigint, bigint, bigint, number, ...unknown[]] | undefined
      if (!rData) return
      const [prizeTokens, , , , raffleStatus] = rData
      if (raffleStatus !== 0) return // only Active (0)
      const usdcIdx = (prizeTokens as string[]).findIndex(t => t.toLowerCase() === USDC_ADDRESS.toLowerCase())
      if (usdcIdx === -1) return
      const prizeData = (allRafflePrizesRaw ?? [])[i]?.result as readonly (readonly bigint[])[] | undefined
      const total = (prizeData?.[usdcIdx] ?? []).reduce((a: bigint, b: bigint) => a + b, 0n)
      committed += total
    })
    const balance = (raffleUsdcRaw as bigint | undefined) ?? 0n
    return balance > committed ? balance - committed : 0n
  }, [allRafflesRaw, allRafflePrizesRaw, raffleUsdcRaw])

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
  const progressPctStreak = Math.min((streakDay / 90) * 100, 100)

  // Refetch all live data when user returns to this tab
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return
      refetchPoints()
      refetchTickets()
      refetchActiveRaffles()
      refetchRaffleUsdc()
      refetchNextRaffleId()
      refetchThreshold()
      refetchMinUnique()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refetchPoints, refetchTickets, refetchActiveRaffles, refetchRaffleUsdc, refetchNextRaffleId, refetchThreshold, refetchMinUnique])

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleConvert() {
    const amount = parseInt(convertAmount)
    if (!amount || amount < 1 || amount > maxConvertible || !address) return
    setIsConverting(true)
    try {
      const tx = await writeContractAsync({
        address: BOOZTORY_ADDRESS,
        abi: BOOZTORY_ABI,
        functionName: "convertToTickets",
        args: [BigInt(amount)],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
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

  async function handleSetThreshold() {
    const val = parseInt(thresholdInput)
    if (!val || val < 1 || !isOwner) return
    setIsSettingThreshold(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "setDefaultDrawThreshold",
        args: [BigInt(val)],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setThresholdInput("")
      refetchThreshold()
      toast({ title: "Updated", description: `Default threshold set to ${val}.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setIsSettingThreshold(false)
    }
  }

  async function handleSetMinUnique() {
    const val = parseInt(minUniqueInput)
    if (!val || val < 1 || !isOwner) return
    setIsSettingMinUnique(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "setDefaultMinUniqueEntrants",
        args: [BigInt(val)],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setMinUniqueInput("")
      refetchMinUnique()
      toast({ title: "Updated", description: `Min unique entrants set to ${val}.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setIsSettingMinUnique(false)
    }
  }

  async function handleWithdraw() {
    if (!isOwner) return
    setIsWithdrawing(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "withdraw",
        args: [USDC_ADDRESS],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffleUsdc()
      toast({ title: "Withdrawn", description: "USDC withdrawn to owner wallet." })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setIsWithdrawing(false)
    }
  }

  async function handleSetPriceTier() {
    const hours = parseFloat(ptHours)
    const minPrize = parseFloat(ptMinPrize)
    const fee = parseFloat(ptFee)
    if (!hours || hours <= 0 || !minPrize || minPrize <= 0 || isNaN(fee) || fee < 0 || !isOwner) return
    const durationSeconds = BigInt(Math.round(hours * 3600))
    const minPrizeBn = BigInt(Math.round(minPrize * 1_000_000))
    const feeBn = BigInt(Math.round(fee * 1_000_000))
    setIsSettingTier(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "setPriceTier",
        args: [durationSeconds, minPrizeBn, feeBn],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setPtHours("")
      setPtMinPrize("")
      setPtFee("")
      refetchTiers()
      toast({
        title: "Price Tier Set",
        description: `${hours}h — $${minPrize} prize + $${fee} fee = $${(minPrize + fee).toFixed(2)} total`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setIsSettingTier(false)
    }
  }

  async function handleRemovePriceTier(seconds: number) {
    if (!isOwner) return
    setRemovingTierSeconds(seconds)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "setPriceTier",
        args: [BigInt(seconds), 0n, 0n],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchTiers()
      toast({ title: "Tier Removed", description: "Sponsors can no longer submit for that duration." })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setRemovingTierSeconds(null)
    }
  }

  async function handleCreateRaffle() {
    if (!isOwner) return
    const winnerCount = Math.max(1, Math.min(20, parseInt(crWinnerCount) || 1))
    const prizes = crPrizes.slice(0, winnerCount)
    if (prizes.some(p => !p || parseFloat(p) <= 0)) return

    const sponsorApp = crSponsorAppId !== null ? activeSponsors.find(s => s.appId === crSponsorAppId) : undefined

    const selectedOption = RAFFLE_DURATION_OPTIONS[crDurationIdx]
    const isCustomDuration = selectedOption?.seconds === 0
    const durationHours = isCustomDuration ? Math.max(1, parseInt(crCustomHours) || 1) : 0
    const duration = sponsorApp
      ? sponsorApp.duration
      : isCustomDuration ? durationHours * 3600 : (selectedOption?.seconds ?? RAFFLE_DURATION_OPTIONS[0].seconds)

    const isUsdc = sponsorApp ? true : crToken === "usdc"
    const prizeBns = prizes.map(p =>
      isUsdc
        ? BigInt(Math.round(parseFloat(p) * 1_000_000))
        : BigInt(Math.round(parseFloat(p))) * BigInt("1000000000000000000")
    )
    const totalPrize = prizeBns.reduce((a, b) => a + b, 0n)
    const prizeAmounts: bigint[][] = [prizeBns]
    const prizeToken = isUsdc ? USDC_ADDRESS : TOKEN_ADDRESS

    const isSponsorFunded = crSponsorAppId !== null

    setIsCreatingRaffle(true)
    try {
      if (isSponsorFunded) {
        // Sponsor-funded: prize already in contract from submitApplication — just create
        const createTx = await writeContractAsync({
          address: RAFFLE_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: "createRaffle",
          args: [[prizeToken], prizeAmounts, BigInt(winnerCount), BigInt(duration)],
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: createTx })
      } else if (isUsdc) {
        // Owner-funded USDC: approve → create → deposit
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [RAFFLE_ADDRESS, totalPrize],
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx })

        const createTx = await writeContractAsync({
          address: RAFFLE_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: "createRaffle",
          args: [[prizeToken], prizeAmounts, BigInt(winnerCount), BigInt(duration)],
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: createTx })

        const depositTx = await writeContractAsync({
          address: RAFFLE_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: "depositPrize",
          args: [USDC_ADDRESS, totalPrize],
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: depositTx })
      } else {
        // BOOZ: 1 tx, minted at draw
        const createTx = await writeContractAsync({
          address: RAFFLE_ADDRESS,
          abi: RAFFLE_ABI,
          functionName: "createRaffle",
          args: [[prizeToken], prizeAmounts, BigInt(winnerCount), BigInt(duration)],
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: createTx })
      }

      setCrPrizes(["", "", ""])
      setCrWinnerCount("3")
      setCrSponsorAppId(null)
      refetchActiveRaffles()
      refetchNextRaffleId()
      refetchRaffleUsdc()
      toast({
        title: "Raffle Created!",
        description: `${winnerCount} winner${winnerCount !== 1 ? "s" : ""} · ${totalPrize > 0n ? (isUsdc ? (Number(totalPrize) / 1e6).toFixed(2) : (Number(totalPrize) / 1e18).toFixed(0)) : "0"} ${isUsdc ? "USDC" : "BOOZ"} total`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally {
      setIsCreatingRaffle(false)
    }
  }

  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="Rewards" />

      <section className="py-6 px-6 max-w-[650px] mx-auto w-full">

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
          <div className="space-y-4">

            {/* Stats row */}
            {address && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xs text-gray-500 mb-1">Points</div>
                  <div className="text-base font-black text-gray-900">{pointsBalance.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xs text-gray-500 mb-1">Tickets</div>
                  <div className="text-base font-black text-indigo-600">{ticketBalance.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xs text-gray-500 mb-1">Burned</div>
                  <div className="text-base font-black text-rose-500">{burnedTickets.toLocaleString()}</div>
                </div>
              </div>
            )}

            {/* Convert points → tickets */}
            {address && maxConvertible > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ticket size={15} className="text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-900">Convert Points → Tickets</span>
                </div>
                <p className="text-xs text-indigo-700 mb-3">
                  {pointsPerTicket} points = 1 ticket · up to {maxConvertible} ticket{maxConvertible !== 1 ? "s" : ""} available
                </p>
                <div className="flex gap-2">
                  <div className="flex flex-1 border border-indigo-200 bg-white rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                    <input
                      type="number"
                      min="1"
                      max={maxConvertible}
                      value={convertAmount}
                      onChange={e => setConvertAmount(e.target.value)}
                      placeholder={`1–${maxConvertible}`}
                      className="flex-1 px-3 py-2 text-sm focus:outline-none min-w-0"
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
                  <button
                    onClick={handleConvert}
                    disabled={
                      isConverting ||
                      !convertAmount ||
                      parseInt(convertAmount) < 1 ||
                      parseInt(convertAmount) > maxConvertible
                    }
                    className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isConverting ? "Converting..." : "Convert"}
                  </button>
                </div>
              </div>
            )}

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

            {/* How it works */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-gray-500 text-sm leading-relaxed">
                Earn points by minting slots and donating. Convert points to raffle tickets
                ({pointsPerTicket} points = 1 ticket), then use tickets to enter a raffle.
                More tickets = better odds. You choose how many to use.
              </p>
            </div>

            {/* Owner panel */}
            {isOwner && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-5">

                <p className="text-sm font-bold text-amber-800 uppercase tracking-wide">Owner Panel</p>

                {/* ── Contract balance ── */}
                <div className="bg-white rounded-xl border border-amber-100 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Contract USDC balance</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sponsor prizes accumulate here until withdrawn</p>
                  </div>
                  <span className="text-lg font-black text-amber-700 ml-4 flex-shrink-0">
                    ${raffleUsdcNum?.toFixed(2) ?? "—"}
                  </span>
                </div>

                {/* ── Draw thresholds ── */}
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Draw Thresholds</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Both must be met before you can trigger a draw on any raffle.
                      <br />
                      <span className="font-medium text-gray-700">Ticket threshold</span> — minimum total tickets committed across all entrants (currently <span className="font-bold text-amber-700">{defaultThreshold}</span>).
                      <br />
                      <span className="font-medium text-gray-700">Min unique wallets</span> — minimum distinct addresses that entered (currently <span className="font-bold text-amber-700">{defaultMinUnique}</span>). Lower both for early mainnet.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={thresholdInput}
                      onChange={e => setThresholdInput(e.target.value)}
                      placeholder={`Ticket threshold (now ${defaultThreshold})`}
                      className="flex-1 border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      onClick={handleSetThreshold}
                      disabled={isSettingThreshold || !thresholdInput}
                      className="bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {isSettingThreshold ? "Saving..." : "Set"}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={minUniqueInput}
                      onChange={e => setMinUniqueInput(e.target.value)}
                      placeholder={`Min unique wallets (now ${defaultMinUnique})`}
                      className="flex-1 border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      onClick={handleSetMinUnique}
                      disabled={isSettingMinUnique || !minUniqueInput}
                      className="bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {isSettingMinUnique ? "Saving..." : "Set"}
                    </button>
                  </div>
                </div>

                {/* ── Sponsor Price Tiers ── */}
                <div className="space-y-3 pt-4 border-t border-amber-200">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Sponsor Price Tiers</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Each duration maps to exactly one tier — setting the same duration <span className="font-medium text-gray-700">overwrites</span> it. Different duration = new independent tier.
                    </p>
                  </div>

                  {/* Current tiers table */}
                  <div className="bg-white rounded-xl border border-amber-100 overflow-hidden text-xs">
                    <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_28px] px-3 py-2 text-gray-400 border-b border-amber-100 font-semibold">
                      <span>Duration</span>
                      <span className="text-right">Prize</span>
                      <span className="text-right">Fee</span>
                      <span className="text-right">Sponsor pays</span>
                      <span />
                    </div>
                    {tiersLoading ? (
                      <div className="px-3 py-4 text-center text-gray-300 text-xs">Loading...</div>
                    ) : priceTiers.length === 0 ? (
                      <div className="px-3 py-4 text-center text-gray-300 text-xs">No tiers set yet</div>
                    ) : priceTiers.map(tier => {
                      const prize = Number(tier.minPrize) / 1_000_000
                      const fee   = Number(tier.fee) / 1_000_000
                      const isRemoving = removingTierSeconds === tier.seconds
                      return (
                        <div key={tier.seconds} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_28px] items-center px-3 py-2.5 border-b border-amber-50 last:border-0 text-gray-700">
                          <span className="font-semibold">{tier.label}</span>
                          <span className="text-right tabular-nums">${prize.toFixed(2)}</span>
                          <span className="text-right tabular-nums">${fee.toFixed(2)}</span>
                          <span className="text-right font-bold tabular-nums text-amber-600">${(prize + fee).toFixed(2)}</span>
                          <span className="flex justify-end">
                            <button
                              onClick={() => handleRemovePriceTier(tier.seconds)}
                              disabled={isRemoving}
                              className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                              title="Remove tier"
                            >
                              {isRemoving ? "…" : "✕"}
                            </button>
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Min Prize</span> — USDC locked for the raffle prize pool.{" "}
                    <span className="font-medium text-gray-700">Fee</span> — USDC kept by the platform. Duration in hours (e.g. 1 = 1h, 168 = 7 days).
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Duration (hours)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={ptHours}
                        onChange={e => setPtHours(e.target.value)}
                        placeholder="e.g. 1"
                        className="border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Min Prize (USDC)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ptMinPrize}
                        onChange={e => setPtMinPrize(e.target.value)}
                        placeholder="e.g. 10"
                        className="border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Fee (USDC)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ptFee}
                        onChange={e => setPtFee(e.target.value)}
                        placeholder="e.g. 5"
                        className="border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                  {ptMinPrize && ptFee && parseFloat(ptMinPrize) >= 0 && parseFloat(ptFee) >= 0 && (
                    <p className="text-xs text-amber-700 font-medium">
                      Sponsor pays total: ${(parseFloat(ptMinPrize || "0") + parseFloat(ptFee || "0")).toFixed(2)} USDC
                    </p>
                  )}
                  <button
                    onClick={handleSetPriceTier}
                    disabled={isSettingTier || !ptHours || !ptMinPrize || parseFloat(ptMinPrize) <= 0}
                    className="w-full bg-amber-500 text-white text-sm font-bold py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {isSettingTier ? "Saving..." : "Set Price Tier"}
                  </button>
                </div>

                {/* ── Create Raffle ── */}
                <div className="space-y-3 pt-4 border-t border-amber-200">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Create Raffle</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Owner-funded raffle, no sponsor required.
                      <br />
                      <span className="font-medium text-gray-700">USDC prize</span> — 3 transactions: approve · create · deposit. Prize comes from your wallet.
                      <br />
                      <span className="font-medium text-gray-700">BOOZ prize</span> — 1 transaction: create only. Tokens are minted to winners at draw time.
                    </p>
                  </div>

                  {/* Sponsor select — only shown if there are accepted, non-expired applications */}
                  {activeSponsors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700">Sponsor Application</p>
                      <Select
                        value={crSponsorAppId !== null ? crSponsorAppId.toString() : "none"}
                        onValueChange={v => {
                          if (v === "none") {
                            setCrSponsorAppId(null)
                          } else {
                            const appId = Number(v)
                            setCrSponsorAppId(appId)
                            const sponsor = activeSponsors.find(s => s.appId === appId)
                            if (sponsor) {
                              // Auto-fill duration
                              const matchIdx = RAFFLE_DURATION_OPTIONS.findIndex(o => o.seconds === sponsor.duration && o.seconds !== 0)
                              if (matchIdx !== -1) {
                                setCrDurationIdx(matchIdx)
                              } else {
                                const customIdx = RAFFLE_DURATION_OPTIONS.findIndex(o => o.seconds === 0)
                                if (customIdx !== -1) {
                                  setCrDurationIdx(customIdx)
                                  setCrCustomHours(String(Math.round(sponsor.duration / 3600)))
                                }
                              }
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm border-amber-200 focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="No sponsor (owner-funded)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No sponsor (owner-funded)</SelectItem>
                          {activeSponsors.map(s => (
                            <SelectItem key={s.appId} value={s.appId.toString()}>
                              {s.sponsorName} — ${(Number(s.prizePaid) / 1e6).toFixed(2)} USDC · {Math.round(s.duration / 86400)}d
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {crSponsorAppId !== null && (() => {
                        const sponsor = activeSponsors.find(s => s.appId === crSponsorAppId)
                        if (!sponsor) return null
                        return (
                          <div className="bg-white border border-amber-100 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                            <span className="text-gray-500">Sponsor prize pool (already in contract)</span>
                            <span className="font-bold text-amber-700">${(Number(sponsor.prizePaid) / 1e6).toFixed(2)} USDC</span>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Token toggle — hidden when sponsor is selected (always USDC) */}
                  {crSponsorAppId === null && (
                  <div className="flex rounded-lg border border-amber-200 overflow-hidden text-sm font-semibold">
                    {(["usdc", "booz"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setCrToken(t)}
                        className={cn(
                          "flex-1 py-2 transition-colors",
                          crToken === t ? "bg-amber-500 text-white" : "bg-white text-amber-700 hover:bg-amber-50"
                        )}
                      >
                        {t === "usdc" ? "USDC" : "BOOZ"}
                      </button>
                    ))}
                  </div>
                  )}

                  {/* Winner count + duration row */}
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Winners</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={crWinnerCount}
                        onChange={e => {
                          const n = Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                          setCrWinnerCount(String(n))
                          setCrPrizes(prev => {
                            const next = [...prev]
                            while (next.length < n) next.push("")
                            return next.slice(0, n)
                          })
                        }}
                        className="w-20 border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-gray-500">Duration</label>
                      {crSponsorAppId !== null ? (
                        // Locked to sponsor's duration
                        <div className="w-full border border-amber-100 bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-700 font-medium">
                          {(() => {
                            const s = activeSponsors.find(sp => sp.appId === crSponsorAppId)
                            if (!s) return "—"
                            const days = Math.round(s.duration / 86400)
                            return days >= 1 ? `${days} day${days !== 1 ? "s" : ""}` : `${Math.round(s.duration / 3600)}h`
                          })()}
                        </div>
                      ) : (
                      <select
                        value={crDurationIdx}
                        onChange={e => setCrDurationIdx(Number(e.target.value))}
                        className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        {RAFFLE_DURATION_OPTIONS.map((o, i) => (
                          <option key={i} value={i}>{o.label}</option>
                        ))}
                      </select>
                      )}
                    </div>
                  </div>

                  {/* Custom duration input — only when no sponsor and custom selected */}
                  {crSponsorAppId === null && RAFFLE_DURATION_OPTIONS[crDurationIdx]?.seconds === 0 && (
                    <input
                      type="number"
                      min="1"
                      value={crCustomHours}
                      onChange={e => setCrCustomHours(e.target.value)}
                      placeholder="Number of hours"
                      className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  )}

                  {/* Per-winner prize inputs */}
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">
                      Prize per winner ({crSponsorAppId !== null ? "USDC" : crToken === "usdc" ? "USDC" : "BOOZ"})
                      {crSponsorAppId !== null && (() => {
                        const s = activeSponsors.find(sp => sp.appId === crSponsorAppId)
                        return s ? <span className="text-amber-600 font-medium"> — must total ${(Number(s.prizePaid) / 1e6).toFixed(2)}</span> : null
                      })()}
                    </label>
                    {Array.from({ length: Math.max(1, Math.min(20, parseInt(crWinnerCount) || 1)) }, (_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">#{i + 1}</span>
                        <input
                          type="number"
                          min="0"
                          step={crToken === "usdc" ? "0.01" : "1"}
                          value={crPrizes[i] ?? ""}
                          onChange={e => setCrPrizes(prev => {
                            const next = [...prev]
                            next[i] = e.target.value
                            return next
                          })}
                          placeholder={crToken === "usdc" ? "0.00" : "0"}
                          className="flex-1 border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Total summary */}
                  {crPrizes.slice(0, parseInt(crWinnerCount) || 1).some(p => p && parseFloat(p) > 0) && (() => {
                    const sponsorApp = crSponsorAppId !== null ? activeSponsors.find(s => s.appId === crSponsorAppId) : undefined
                    const isSponsor  = !!sponsorApp
                    const effectiveUsdc = isSponsor ? true : crToken === "usdc"
                    const total      = crPrizes.slice(0, parseInt(crWinnerCount) || 1).reduce((sum, p) => sum + (parseFloat(p) || 0), 0)
                    const poolUsdc   = isSponsor
                      ? Number(sponsorApp!.prizePaid) / 1e6
                      : Number(availableUsdcBn) / 1e6
                    const over       = effectiveUsdc && total > poolUsdc
                    const under      = isSponsor && effectiveUsdc && total < poolUsdc
                    return (
                      <div className="space-y-0.5">
                        <p className={cn("text-xs font-medium", over || under ? "text-red-600" : "text-amber-700")}>
                          Total: {total.toFixed(effectiveUsdc ? 2 : 0)}{" "}
                          {effectiveUsdc ? "USDC" : "BOOZ"} across {parseInt(crWinnerCount) || 1} winner{(parseInt(crWinnerCount) || 1) !== 1 ? "s" : ""}
                        </p>
                        {effectiveUsdc && (
                          <p className={cn("text-xs", over || under ? "text-red-500" : "text-gray-400")}>
                            {isSponsor
                              ? over   ? `Exceeds sponsor prize by ${(total - poolUsdc).toFixed(2)} USDC`
                                : under ? `${(poolUsdc - total).toFixed(2)} USDC unallocated — must equal sponsor prize exactly`
                                : "✓ Matches sponsor prize pool"
                              : over   ? `Exceeds available balance by ${(total - poolUsdc).toFixed(2)} USDC`
                                : `${(poolUsdc - total).toFixed(2)} USDC available after committed raffles`}
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  <button
                    onClick={handleCreateRaffle}
                    disabled={(() => {
                      if (isCreatingRaffle) return true
                      if (parseInt(crWinnerCount) < 1) return true
                      const prizes = crPrizes.slice(0, parseInt(crWinnerCount) || 1)
                      if (prizes.some(p => !p || parseFloat(p) <= 0)) return true
                      const total = prizes.reduce((sum, p) => sum + (parseFloat(p) || 0), 0)
                      const sponsorApp = crSponsorAppId !== null ? activeSponsors.find(s => s.appId === crSponsorAppId) : undefined
                      if (sponsorApp) {
                        // Sponsor raffle: total must equal prizePaid exactly
                        return Math.abs(total - Number(sponsorApp.prizePaid) / 1e6) > 0.001
                      }
                      // Owner USDC raffle: total must not exceed available (uncommitted) balance
                      if (crToken === "usdc") return total > Number(availableUsdcBn) / 1e6
                      return false
                    })()}
                    className="w-full bg-amber-500 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {isCreatingRaffle ? "Creating..." : "Create Raffle"}
                  </button>
                </div>

                {/* ── Withdraw ── */}
                <div className="space-y-2 pt-4 border-t border-amber-200">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Withdraw</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Pulls all USDC from the contract to your wallet. Only do this after all active raffles have been drawn — withdrawing early drains unclaimed prize funds.
                    </p>
                  </div>
                  <button
                    onClick={handleWithdraw}
                    disabled={isWithdrawing || !raffleUsdc || raffleUsdc === 0n}
                    className="w-full py-2.5 rounded-lg text-sm font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {isWithdrawing ? "Withdrawing..." : "Withdraw USDC"}
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── STREAK TAB ──────────────────────────────────────────────────── */}
        {tab === "streak" && (
          <div className="space-y-4">

            {/* Balances — USDC + BOOZ */}
            {address && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/usdc.svg" alt="USDC" width={42} height={42} className="flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide leading-none mb-0.5">$USDC</span>
                    <span className="text-2xl font-black text-blue-900 leading-tight">{usdcFormatted}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-4 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/booz.svg" alt="BOOZ" width={42} height={42} className="flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wide leading-none mb-0.5">$BOOZ</span>
                    <span className="text-2xl font-black text-red-900 leading-tight">{boozFormatted}</span>
                  </div>
                </div>
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
              <p className="text-gray-900 font-semibold text-sm mb-4">How to Earn $BOOZ</p>
              <div className="space-y-3">
                {[
                  { label: "Mint a slot (1 USDC)", reward: "+1,000" },
                  { label: "Daily GM – Days 1–7", reward: "+5 to +35" },
                  { label: "Daily GM – Days 8–90", reward: "+50" },
                ].map(({ label, reward }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">{label}</span>
                    <div className="flex items-center gap-1">
                      <HiBolt className="text-yellow-500" size={12} />
                      <span className="text-gray-900 text-sm font-semibold">{reward} $BOOZ</span>
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Milestone bonuses (one-time)</p>
                  {[
                    { label: "⚔️ Warrior (day 7)",  reward: "+50" },
                    { label: "🛡️ Elite (day 14)",   reward: "+250" },
                    { label: "👑 Epic (day 30)",     reward: "+350" },
                    { label: "🔥 Legend (day 60)",   reward: "+500" },
                    { label: "🔱 Mythic (day 90)",   reward: "+4,560" },
                  ].map(({ label, reward }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-gray-500 text-sm">{label}</span>
                      <div className="flex items-center gap-1">
                        <HiBolt className="text-yellow-500" size={12} />
                        <span className="text-gray-900 text-sm font-semibold">{reward} $BOOZ</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-emerald-600 font-medium pt-1">= 10,000 $BOOZ total over 90 days</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

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
