"use client"

import { useState } from "react"
import { useReadContract, useReadContracts, useWriteContract } from "wagmi"
import { waitForTransactionReceipt, sendTransaction } from "wagmi/actions"
import { wagmiConfig, WORLD_CHAIN } from "@/lib/wagmi"
import { keccak256, encodeAbiParameters, parseAbiParameters, toHex, isAddress, parseUnits } from "viem"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { WORLD_RAFFLE_ADDRESS, WORLD_RAFFLE_ABI, WORLD_USDC_ADDRESS, WORLD_TOKEN_ADDRESS, WORLD_WLD_ADDRESS } from "@/lib/contractWorld"
import { ERC20_ABI } from "@/lib/contract"
import { Loader2, ShieldCheck, AlertTriangle, Clock, CheckCircle2 } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

type RaffleStatus = 0 | 1 | 2 | 3  // Active | Drawn | Cancelled | Expired

interface RaffleInfo {
  raffleId: number
  prizeTokens: readonly `0x${string}`[]
  winnerCount: bigint
  startTime: bigint
  endTime: bigint
  status: number
  drawThreshold: bigint
  minUniqueEntrants: bigint
  commitment: `0x${string}`
  commitBlock: bigint
  totalTickets: bigint
  uniqueEntrants: bigint
}

const STATUS_MAP: Record<number, { label: string; color: string; icon: React.ReactNode }> = {
  0: { label: "Active",    color: "text-green-700 bg-green-50 border-green-200",   icon: <ShieldCheck size={12} /> },
  1: { label: "Drawn",     color: "text-blue-700 bg-blue-50 border-blue-200",      icon: <CheckCircle2 size={12} /> },
  2: { label: "Cancelled", color: "text-red-700 bg-red-50 border-red-200",         icon: <AlertTriangle size={12} /> },
  3: { label: "Expired",   color: "text-gray-600 bg-gray-50 border-gray-200",      icon: <Clock size={12} /> },
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Raffle Card ────────────────────────────────────────────────────────────────

function RaffleCard({ raffle }: { raffle: RaffleInfo }) {
  const [secretInput, setSecretInput]   = useState("")
  const [isCommitting, setIsCommitting] = useState(false)
  const [isRevealing, setIsRevealing]   = useState(false)
  const [isResetting, setIsResetting]   = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const { data: isRevealableRaw, refetch: refetchRevealable } = useReadContract({
    address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
    functionName: "isRevealable", args: [BigInt(raffle.raffleId)],
    chainId: WORLD_CHAIN.id, query: { refetchInterval: 5_000 },
  })
  const { data: blocksLeftRaw } = useReadContract({
    address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
    functionName: "blocksUntilExpiry", args: [BigInt(raffle.raffleId)],
    chainId: WORLD_CHAIN.id, query: { refetchInterval: 5_000 },
  })

  const isRevealable = !!isRevealableRaw
  const blocksLeft   = Number(blocksLeftRaw ?? 0n)
  const hasCommit    = raffle.commitBlock > 0n
  const isActive     = raffle.status === 0
  const now          = Math.floor(Date.now() / 1000)
  const isEnded      = Number(raffle.endTime) < now

  const statusInfo = STATUS_MAP[raffle.status] ?? STATUS_MAP[0]

  async function tx(id: string, fn: () => Promise<`0x${string}`>) {
    try {
      const hash = await fn()
      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: WORLD_CHAIN.id })
      toast({ title: "Done", description: `${id} confirmed.` })
      refetchRevealable()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected"))
        toast({ title: "Failed", description: msg || "Transaction failed.", variant: "destructive" })
    }
  }

  async function handleCommit() {
    if (!secretInput.trim()) return
    setIsCommitting(true)
    try {
      // commitment = keccak256(abi.encode(secret, raffleId))
      const secretBytes = toHex(secretInput.trim(), { size: 32 }) as `0x${string}`
      const commitment  = keccak256(encodeAbiParameters(
        parseAbiParameters("bytes32 secret, uint256 raffleId"),
        [secretBytes, BigInt(raffle.raffleId)]
      ))
      await tx("Commit Draw", () => writeContractAsync({
        address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
        functionName: "commitDraw",
        args: [BigInt(raffle.raffleId), commitment],
        chainId: WORLD_CHAIN.id,
      }))
    } finally { setIsCommitting(false) }
  }

  async function handleReveal() {
    if (!secretInput.trim()) return
    setIsRevealing(true)
    try {
      const secretBytes = toHex(secretInput.trim(), { size: 32 }) as `0x${string}`
      await tx("Reveal Draw", () => writeContractAsync({
        address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
        functionName: "revealDraw",
        args: [BigInt(raffle.raffleId), secretBytes],
        chainId: WORLD_CHAIN.id,
      }))
    } finally { setIsRevealing(false) }
  }

  async function handleReset() {
    setIsResetting(true)
    try {
      await tx("Reset Draw", () => writeContractAsync({
        address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
        functionName: "resetDraw",
        args: [BigInt(raffle.raffleId)],
        chainId: WORLD_CHAIN.id,
      }))
    } finally { setIsResetting(false) }
  }

  async function handleCancel() {
    setIsCancelling(true)
    try {
      await tx("Cancel Raffle", () => writeContractAsync({
        address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
        functionName: "cancelRaffle",
        args: [BigInt(raffle.raffleId)],
        chainId: WORLD_CHAIN.id,
      }))
    } finally { setIsCancelling(false) }
  }

  const L = "text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1"

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400">Raffle #{raffle.raffleId}</span>
          <span className={cn("flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border", statusInfo.color)}>
            {statusInfo.icon}{statusInfo.label}
          </span>
          {hasCommit && isActive && (
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border",
              isRevealable
                ? "text-blue-700 bg-blue-50 border-blue-200"
                : "text-orange-700 bg-orange-50 border-orange-200"
            )}>
              {isRevealable ? `Committed · ${blocksLeft}blk left` : "Commit Expired"}
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-500">{Number(raffle.totalTickets).toLocaleString()} tickets</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{raffle.uniqueEntrants.toString()} entrants</p>
        </div>
      </div>

      <div className="border-t border-gray-100 mx-4" />

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <p className={L}>End Time</p>
          <p className="text-xs text-gray-700">{new Date(Number(raffle.endTime) * 1000).toLocaleString()}</p>
        </div>
        <div>
          <p className={L}>Winners</p>
          <p className="text-xs text-gray-700">{raffle.winnerCount.toString()}</p>
        </div>
        <div>
          <p className={L}>Draw Threshold</p>
          <p className="text-xs text-gray-700">{raffle.drawThreshold.toString()} tickets</p>
        </div>
        <div>
          <p className={L}>Min Unique</p>
          <p className="text-xs text-gray-700">{raffle.minUniqueEntrants.toString()} entrants</p>
        </div>
      </div>

      {/* Draw controls — active raffles that have ended */}
      {isActive && isEnded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="border-t border-gray-100 pt-3">
            <p className={L}>Secret (UTF-8 → padded bytes32)</p>
            <input
              type="text"
              value={secretInput}
              onChange={e => setSecretInput(e.target.value)}
              placeholder="Enter your secret phrase"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Commitment = keccak256(abi.encode(secret_bytes32, raffleId)). Use the same secret for commit and reveal.
            </p>
          </div>

          <div className="flex gap-2">
            {!hasCommit && (
              <button
                onClick={handleCommit}
                disabled={isCommitting || !secretInput.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isCommitting ? <Loader2 size={12} className="animate-spin" /> : null}
                Commit Draw
              </button>
            )}
            {hasCommit && isRevealable && (
              <button
                onClick={handleReveal}
                disabled={isRevealing || !secretInput.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isRevealing ? <Loader2 size={12} className="animate-spin" /> : null}
                Reveal Draw
              </button>
            )}
            {hasCommit && !isRevealable && (
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {isResetting ? <Loader2 size={12} className="animate-spin" /> : null}
                Reset (Recommit)
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-3 flex items-center justify-center gap-1.5 bg-red-50 text-red-700 text-xs font-bold py-2.5 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
            >
              {isCancelling ? <Loader2 size={12} className="animate-spin" /> : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Cancel control for active raffles that haven't ended yet */}
      {isActive && !isEnded && (
        <div className="flex gap-px border-t border-gray-100">
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="flex-1 bg-red-50 text-red-700 text-xs font-bold py-2.5 hover:bg-red-100 disabled:opacity-50 transition-colors rounded-b-xl"
          >
            {isCancelling ? "Cancelling…" : "Cancel Raffle"}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { label: "7 days",  seconds: 7  * 86400 },
  { label: "14 days", seconds: 14 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
  { label: "Custom",  seconds: 0 },
]

function CreateRaffleSection({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const [token, setToken]             = useState<"usdc" | "wld" | "booz" | "eth" | "custom">("usdc")
  const [customAddr, setCustomAddr]   = useState("")
  const [customDec, setCustomDec]     = useState("18")
  const [winnerCount, setWinnerCount] = useState("3")
  const [prizes, setPrizes]           = useState<string[]>(["", "", ""])
  const [durationIdx, setDurationIdx] = useState(1)
  const [customHours, setCustomHours] = useState("1")
  const [isCreating, setIsCreating]   = useState(false)

  function handleWinnerChange(v: string) {
    setWinnerCount(v)
    const n = Math.max(1, Math.min(20, parseInt(v) || 1))
    setPrizes(prev => { const next = [...prev]; while (next.length < n) next.push(""); return next.slice(0, n) })
  }

  async function handleCreate() {
    const wc = Math.max(1, Math.min(20, parseInt(winnerCount) || 1))
    const p = prizes.slice(0, wc)
    if (p.some(x => !x || parseFloat(x) <= 0)) return
    if (token === "custom" && !isAddress(customAddr)) return

    const sel = DURATION_OPTIONS[durationIdx]
    const duration = sel.seconds === 0 ? Math.max(1, parseInt(customHours) || 1) * 3600 : sel.seconds
    const decimals = token === "usdc" ? 6 : token === "wld" ? 18 : token === "custom" ? (parseInt(customDec) || 18) : 18
    const prizeToken = token === "usdc"   ? WORLD_USDC_ADDRESS
                     : token === "wld"    ? WORLD_WLD_ADDRESS
                     : token === "booz"   ? WORLD_TOKEN_ADDRESS
                     : token === "eth"    ? "0x0000000000000000000000000000000000000000" as `0x${string}`
                     : customAddr as `0x${string}`
    const prizeBns    = p.map(x => parseUnits(x, decimals))
    const totalPrize  = prizeBns.reduce((a, b) => a + b, 0n)
    const prizeAmounts = [prizeBns]

    setIsCreating(true)
    try {
      if (token === "booz") {
        // BOOZ minted at draw — no deposit
        const tx = await writeContractAsync({ address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "createRaffle", args: [[prizeToken], prizeAmounts, BigInt(wc), BigInt(duration)], chainId: WORLD_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      } else if (token === "eth") {
        // Send ETH to contract, then create
        const ethTx = await sendTransaction(wagmiConfig, { to: WORLD_RAFFLE_ADDRESS, value: totalPrize, chainId: WORLD_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: ethTx, chainId: WORLD_CHAIN.id })
        const tx = await writeContractAsync({ address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "createRaffle", args: [[prizeToken], prizeAmounts, BigInt(wc), BigInt(duration)], chainId: WORLD_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      } else {
        // ERC-20: approve → create → deposit
        const tokenAddr = token === "usdc" ? WORLD_USDC_ADDRESS
                        : token === "wld"  ? WORLD_WLD_ADDRESS
                        : customAddr as `0x${string}`
        const approveTx = await writeContractAsync({ address: tokenAddr, abi: ERC20_ABI, functionName: "approve", args: [WORLD_RAFFLE_ADDRESS, totalPrize], chainId: WORLD_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx, chainId: WORLD_CHAIN.id })
        const createTx = await writeContractAsync({ address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "createRaffle", args: [[prizeToken], prizeAmounts, BigInt(wc), BigInt(duration)], chainId: WORLD_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: createTx, chainId: WORLD_CHAIN.id })
        const depositTx = await writeContractAsync({ address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "depositPrize", args: [tokenAddr, totalPrize], chainId: WORLD_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: depositTx, chainId: WORLD_CHAIN.id })
      }
      setPrizes(["", "", ""]); setWinnerCount("3"); setCustomAddr(""); setCustomDec("18")
      onCreated()
      toast({ title: "Raffle Created!", description: `${wc} winner${wc !== 1 ? "s" : ""} · ${sel.label === "Custom" ? `${customHours}h` : sel.label}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected"))
        toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsCreating(false) }
  }

  const wc = Math.max(1, Math.min(20, parseInt(winnerCount) || 1))
  const canCreate = prizes.slice(0, wc).every(x => x && parseFloat(x) > 0)
    && (token !== "custom" || isAddress(customAddr))
    && (DURATION_OPTIONS[durationIdx].seconds !== 0 || (parseInt(customHours) > 0))

  return (
    <Section title="Create Raffle" description="Manually create a standalone raffle independent of sponsor applications.">
      {/* Token selector */}
      <div className="grid grid-cols-5 gap-1 rounded-lg bg-gray-100 p-1">
        {(["usdc", "wld", "booz", "eth", "custom"] as const).map(t => (
          <button key={t} onClick={() => setToken(t)}
            className={cn("text-xs font-semibold py-1.5 rounded-md transition-colors",
              token === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      {token === "custom" && (
        <div className="flex gap-2 pt-1">
          <input type="text" value={customAddr} onChange={e => setCustomAddr(e.target.value)}
            placeholder="Token address (0x…)" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="number" min="1" max="18" value={customDec} onChange={e => setCustomDec(e.target.value)}
            placeholder="Dec" className="w-16 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      )}

      {/* Winner count */}
      <div className="flex items-center gap-3 pt-1">
        <label className="text-xs text-muted-foreground whitespace-nowrap">Winners</label>
        <input type="number" min="1" max="20" value={winnerCount} onChange={e => handleWinnerChange(e.target.value)}
          className="w-20 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      {/* Per-winner prizes */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Prize per winner ({token.toUpperCase()})</p>
        {prizes.slice(0, wc).map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14">Winner {i + 1}</span>
            <input type="number" min="0" step="0.01" value={v}
              onChange={e => { const next = [...prizes]; next[i] = e.target.value; setPrizes(next) }}
              placeholder="0.00"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        ))}
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Duration</p>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1">
          {DURATION_OPTIONS.map((opt, i) => (
            <button key={i} onClick={() => setDurationIdx(i)}
              className={cn("text-xs font-semibold py-1.5 rounded-md transition-colors",
                durationIdx === i ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
              {opt.label}
            </button>
          ))}
        </div>
        {DURATION_OPTIONS[durationIdx].seconds === 0 && (
          <div className="flex items-center gap-2">
            <input type="number" min="1" value={customHours} onChange={e => setCustomHours(e.target.value)}
              className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="text-xs text-gray-500">hours</span>
          </div>
        )}
      </div>

      <button onClick={handleCreate} disabled={isCreating || !canCreate}
        className="w-full bg-blue-600 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {isCreating ? <Loader2 size={13} className="animate-spin" /> : null}
        {isCreating ? (token === "booz" ? "Creating…" : token === "eth" ? "Send ETH → Create…" : "Approve → Create → Deposit…") : "Create Raffle"}
      </button>
    </Section>
  )
}

export default function WorldRafflePage() {
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  // Threshold / config state
  const [thresholdInput, setThresholdInput]   = useState("")
  const [minUniqueInput, setMinUniqueInput]   = useState("")
  const [refundDaysInput, setRefundDaysInput] = useState("")
  const [isSettingTh, setIsSettingTh]         = useState(false)
  const [isSettingMu, setIsSettingMu]         = useState(false)
  const [isSettingRt, setIsSettingRt]         = useState(false)
  const [isPausing, setIsPausing]             = useState(false)
  const [isUnpausing, setIsUnpausing]         = useState(false)
  const [withdrawToken, setWithdrawToken]     = useState("")
  const [isWithdrawing, setIsWithdrawing]     = useState(false)
  const [rtRaffleId, setRtRaffleId]           = useState("")
  const [rtThreshold, setRtThreshold]         = useState("")
  const [rtMinUnique, setRtMinUnique]         = useState("")
  const [isSettingRtOvr, setIsSettingRtOvr]   = useState(false)
  const [newBooztory, setNewBooztory]         = useState("")
  const [isSettingBooztory, setIsSettingBooztory] = useState(false)
  const [wiWorldId, setWiWorldId]             = useState("")
  const [wiAppId, setWiAppId]                 = useState("")
  const [wiAction, setWiAction]               = useState("")
  const [isSettingWorldId, setIsSettingWorldId] = useState(false)

  // ── Contract reads ────────────────────────────────────────────────────────

  const { data: configRaw, refetch: refetchConfig } = useReadContracts({
    contracts: [
      { address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "defaultDrawThreshold",     chainId: WORLD_CHAIN.id },
      { address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "defaultMinUniqueEntrants", chainId: WORLD_CHAIN.id },
      { address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "refundTimeout",            chainId: WORLD_CHAIN.id },
      { address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "paused",                  chainId: WORLD_CHAIN.id },
      { address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "nextRaffleId",             chainId: WORLD_CHAIN.id },
    ],
    query: { refetchInterval: 30_000 },
  })

  const defaultThreshold = Number(configRaw?.[0]?.result as bigint ?? 100n)
  const defaultMinUnique = Number(configRaw?.[1]?.result as bigint ?? 20n)
  const refundTimeout    = Number(configRaw?.[2]?.result as bigint ?? 0n)
  const isPaused         = !!(configRaw?.[3]?.result as boolean | undefined)
  const nextRaffleId     = Number(configRaw?.[4]?.result as bigint ?? 0n)

  const refundDays = refundTimeout ? Math.round(refundTimeout / 86400) : null

  // Fetch recent raffles (last 10)
  const recentCount = Math.min(nextRaffleId, 10)
  const { data: rafflesRaw, refetch: refetchRaffles } = useReadContracts({
    contracts: Array.from({ length: recentCount }, (_, i) => ({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: "getRaffle" as const,
      args: [BigInt(Math.max(0, nextRaffleId - recentCount) + i)] as const,
      chainId: WORLD_CHAIN.id,
    })),
    query: { enabled: recentCount > 0, refetchInterval: 15_000 },
  })

  const raffles: RaffleInfo[] = Array.from({ length: recentCount }, (_, i) => {
    const id = Math.max(0, nextRaffleId - recentCount) + i
    const r  = rafflesRaw?.[i]?.result as readonly [readonly `0x${string}`[], bigint, bigint, bigint, number, bigint, bigint, `0x${string}`, bigint, bigint, bigint] | undefined
    if (!r) return null
    return {
      raffleId: id, prizeTokens: r[0], winnerCount: r[1], startTime: r[2],
      endTime: r[3], status: r[4], drawThreshold: r[5], minUniqueEntrants: r[6],
      commitment: r[7], commitBlock: r[8], totalTickets: r[9], uniqueEntrants: r[10],
    } as RaffleInfo
  }).filter((r): r is RaffleInfo => r !== null).reverse()

  // ── Helpers ───────────────────────────────────────────────────────────────

  function refetchAll() { refetchConfig(); refetchRaffles() }

  async function writeConfig(label: string, fn: () => Promise<`0x${string}`>) {
    try {
      const hash = await fn()
      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: WORLD_CHAIN.id })
      toast({ title: "Saved", description: `${label} updated.` })
      refetchAll()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected"))
        toast({ title: "Failed", description: msg || "Transaction failed.", variant: "destructive" })
    }
  }

  async function handleSetThreshold() {
    const v = parseInt(thresholdInput)
    if (!v || v <= 0) return
    setIsSettingTh(true)
    await writeConfig("Default Draw Threshold", () => writeContractAsync({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: "setDefaultDrawThreshold", args: [BigInt(v)], chainId: WORLD_CHAIN.id,
    }))
    setThresholdInput(""); setIsSettingTh(false)
  }

  async function handleSetMinUnique() {
    const v = parseInt(minUniqueInput)
    if (!v || v <= 0) return
    setIsSettingMu(true)
    await writeConfig("Min Unique Entrants", () => writeContractAsync({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: "setDefaultMinUniqueEntrants", args: [BigInt(v)], chainId: WORLD_CHAIN.id,
    }))
    setMinUniqueInput(""); setIsSettingMu(false)
  }

  async function handleSetRefund() {
    const days = parseFloat(refundDaysInput)
    if (!days || days <= 0) return
    setIsSettingRt(true)
    await writeConfig("Refund Timeout", () => writeContractAsync({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: "setRefundTimeout", args: [BigInt(Math.round(days * 86400))], chainId: WORLD_CHAIN.id,
    }))
    setRefundDaysInput(""); setIsSettingRt(false)
  }

  async function handleWithdraw() {
    setIsWithdrawing(true)
    const token = withdrawToken.trim() || "0x0000000000000000000000000000000000000000"
    await writeConfig("Withdraw", () => writeContractAsync({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: "withdraw", args: [token as `0x${string}`], chainId: WORLD_CHAIN.id,
    }))
    setWithdrawToken(""); setIsWithdrawing(false)
  }

  async function handleSetRaffleThresholds() {
    const id = parseInt(rtRaffleId), th = parseInt(rtThreshold), mu = parseInt(rtMinUnique)
    if (isNaN(id) || id < 0 || !th || !mu) return
    setIsSettingRtOvr(true)
    await writeConfig(`Raffle #${id} Thresholds`, () => writeContractAsync({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: "setRaffleThresholds", args: [BigInt(id), BigInt(th), BigInt(mu)], chainId: WORLD_CHAIN.id,
    }))
    setRtRaffleId(""); setRtThreshold(""); setRtMinUnique(""); setIsSettingRtOvr(false)
  }

  async function handleSetBooztory() {
    if (!newBooztory || !isAddress(newBooztory)) return
    setIsSettingBooztory(true)
    await writeConfig("Booztory Address", () => writeContractAsync({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: "setBooztory", args: [newBooztory as `0x${string}`], chainId: WORLD_CHAIN.id,
    }))
    setNewBooztory(""); setIsSettingBooztory(false)
  }

  async function handleSetWorldId() {
    if (!wiWorldId || !isAddress(wiWorldId) || !wiAppId || !wiAction) return
    setIsSettingWorldId(true)
    await writeConfig("World ID Oracle", () => writeContractAsync({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: "setWorldId", args: [wiWorldId as `0x${string}`, wiAppId, wiAction], chainId: WORLD_CHAIN.id,
    }))
    setWiWorldId(""); setWiAppId(""); setWiAction(""); setIsSettingWorldId(false)
  }

  async function togglePause() {
    const fn = isPaused ? "unpause" : "pause"
    if (isPaused) setIsUnpausing(true); else setIsPausing(true)
    await writeConfig(isPaused ? "Unpause" : "Pause", () => writeContractAsync({
      address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI,
      functionName: fn, chainId: WORLD_CHAIN.id,
    }))
    setIsPausing(false); setIsUnpausing(false)
  }

  const activeRaffles = raffles.filter(r => r.status === 0)
  const pastRaffles   = raffles.filter(r => r.status !== 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Raffle</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage World Chain raffles. Draw uses commit-reveal — no Chainlink VRF. Raffles are created automatically when a sponsor application is accepted.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left — Create + Active + Past Raffles */}
        <div className="space-y-4">

          <CreateRaffleSection onCreated={refetchAll} />

          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Active Raffles {activeRaffles.length > 0 && <span className="text-blue-600">({activeRaffles.length})</span>}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Commit-reveal: 1) Commit a secret hash once the raffle ends. 2) Reveal within 256 blocks (~8.5 min). If the window expires, reset and recommit.
            </p>
          </div>
          {activeRaffles.length === 0 ? (
            <div className="rounded-xl border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              No active raffles.
            </div>
          ) : (
            <div className="space-y-3">
              {activeRaffles.map(r => <RaffleCard key={r.raffleId} raffle={r} />)}
            </div>
          )}

          {/* Past Raffles */}
          {pastRaffles.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Past ({pastRaffles.length})</h2>
              {pastRaffles.slice(0, 5).map(r => <RaffleCard key={r.raffleId} raffle={r} />)}
            </div>
          )}
        </div>

        {/* Right — Config */}
        <div className="space-y-4">

          <Section
            title="Draw Thresholds"
            description="Default values applied when a new raffle is created. Override per-raffle in sponsor acceptance."
          >
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-gray-50 px-3 py-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Default Threshold</p>
                <p className="font-bold text-gray-800 mt-0.5">{defaultThreshold.toLocaleString()} tickets</p>
              </div>
              <div className="rounded-lg border bg-gray-50 px-3 py-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Min Unique</p>
                <p className="font-bold text-gray-800 mt-0.5">{defaultMinUnique.toLocaleString()} entrants</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number" min={1} value={thresholdInput}
                  onChange={e => setThresholdInput(e.target.value)}
                  placeholder="New threshold (tickets)"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={handleSetThreshold}
                  disabled={isSettingTh || !thresholdInput}
                  className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isSettingTh ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number" min={1} value={minUniqueInput}
                  onChange={e => setMinUniqueInput(e.target.value)}
                  placeholder="New min unique entrants"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={handleSetMinUnique}
                  disabled={isSettingMu || !minUniqueInput}
                  className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isSettingMu ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </button>
              </div>
            </div>
          </Section>

          <Section title="Refund Timeout" description="How long sponsors can wait before claiming a refund on rejected/pending applications.">
            <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Current</p>
              <p className="font-bold text-gray-800 mt-0.5">{refundDays !== null ? `${refundDays} days` : "Loading…"}</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number" min={1} value={refundDaysInput}
                onChange={e => setRefundDaysInput(e.target.value)}
                placeholder="Days"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={handleSetRefund}
                disabled={isSettingRt || !refundDaysInput}
                className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {isSettingRt ? <Loader2 size={13} className="animate-spin" /> : "Set"}
              </button>
            </div>
          </Section>

          <Section
            title="Per-Raffle Threshold Override"
            description="Override draw threshold and min unique entrants for a specific raffle."
          >
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Raffle ID", value: rtRaffleId, set: setRtRaffleId, placeholder: "0" },
                { label: "Threshold", value: rtThreshold, set: setRtThreshold, placeholder: "100" },
                { label: "Min Unique", value: rtMinUnique, set: setRtMinUnique, placeholder: "20" },
              ].map(f => (
                <div key={f.label} className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <input type="number" min="0" value={f.value} onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              ))}
            </div>
            <button onClick={handleSetRaffleThresholds} disabled={isSettingRtOvr || !rtRaffleId || !rtThreshold || !rtMinUnique}
              className="w-full bg-blue-600 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {isSettingRtOvr ? <Loader2 size={13} className="animate-spin" /> : null}
              Set Per-Raffle Thresholds
            </button>
          </Section>

          <Section title="Wiring">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Booztory Contract</p>
                <div className="flex gap-2">
                  <input type="text" value={newBooztory} onChange={e => setNewBooztory(e.target.value)}
                    placeholder="0x BooztoryWorld address"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={handleSetBooztory} disabled={isSettingBooztory || !isAddress(newBooztory)}
                    className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-1.5">
                    {isSettingBooztory ? <Loader2 size={12} className="animate-spin" /> : null} Set
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">World ID Oracle</p>
                <div className="space-y-2">
                  <input type="text" value={wiWorldId} onChange={e => setWiWorldId(e.target.value)}
                    placeholder="WorldID contract (0x…)"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <input type="text" value={wiAppId} onChange={e => setWiAppId(e.target.value)}
                    placeholder="App ID (e.g. app_xyz)"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <div className="flex gap-2">
                    <input type="text" value={wiAction} onChange={e => setWiAction(e.target.value)}
                      placeholder="Action (e.g. verify)"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <button onClick={handleSetWorldId} disabled={isSettingWorldId || !isAddress(wiWorldId) || !wiAppId || !wiAction}
                      className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-1.5">
                      {isSettingWorldId ? <Loader2 size={12} className="animate-spin" /> : null} Set
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Withdraw">
            <p className="text-xs text-muted-foreground">Withdraw prize funds or recover tokens. Leave address blank to withdraw ETH.</p>
            <div className="flex gap-2">
              <input type="text" value={withdrawToken} onChange={e => setWithdrawToken(e.target.value)}
                placeholder="ERC-20 address (blank = ETH)"
                className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button onClick={handleWithdraw} disabled={isWithdrawing || (!!withdrawToken && !isAddress(withdrawToken))}
                className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-1.5">
                {isWithdrawing ? <Loader2 size={12} className="animate-spin" /> : null} Withdraw
              </button>
            </div>
          </Section>

          <Section title="Emergency Controls">
            <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm mb-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Contract Status</p>
              <p className={cn("font-bold mt-0.5", isPaused ? "text-red-600" : "text-green-700")}>
                {isPaused ? "Paused" : "Running"}
              </p>
            </div>
            <button
              onClick={togglePause}
              disabled={isPausing || isUnpausing}
              className={cn(
                "w-full text-sm font-bold py-2.5 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2",
                isPaused
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              )}
            >
              {(isPausing || isUnpausing) ? <Loader2 size={13} className="animate-spin" /> : null}
              {isPaused ? "Unpause Contract" : "Pause Contract"}
            </button>
          </Section>

        </div>
      </div>
    </div>
  )
}
