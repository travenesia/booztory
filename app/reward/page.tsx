"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig } from "@/lib/wagmi"
import { formatUnits } from "viem"
import { HiBolt, HiTrophy, HiArrowTopRightOnSquare } from "react-icons/hi2"
import { useWalletName } from "@/hooks/useWalletName"
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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { GMContent } from "@/components/modals/gmModal"
import { Badge } from "@/components/ui/badge"
import { BadgeCheck, Ticket } from "lucide-react"

const EXPLORER = APP_CHAIN.blockExplorers?.default.url ?? "https://basescan.org"

function WinnerRow({ rank, address, ticketCount, prize, isYou, drawTxHash }: {
  rank: number
  address: string
  ticketCount: number
  prize: bigint
  isYou: boolean
  drawTxHash?: string | null
}) {
  const name = useWalletName(address)
  const prizeUSDC = Number(prize) / 1_000_000
  const linkHref = drawTxHash
    ? `${EXPLORER}/tx/${drawTxHash}`
    : `${EXPLORER}/address/${address}`
  return (
    <div className={cn(
      "grid grid-cols-[56px_1fr_auto] items-center gap-3 py-3 border-b border-gray-100 last:border-0",
      isYou && "bg-green-50 -mx-5 px-5 rounded-lg"
    )}>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400 text-xs w-4 text-right">{rank}</span>
        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
          {ticketCount}×
        </span>
      </div>
      <span className={cn(
        "text-sm truncate",
        isYou ? "text-green-700 font-bold" : "text-gray-700 font-mono"
      )}>
        {name ?? `${address.slice(0, 6)}...${address.slice(-4)}`}
        {isYou ? " (you)" : ""}
      </span>
      <a
        href={linkHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 bg-blue-900 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-800 transition-colors whitespace-nowrap"
      >
        ${prizeUSDC} USDC
        <HiArrowTopRightOnSquare size={11} />
      </a>
    </div>
  )
}

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

const PRIZE_MEDALS = ["🥇", "🥈", "🥉"]
function buildPrizeTiers(prizes: bigint[]): string[] {
  const result: string[] = []
  let i = 0
  while (i < prizes.length) {
    const amount = prizes[i]
    let count = 1
    while (i + count < prizes.length && prizes[i + count] === amount) count++
    const usd = `$${Number(amount) / 1_000_000}`
    result.push(count > 1 ? `${count}× ${usd}` : `${PRIZE_MEDALS[i] ?? `${i + 1}.`} ${usd}`)
    i += count
  }
  return result
}

export default function RewardPage() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<"raffle" | "streak">("raffle")
  const [gmOpen, setGmOpen] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawTxHash, setDrawTxHash] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [thresholdInput, setThresholdInput] = useState("")
  const [minUniqueInput, setMinUniqueInput] = useState("")
  const [prizesInput, setPrizesInput] = useState("")
  const [isSettingThreshold, setIsSettingThreshold] = useState(false)
  const [isSettingMinUnique, setIsSettingMinUnique] = useState(false)
  const [isSettingPrizes, setIsSettingPrizes] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const { toast } = useToast()
  const [selectedDrawWeek, setSelectedDrawWeek] = useState<bigint | undefined>(undefined)
  const [browseWeek, setBrowseWeek] = useState<bigint | undefined>(undefined)
  const { writeContractAsync } = useWriteContract()

  // ── Raffle reads ─────────────────────────────────────────────────────────────
  const { data: currentRaffleRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "currentRaffle",
  })
  const raffle = currentRaffleRaw as bigint | undefined
  const lastRaffle = raffle !== undefined ? raffle - 1n : undefined

  const { data: epochStartRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "epochStart",
  })
  const epochStart = epochStartRaw as bigint | undefined

  const { data: contractRaffleDurationRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "raffleDuration",
  })
  const contractRaffleDuration = (contractRaffleDurationRaw as bigint | undefined) ?? 604800n

  const { data: entryCountRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffleEntryCount",
    args: raffle !== undefined ? [raffle] : undefined,
    query: { enabled: raffle !== undefined },
  })
  const { data: uniqueCountRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "raffleUniqueCount",
    args: raffle !== undefined ? [raffle] : undefined,
    query: { enabled: raffle !== undefined },
  })
  const { data: thresholdRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "drawThreshold",
  })
  const { data: minUniqueRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "minUniqueMinters",
  })
  const { data: prizesRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getPrizes",
  })
  const { data: userEnteredRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "hasMinted",
    args: raffle !== undefined && address ? [raffle, address] : undefined,
    query: { enabled: raffle !== undefined && !!address },
  })
  const { data: weeklyEntriesRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffleEntries",
    args: raffle !== undefined ? [raffle] : undefined,
    query: { enabled: raffle !== undefined && !!address },
  })
  // browseRaffle — raffle selected in the Prize Pool dropdown (defaults to current)
  const activeViewRaffle = browseWeek ?? raffle
  const { data: browseDrawnRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "raffleDrawn",
    args: activeViewRaffle !== undefined ? [activeViewRaffle] : undefined,
    query: { enabled: activeViewRaffle !== undefined },
  })
  const { data: browseWinnersRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffleWinners",
    args: activeViewRaffle !== undefined ? [activeViewRaffle] : undefined,
    query: { enabled: activeViewRaffle !== undefined },
  })
  const { data: browseEntriesRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffleEntries",
    args: activeViewRaffle !== undefined ? [activeViewRaffle] : undefined,
    query: { enabled: activeViewRaffle !== undefined },
  })
  const { data: browseEntryCountRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffleEntryCount",
    args: activeViewRaffle !== undefined ? [activeViewRaffle] : undefined,
    query: { enabled: activeViewRaffle !== undefined },
  })
  const { data: browseUniqueCountRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "raffleUniqueCount",
    args: activeViewRaffle !== undefined ? [activeViewRaffle] : undefined,
    query: { enabled: activeViewRaffle !== undefined },
  })

  // Historical prize snapshot for the selected past raffle
  const { data: browseWeeklyPrizesRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRafflePrizes",
    args: activeViewRaffle !== undefined ? [activeViewRaffle] : undefined,
    query: { enabled: activeViewRaffle !== undefined && activeViewRaffle !== raffle && browseDrawnRaw === true },
  })

  // Block number stored on-chain when VRF fulfilled — used for instant draw tx lookup
  const { data: raffleDrawBlockRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "raffleDrawBlock",
    args: activeViewRaffle !== undefined ? [activeViewRaffle] : undefined,
    query: { enabled: activeViewRaffle !== undefined && browseDrawnRaw === true },
  })
  const raffleDrawBlock = raffleDrawBlockRaw as bigint | undefined

  // ── Owner ─────────────────────────────────────────────────────────────────────
  const { data: raffleOwnerRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "owner",
  })
  const raffleOwner = raffleOwnerRaw as string | undefined
  const isOwner = !!(address && raffleOwner && address.toLowerCase() === raffleOwner.toLowerCase())

  // ── Raffle contract USDC balance ──────────────────────────────────────────────
  const { data: raffleUsdcRaw, refetch: refetchRaffleUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [RAFFLE_ADDRESS],
  })

  // ── Selected raffle draw status ───────────────────────────────────────────────
  const targetRaffle = selectedDrawWeek ?? lastRaffle
  const { data: selectedWeekDrawnRaw, refetch: refetchSelectedDrawn } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "raffleDrawn",
    args: targetRaffle !== undefined ? [targetRaffle] : undefined,
    query: { enabled: targetRaffle !== undefined },
  })
  const selectedWeekDrawn = selectedWeekDrawnRaw as boolean | undefined

  const { data: targetWeekWinnersRaw, refetch: refetchTargetWinners } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffleWinners",
    args: targetRaffle !== undefined ? [targetRaffle] : undefined,
    query: { enabled: targetRaffle !== undefined },
  })
  const targetWeekWinners = (targetWeekWinnersRaw as string[] | undefined) ?? []
  const isStuckDraw = selectedWeekDrawn === true && targetWeekWinners.length === 0

  const { data: targetEntryCountRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "getRaffleEntryCount",
    args: targetRaffle !== undefined ? [targetRaffle] : undefined,
    query: { enabled: targetRaffle !== undefined },
  })
  const { data: targetUniqueCountRaw } = useReadContract({
    address: RAFFLE_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: "raffleUniqueCount",
    args: targetRaffle !== undefined ? [targetRaffle] : undefined,
    query: { enabled: targetRaffle !== undefined },
  })
  const targetEntryCount = Number(targetEntryCountRaw ?? 0n)
  const targetUniqueCount = Number(targetUniqueCountRaw ?? 0n)

  // ── Streak / balance reads ────────────────────────────────────────────────────
  const { data: boozBalanceRaw } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const { data: streakRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "gmStreaks",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // ── Computed — raffle ─────────────────────────────────────────────────────────
  const prizesArr = prizesRaw as bigint[] | undefined
  const totalPrize = prizesArr ? prizesArr.reduce((a, b) => a + b, 0n) : 0n
  const winnerCount = prizesArr?.length ?? 0
  const totalPrizeUSDC = Number(totalPrize) / 1_000_000
  const prizeTiers = prizesArr && winnerCount > 0 ? buildPrizeTiers(prizesArr) : []

  const entries = Number(entryCountRaw ?? 0n)
  const uniqueCount = Number(uniqueCountRaw ?? 0n)
  const threshold = Number(thresholdRaw ?? 100n)
  const minUnique = Number(minUniqueRaw ?? 10n)
  const userEntered = userEnteredRaw as boolean | undefined

  const targetEntriesOk = targetEntryCount >= threshold
  const targetUniqueOk = targetUniqueCount >= minUnique && targetUniqueCount >= winnerCount
  const targetDrawEligible = targetEntriesOk && targetUniqueOk

  const allEntries = (weeklyEntriesRaw as string[] | undefined) ?? []
  const userEntryCount = address
    ? allEntries.filter(e => e.toLowerCase() === address.toLowerCase()).length
    : 0

  const entriesOk = entries >= threshold
  const uniqueOk = uniqueCount >= minUnique && uniqueCount >= winnerCount
  const drawEligible = entriesOk && uniqueOk
  const progressPct = Math.min((entries / threshold) * 100, 100)

  // ── Raffle countdown ──────────────────────────────────────────────────────────
  const [weekCountdown, setWeekCountdown] = useState("")
  useEffect(() => {
    const periodSeconds = Number(contractRaffleDuration)
    const epoch = Number(epochStart ?? 0n)
    const update = () => {
      const now = Math.floor(Date.now() / 1000)
      const currentR = Math.floor((now - epoch) / periodSeconds)
      const raffleEnd = epoch + (currentR + 1) * periodSeconds
      const diff = raffleEnd - now
      if (diff <= 0) { setWeekCountdown("Ending..."); return }
      const d = Math.floor(diff / 86400)
      const h = Math.floor((diff % 86400) / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setWeekCountdown(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [contractRaffleDuration, epochStart])

  const browseDrawn = browseDrawnRaw as boolean | undefined
  const browseWinners = ((browseWinnersRaw as string[] | undefined) ?? []).slice(0, 10)
  const browseEntries = (browseEntriesRaw as string[] | undefined) ?? []
  const browseEntryCount = Number(browseEntryCountRaw ?? 0n)
  const browseUniqueCount = Number(browseUniqueCountRaw ?? 0n)
  const isCurrentWeek = activeViewRaffle === raffle

  // Historical prizes: use snapshot for past drawn weeks; fall back to current config
  const browseWeeklyPrizes = browseWeeklyPrizesRaw as bigint[] | undefined
  const displayPrizesArr = isCurrentWeek
    ? prizesArr
    : (browseWeeklyPrizes && browseWeeklyPrizes.length > 0 ? browseWeeklyPrizes : prizesArr)
  const displayTotalPrize = displayPrizesArr ? displayPrizesArr.reduce((a, b) => a + b, 0n) : 0n
  const displayTotalPrizeUSDC = Number(displayTotalPrize) / 1_000_000
  const displayWinnerCount = displayPrizesArr?.length ?? 0
  function ticketsFor(addr: string) {
    return browseEntries.filter(e => e.toLowerCase() === addr.toLowerCase()).length || 1
  }

  // Fetch DrawCompleted tx hash using on-chain raffleDrawBlock for instant lookup
  useEffect(() => {
    setDrawTxHash(null)
    if (isCurrentWeek || !browseDrawn || browseWinners.length === 0 || !publicClient || activeViewRaffle === undefined) return
    if (!raffleDrawBlock || raffleDrawBlock === 0n) return
    let cancelled = false
    const EVENT_DEF = {
      type: "event",
      name: "DrawCompleted",
      inputs: [
        { type: "uint256", name: "raffle", indexed: true },
        { type: "address[]", name: "winners", indexed: false },
      ],
    } as const
    // Query the exact block where VRF fulfilled — single call, no scanning needed
    publicClient.getLogs({
      address: RAFFLE_ADDRESS,
      event: EVENT_DEF,
      args: { raffle: activeViewRaffle },
      fromBlock: raffleDrawBlock,
      toBlock: raffleDrawBlock,
    }).then(logs => {
      if (!cancelled && logs.length > 0) setDrawTxHash(logs[0].transactionHash)
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentWeek, browseDrawn, browseWinners.length, activeViewRaffle, raffleDrawBlock])

  const raffleUsdc = raffleUsdcRaw as bigint | undefined
  const raffleUsdcNum = raffleUsdc !== undefined ? Number(raffleUsdc) / 1_000_000 : undefined
  const isFunded = raffleUsdc !== undefined && totalPrize > 0n && raffleUsdc >= totalPrize

  // All raffles for the browse dropdown — capped at 52 to prevent freeze
  // when raffleDuration is short (e.g. 600s on testnet, giving many raffle numbers)
  const allWeeks: { raw: bigint; display: bigint }[] = []
  if (raffle !== undefined) {
    const startRaffle = raffle > 52n ? raffle - 52n : 0n
    for (let r = startRaffle; r <= raffle; r++) {
      allWeeks.push({ raw: r, display: r })
    }
  }
  // Past raffles only — for owner draw panel
  const pastWeeks = allWeeks.filter(w => w.raw < (raffle ?? 0n))

  // ── Computed — streak ─────────────────────────────────────────────────────────
  const boozNum = boozBalanceRaw
    ? Number(formatUnits(boozBalanceRaw as bigint, 18))
    : 0
  const boozFormatted = boozNum.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const usdcNum = usdcBalanceRaw ? Number(usdcBalanceRaw as bigint) / 1_000_000 : 0
  const usdcFormatted = usdcNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

  async function handleDraw() {
    if (targetRaffle === undefined || !isOwner) return
    setIsDrawing(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "requestRaffleDraw",
        args: [targetRaffle],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchSelectedDrawn()
      refetchRaffleUsdc()
      toast({
        title: "Draw Triggered!",
        description: (
          <span>
            Raffle #{targetRaffle.toString()} draw submitted.{" "}
            <a href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noopener noreferrer" className="underline">
              View transaction
            </a>
          </span>
        ),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed"
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      const clean = msg.includes("AlreadyDrawn") ? "This raffle was already drawn."
        : msg.includes("BelowThreshold") ? "Not enough entries this raffle to draw."
        : msg.includes("NotEnoughUniqueMinters") ? "Not enough unique wallets this raffle."
        : msg.includes("InsufficientPrizeFunds") ? "Raffle contract doesn't have enough USDC. Fund it first."
        : msg.includes("RaffleNotEnded") ? "This raffle period hasn't ended yet."
        : "Transaction failed. Try again."
      toast({ title: "Draw Failed", description: clean, variant: "destructive" })
    } finally {
      setIsDrawing(false)
    }
  }

  async function handleResetDraw() {
    if (targetRaffle === undefined || !isOwner) return
    setIsResetting(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS,
        abi: RAFFLE_ABI,
        functionName: "resetDraw",
        args: [targetRaffle],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchSelectedDrawn()
      refetchTargetWinners()
      toast({
        title: "Draw Reset",
        description: `Raffle #${targetRaffle} is now ready to re-trigger.`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed"
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Reset Failed", description: "Transaction failed. Try again.", variant: "destructive" })
    } finally {
      setIsResetting(false)
    }
  }

  async function handleSetThreshold() {
    const val = parseInt(thresholdInput)
    if (!val || val < 1 || !isOwner) return
    setIsSettingThreshold(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "setDrawThreshold", args: [BigInt(val)],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setThresholdInput("")
      toast({ title: "Threshold Updated", description: `Draw threshold set to ${val} entries.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed"
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed. Try again.", variant: "destructive" })
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
        address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "setMinUniqueMinters", args: [BigInt(val)],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setMinUniqueInput("")
      toast({ title: "Min Unique Updated", description: `Min unique minters set to ${val}.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed"
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed. Try again.", variant: "destructive" })
    } finally {
      setIsSettingMinUnique(false)
    }
  }

  async function handleSetPrizes() {
    if (!isOwner || !prizesInput.trim()) return
    const parsed = prizesInput.split(",").map(s => s.trim()).filter(Boolean)
    const amounts = parsed.map(s => {
      const n = parseFloat(s)
      return isNaN(n) || n <= 0 ? null : BigInt(Math.round(n * 1_000_000))
    })
    if (amounts.some(a => a === null)) {
      toast({ title: "Invalid Input", description: "Enter comma-separated USDC amounts (e.g. 25,20,15,10,5,5).", variant: "destructive" })
      return
    }
    setIsSettingPrizes(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "setPrizes", args: [amounts as bigint[]],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setPrizesInput("")
      const total = (amounts as bigint[]).reduce((a, b) => a + b, 0n)
      toast({ title: "Prizes Updated", description: `${amounts.length} winners · $${Number(total) / 1_000_000} USDC total.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed"
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      const clean = msg.includes("MinUniqueMintersTooLow")
        ? `minUniqueMinters (${minUnique}) must be ≥ winner count (${parsed.length}). Raise it first.`
        : msg.includes("NoPrizes") ? "Prize array cannot be empty."
        : "Transaction failed. Try again."
      toast({ title: "Failed", description: clean, variant: "destructive" })
    } finally {
      setIsSettingPrizes(false)
    }
  }

  async function handleWithdraw() {
    if (!isOwner) return
    setIsWithdrawing(true)
    try {
      const tx = await writeContractAsync({
        address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "withdraw", args: [],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffleUsdc()
      toast({ title: "Withdrawn", description: "USDC withdrawn to owner wallet." })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed"
      if (msg.includes("user rejected") || msg.includes("User rejected")) return
      toast({ title: "Failed", description: "Transaction failed. Try again.", variant: "destructive" })
    } finally {
      setIsWithdrawing(false)
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
              tab === "raffle"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Raffle
          </button>
          <button
            onClick={() => setTab("streak")}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
              tab === "streak"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Daily Streak
            {address && !claimedToday && (
              <span className="w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
        </div>

        {/* ── RAFFLE TAB ─────────────────────────────────────────────────────────── */}
        {tab === "raffle" && (
          <div className="space-y-4">

            {/* Prize Pool — hero card */}
            <div className="rounded-2xl overflow-hidden border border-blue-300 shadow-md" style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)" }}>
              <div className="p-5 text-white">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <HiTrophy className="text-yellow-300" size={18} />
                    <span className="font-bold text-white tracking-wide">Prize Pool</span>
                  </div>
                  <Select
                    value={activeViewRaffle?.toString() ?? ""}
                    onValueChange={v => setBrowseWeek(BigInt(v))}
                  >
                    <SelectTrigger className="w-36 text-xs font-semibold bg-white/20 text-white border border-white/30 rounded-full px-3 py-1.5 h-8 focus:ring-0 focus:ring-offset-0 backdrop-blur-sm [&>svg]:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border border-white/10 text-white rounded-xl shadow-xl">
                      <SelectGroup>
                        <SelectLabel className="text-white/40 text-xs pl-3">Raffle</SelectLabel>
                        {allWeeks.map(({ raw, display }) => (
                          <SelectItem
                            key={raw.toString()}
                            value={raw.toString()}
                            className="text-white text-sm focus:bg-white/10 focus:text-white pl-3 [&>span:first-child]:hidden"
                          >
                            Raffle #{display.toString()}{raw === raffle ? " (current)" : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Prize amount — centered */}
                <div className="flex flex-col items-center text-center py-6 mb-4">
                  <span className="text-5xl font-black tracking-tight mb-3">
                    {displayTotalPrizeUSDC > 0 ? `$${displayTotalPrizeUSDC}` : "—"}
                  </span>
                  {isCurrentWeek && weekCountdown && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70 bg-white/10 border border-white/15 rounded-full px-3 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Ends in {weekCountdown}
                    </span>
                  )}
                </div>

                {/* Prize breakdown table */}
                {displayPrizesArr && displayPrizesArr.length > 0 && (
                  <div className="bg-white/10 rounded-xl overflow-hidden">
                    {/* Table header */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                      <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Position</span>
                      <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Prize</span>
                    </div>
                    {/* Rows grouped by amount */}
                    {(() => {
                      const rows: { label: string; amount: bigint }[] = []
                      let i = 0
                      while (i < displayPrizesArr.length) {
                        const amount = displayPrizesArr[i]
                        let count = 1
                        while (i + count < displayPrizesArr.length && displayPrizesArr[i + count] === amount) count++
                        const start = i + 1
                        const end = i + count
                        rows.push({ label: count > 1 ? `${start}–${end}` : `${start}`, amount })
                        i += count
                      }
                      return rows.map((row, idx) => (
                        <div key={idx} className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0">
                          <span className="text-sm text-white/80">{row.label}</span>
                          <span className="text-sm font-bold text-white">${Number(row.amount) / 1_000_000} USDC</span>
                        </div>
                      ))
                    })()}
                    {/* Footer — total */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10 bg-white/5">
                      <span className="text-xs text-white/50">{displayWinnerCount} winner{displayWinnerCount !== 1 ? "s" : ""}</span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70"><span>Total</span><span>${displayTotalPrizeUSDC} USDC</span></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Entry Progress — current week only */}
            {isCurrentWeek && (
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <span className="font-bold text-gray-900 text-base">Weekly Entries</span>
                  {drawEligible ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                      Draw Eligible <BadgeCheck size={14} />
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                      Threshold not met
                    </span>
                  )}
                </div>

                {/* Entry count */}
                <div className="px-5 flex items-end justify-between mb-3">
                  <span className="text-4xl font-black text-gray-900 leading-none">
                    {entries.toLocaleString()}
                  </span>
                  <span className="text-gray-400 text-sm pb-1">
                    / {threshold.toLocaleString()} needed
                  </span>
                </div>

                {/* Progress bar */}
                <div className="px-5 mb-4">
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={cn(
                        "h-3 rounded-full transition-all duration-700",
                        entriesOk
                          ? "bg-gradient-to-r from-green-400 to-emerald-500"
                          : "bg-gradient-to-r from-blue-400 to-blue-600"
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Unique wallets row */}
                <div className="px-5 flex items-center justify-between mb-4">
                  <span className={cn(
                    "text-sm font-semibold",
                    uniqueOk ? "text-green-600" : "text-gray-500"
                  )}>
                    {uniqueCount} unique wallet{uniqueCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-gray-400 text-xs">
                    min {minUnique} unique required
                  </span>
                </div>

                {/* Your entry status */}
                <div className="border-t border-gray-100">
                  {address ? (
                    <div className={cn(
                      "flex items-center justify-between px-5 py-3.5 text-sm",
                      userEntered ? "text-green-700" : "text-gray-500"
                    )}>
                      <div className="flex items-center gap-2">
                        {userEntered ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 gap-1 h-8 px-3">
                            <BadgeCheck data-icon="inline-start" className="w-3.5 h-3.5" />
                            You&apos;re in this week
                          </Badge>
                        ) : (
                          <span>No entry yet — mint a slot to enter</span>
                        )}
                      </div>
                      {userEntryCount > 0 && (
                        <span className="text-blue-700 font-bold text-xs bg-blue-50 border border-blue-200 px-3 rounded-full h-8 flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5" />
                          {userEntryCount}× entries
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm px-5 py-3.5">
                      Connect wallet to see your entry status
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Past week history — shown when not viewing current week */}
            {!isCurrentWeek && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 p-4 bg-blue-50 border-b border-blue-100">
                  <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <HiTrophy className="text-yellow-300" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Raffle #{activeViewRaffle?.toString()} Results</p>
                    <p className="text-xs text-gray-500">
                      {browseEntryCount} entries · {browseUniqueCount} unique minter{browseUniqueCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    {browseDrawn ? (
                      <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Drawn ✓</span>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">Not drawn</span>
                    )}
                  </div>
                </div>

                {/* Threshold status — for undrawn weeks show current thresholds;
                    for drawn weeks just confirm requirements were met */}
                <div className="px-5 pt-4 pb-2 space-y-2">
                  {browseDrawn ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Requirements at draw time</span>
                      <span className="font-semibold text-green-600">
                        {browseEntryCount} entries · {browseUniqueCount} unique ✓
                      </span>
                    </div>
                  ) : (<>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Entries vs threshold</span>
                    <span className={cn(
                      "font-semibold",
                      browseEntryCount >= threshold ? "text-green-600" : "text-red-500"
                    )}>
                      {browseEntryCount} / {threshold} {browseEntryCount >= threshold ? "✓" : "✗"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Unique minters vs minimum</span>
                    <span className={cn(
                      "font-semibold",
                      browseUniqueCount >= minUnique ? "text-green-600" : "text-red-500"
                    )}>
                      {browseUniqueCount} / {minUnique} {browseUniqueCount >= minUnique ? "✓" : "✗"}
                    </span>
                  </div>
                  </>)}
                </div>

                {/* Winners or status */}
                {browseDrawn && browseWinners.length > 0 ? (
                  <>
                    <div className="grid grid-cols-[56px_1fr_auto] gap-3 px-5 pt-3 pb-1 border-t border-gray-100">
                      <span className="text-xs font-semibold text-gray-400">Ticket</span>
                      <span className="text-xs font-semibold text-gray-400">Minter</span>
                      <span className="text-xs font-semibold text-gray-400">Prize</span>
                    </div>
                    <div className="px-5 pb-2">
                      {browseWinners.map((addr, i) => (
                        <WinnerRow
                          key={addr}
                          rank={i + 1}
                          address={addr}
                          ticketCount={ticketsFor(addr)}
                          prize={displayPrizesArr?.[i] ?? 0n}
                          isYou={!!(address && addr.toLowerCase() === address.toLowerCase())}
                          drawTxHash={drawTxHash}
                        />
                      ))}
                    </div>
                  </>
                ) : browseDrawn && browseWinners.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6 border-t border-gray-100">No winners this week</p>
                ) : (
                  <p className="text-center text-gray-400 text-sm py-6 border-t border-gray-100">Draw not triggered yet</p>
                )}
              </div>
            )}

            {/* Owner draw panel */}
            {isOwner && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Owner — Trigger Draw</p>

                {/* USDC fund status */}
                <div className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium border",
                  isFunded
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-red-50 border-red-200 text-red-600"
                )}>
                  <span>{isFunded ? "✓ Raffle contract funded" : "✗ Insufficient USDC in contract"}</span>
                  <span>
                    {raffleUsdcNum !== undefined ? `$${raffleUsdcNum.toFixed(2)}` : "—"}
                    {totalPrizeUSDC > 0 && ` / $${totalPrizeUSDC} needed`}
                  </span>
                </div>

                {/* Raffle selector */}
                <div className="space-y-1">
                  <p className="text-xs text-amber-600">Select raffle to draw</p>
                  <select
                    value={targetRaffle?.toString() ?? ""}
                    onChange={e => setSelectedDrawWeek(BigInt(e.target.value))}
                    className="w-full rounded-lg border border-amber-200 bg-white text-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {pastWeeks.length === 0 && (
                      <option disabled>No past raffles yet</option>
                    )}
                    {pastWeeks.map(({ raw, display }) => (
                      <option key={raw.toString()} value={raw.toString()}>
                        Raffle #{display.toString()}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleDraw}
                  disabled={isDrawing || (selectedWeekDrawn === true && !isStuckDraw) || !isFunded || !targetDrawEligible || pastWeeks.length === 0}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-bold transition-all",
                    selectedWeekDrawn && !isStuckDraw
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : !isFunded
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : !targetDrawEligible
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : isDrawing
                      ? "bg-amber-200 text-amber-600 cursor-wait"
                      : "bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]"
                  )}
                >
                  {isDrawing ? "Requesting VRF..."
                    : selectedWeekDrawn && !isStuckDraw ? "Already Drawn"
                    : !isFunded ? "Fund Contract First"
                    : !targetEntriesOk ? `Not Enough Entries (${targetEntryCount}/${threshold})`
                    : !targetUniqueOk ? `Not Enough Unique Wallets (${targetUniqueCount}/${minUnique})`
                    : "Request Raffle Draw"}
                </button>

                {/* Stuck VRF warning + reset */}
                {isStuckDraw && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
                      <span className="mt-0.5">⚠️</span>
                      <span>
                        Draw was triggered but Chainlink VRF hasn't responded yet.
                        If it's been 30+ minutes, reset and re-trigger.
                      </span>
                    </div>
                    <button
                      onClick={handleResetDraw}
                      disabled={isResetting}
                      className={cn(
                        "w-full py-2.5 rounded-xl text-sm font-bold transition-all border border-yellow-400",
                        isResetting
                          ? "bg-yellow-100 text-yellow-400 cursor-wait"
                          : "bg-yellow-50 text-yellow-800 hover:bg-yellow-100 active:scale-[0.98]"
                      )}
                    >
                      {isResetting ? "Resetting..." : "Reset Stuck Draw"}
                    </button>
                  </div>
                )}

                {/* Configure toggle */}
                <div className="border-t border-amber-200 pt-3">
                  <button
                    onClick={() => setConfigOpen(o => !o)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                  >
                    <span>Configure Raffle Settings</span>
                    <span className="text-amber-500">{configOpen ? "▲" : "▼"}</span>
                  </button>
                </div>

                {configOpen && (
                  <div className="space-y-4 pt-1">

                    {/* Draw Threshold */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-700">Draw Threshold (entries)</p>
                        <span className="text-xs text-amber-500">current: {threshold}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          value={thresholdInput}
                          onChange={e => setThresholdInput(e.target.value)}
                          placeholder={threshold.toString()}
                          className="flex-1 rounded-lg border border-amber-200 bg-white text-sm px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button
                          onClick={handleSetThreshold}
                          disabled={isSettingThreshold || !thresholdInput}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                            isSettingThreshold || !thresholdInput
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]"
                          )}
                        >
                          {isSettingThreshold ? "..." : "Set"}
                        </button>
                      </div>
                    </div>

                    {/* Min Unique Minters */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-700">Min Unique Minters</p>
                        <span className="text-xs text-amber-500">current: {minUnique} · must be ≥ winner count</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          value={minUniqueInput}
                          onChange={e => setMinUniqueInput(e.target.value)}
                          placeholder={minUnique.toString()}
                          className="flex-1 rounded-lg border border-amber-200 bg-white text-sm px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button
                          onClick={handleSetMinUnique}
                          disabled={isSettingMinUnique || !minUniqueInput}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                            isSettingMinUnique || !minUniqueInput
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]"
                          )}
                        >
                          {isSettingMinUnique ? "..." : "Set"}
                        </button>
                      </div>
                    </div>

                    {/* Prize Tiers */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-700">Prize Tiers (USDC, comma-separated)</p>
                        <span className="text-xs text-amber-500">current: {winnerCount} winners</span>
                      </div>
                      {prizeTiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 pb-1">
                          {prizeTiers.map((t, i) => (
                            <span key={i} className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      )}
                      <input
                        type="text"
                        value={prizesInput}
                        onChange={e => setPrizesInput(e.target.value)}
                        placeholder="e.g. 25,20,15,10,5,5,5,5,5,5"
                        className="w-full rounded-lg border border-amber-200 bg-white text-sm px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      {prizesInput && (() => {
                        const parts = prizesInput.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0)
                        if (parts.length === 0) return null
                        const total = parts.reduce((a, b) => a + b, 0)
                        return (
                          <p className="text-xs text-amber-600">
                            → {parts.length} winners · ${total.toFixed(2)} USDC total
                            {parts.length > minUnique && (
                              <span className="text-red-500 ml-1">⚠ raise min unique first ({minUnique} &lt; {parts.length})</span>
                            )}
                          </p>
                        )
                      })()}
                      <button
                        onClick={handleSetPrizes}
                        disabled={isSettingPrizes || !prizesInput.trim()}
                        className={cn(
                          "w-full py-2.5 rounded-lg text-sm font-bold transition-all",
                          isSettingPrizes || !prizesInput.trim()
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]"
                        )}
                      >
                        {isSettingPrizes ? "Setting Prizes..." : "Set Prizes"}
                      </button>
                    </div>

                    {/* Withdraw USDC */}
                    <div className="space-y-1.5 border-t border-amber-200 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-700">Withdraw USDC from Contract</p>
                        <span className="text-xs text-amber-500">
                          {raffleUsdcNum !== undefined ? `$${raffleUsdcNum.toFixed(2)} available` : "—"}
                        </span>
                      </div>
                      <button
                        onClick={handleWithdraw}
                        disabled={isWithdrawing || !raffleUsdc || raffleUsdc === 0n}
                        className={cn(
                          "w-full py-2.5 rounded-lg text-sm font-bold transition-all",
                          isWithdrawing || !raffleUsdc || raffleUsdc === 0n
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]"
                        )}
                      >
                        {isWithdrawing ? "Withdrawing..." : "Withdraw All USDC"}
                      </button>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* Info */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-gray-500 text-sm leading-relaxed">
                Each paid slot mint earns 1 raffle entry. Mint more slots to increase your
                chances. The draw runs weekly after the period ends — requires ≥ {threshold} entries
                and ≥ {minUnique} unique wallets. Free slots (token burn) do not count as entries.
              </p>
            </div>
          </div>
        )}

        {/* ── STREAK TAB ─────────────────────────────────────────────────────────── */}
        {tab === "streak" && (
          <div className="space-y-4">

            {/* Balances — USDC + BOOZ */}
            {address && (
              <div className="grid grid-cols-2 gap-3">
                {/* USDC */}
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 flex items-center gap-3">
                  <img src="/usdc.svg" alt="USDC" width={36} height={36} className="flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-3xl font-black text-blue-900 leading-tight">{usdcFormatted}</span>
                    <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">USDC</span>
                  </div>
                </div>
                {/* BOOZ */}
                <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-4 flex items-center gap-3">
                  <HiBolt size={36} className="text-red-400 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-3xl font-black text-red-900 leading-tight">{boozFormatted}</span>
                    <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">BOOZ</span>
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

      {/* GM Modal / Sheet */}
      {isMobile ? (
        <Sheet open={gmOpen} onOpenChange={setGmOpen}>
          <SheetContent
            side="bottom"
            className="p-0 rounded-tl-2xl rounded-tr-2xl border-gray-200 overflow-hidden"
            style={{ background: "linear-gradient(160deg, #f0f4ff 0%, #e8f0fe 40%, #f5f7ff 100%)" }}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Daily GM</SheetTitle>
            </SheetHeader>
            <GMContent onClose={() => setGmOpen(false)} />
            <div className="h-6" style={{ background: "#0d0d0d" }} />
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
