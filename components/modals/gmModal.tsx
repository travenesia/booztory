"use client"

import { useState, useEffect, useMemo } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi"
import { HiBolt } from "react-icons/hi2"
import { FaCoins } from "react-icons/fa6"
import { Loader2 } from "lucide-react"
import confetti from "canvas-confetti"
import { cn } from "@/lib/utils"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI } from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"

// Milestones matching the contract
const MILESTONES = [
  { day: 7,  label: "Warrior", emoji: "⚔️",  bit: 0, bonus: 50 },
  { day: 14, label: "Elite",   emoji: "🛡️",  bit: 1, bonus: 250 },
  { day: 30, label: "Epic",    emoji: "👑",  bit: 2, bonus: 350 },
  { day: 60, label: "Legend",  emoji: "🔥",  bit: 3, bonus: 500 },
  { day: 90, label: "Mythic",  emoji: "🔱",  bit: 4, bonus: 4560 },
]

const GM_DAY_REWARDS = [5, 10, 15, 20, 25, 30, 35] // days 1–7
const GM_FLAT_REWARD = 50                            // days 8–90

function getUtcDay() {
  return Math.floor(Date.now() / 1000 / 86400)
}

function getDailyReward(streakCount: number): number {
  if (streakCount <= 0) return GM_DAY_REWARDS[0]
  if (streakCount <= 7) return GM_DAY_REWARDS[streakCount - 1]
  return GM_FLAT_REWARD
}

// ── GM Modal Inner Content ────────────────────────────────────────────────────

export function GMContent({ onClose }: { onClose?: () => void }) {
  const { address } = useAccount()
  const [countdown, setCountdown] = useState("")

  const { data: streakRaw, refetch: refetchStreak } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "gmStreaks",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address },
  })

  const { writeContractAsync, data: txHash, isPending: isWritePending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  const today = BigInt(getUtcDay())
  const streakData = streakRaw as [bigint, number, number] | undefined
  const lastClaimDay  = streakData?.[0] ?? 0n
  const streakCount   = Number(streakData?.[1] ?? 0)
  const claimedMask   = Number(streakData?.[2] ?? 0)

  const claimedToday    = lastClaimDay === today
  const journeyComplete = streakCount >= 90
  const isConsecutive   = lastClaimDay === today - 1n && streakCount > 0 && streakCount < 90

  // What day will next claim land on
  const nextCount = claimedToday ? streakCount : isConsecutive ? streakCount + 1 : 1
  const displayReward = getDailyReward(nextCount)

  // Check if next claim hits a milestone bonus (one-time)
  const nextMilestone = MILESTONES.find(
    m => m.day === nextCount && !(claimedMask & (1 << m.bit))
  )

  // Progress bar 0–100%
  const progressPct = Math.min((streakCount / 90) * 100, 100)

  // Countdown to next UTC midnight
  useEffect(() => {
    if (!claimedToday) { setCountdown(""); return }
    const update = () => {
      const diff = (getUtcDay() + 1) * 86400 - Math.floor(Date.now() / 1000)
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setCountdown(`${h}h ${m}m ${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [claimedToday])

  // Confetti + refetch on success
  useEffect(() => {
    if (!isSuccess) return
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.55 } })
    refetchStreak()
    reset()
  }, [isSuccess, refetchStreak, reset])

  const handleClaim = async () => {
    if (!address) return
    try {
      if (chainId !== APP_CHAIN.id) await switchChainAsync({ chainId: APP_CHAIN.id })
      await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "claimDailyGM" })
    } catch {
      // user rejected or chain switch failed — button reverts naturally
    }
  }

  const isLoading = isWritePending || isConfirming

  return (
    <div className="flex flex-col items-center w-full px-6 py-4">
      {/* Flame + title */}
      <div className="text-6xl mb-3 select-none leading-none">🔥</div>
      <h2 className="text-gray-800 font-black uppercase tracking-[0.12em] text-lg mb-1">
        {journeyComplete ? "Journey Complete!" : "Your Daily Streak"}
      </h2>
      <p className="text-gray-500 text-sm mb-5">
        {journeyComplete
          ? "You've reached Mythic rank"
          : streakCount > 0
            ? <>Day <span className="font-bold text-gray-800">{streakCount}</span> / 90</>
            : "Start your 90-day journey"
        }
      </p>

      {/* Milestone progress bar */}
      <div className="w-full mb-6">
        <div className="relative h-2 bg-gray-200 rounded-full mb-4">
          <div
            className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
          {/* Checkpoint dots — positioned by day percentage */}
          {MILESTONES.map(m => {
            const pct = (m.day / 90) * 100
            const claimed = !!(claimedMask & (1 << m.bit))
            const reached = streakCount >= m.day
            return (
              <div
                key={m.day}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                <div className={cn(
                  "w-3 h-3 rounded-full border-2 border-white",
                  claimed  ? "bg-emerald-500"
                  : reached ? "bg-emerald-300"
                            : "bg-gray-300"
                )} />
              </div>
            )
          })}
        </div>

      </div>

      {/* Journey complete banner OR reward card */}
      {journeyComplete ? (
        <div className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl flex flex-col items-center py-6 mb-5 shadow-sm">
          <span className="text-4xl mb-2">🔱</span>
          <p className="text-white font-black text-lg uppercase tracking-wide">Mythic Achieved</p>
          <p className="text-white/80 text-sm mt-1">Your 90-day journey is complete</p>
        </div>
      ) : (
        <div className="w-full bg-white/70 border border-gray-200 rounded-2xl flex flex-col items-center py-5 mb-5 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/booz.svg" alt="BOOZ" width={64} height={64} className="mb-4 animate-bounce-slow" />
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-gray-900 font-bold text-2xl leading-none">
              {claimedToday ? getDailyReward(streakCount) : displayReward} $BOOZ
            </span>
          </div>
          {nextMilestone && !claimedToday && (
            <span className="text-emerald-600 font-semibold text-sm">
              +{nextMilestone.bonus} {nextMilestone.emoji} {nextMilestone.label} bonus!
            </span>
          )}
          <span className="text-gray-400 text-xs mt-1">Daily Streak Reward</span>
        </div>
      )}

      {/* Status text */}
      <div className="mb-5 text-center min-h-[36px]">
        {journeyComplete ? null : claimedToday ? (
          <>
            <p className="text-gray-700 text-sm font-semibold">
              Come back tomorrow for day <span className="font-black">{streakCount + 1}</span>
            </p>
            {countdown && (
              <p className="text-gray-400 text-xs mt-1">Resets in {countdown}</p>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-sm">
            Tip: 📍 Higher streaks earn more <span className="font-semibold text-gray-700">BOOZ rewards</span>
          </p>
        )}
      </div>

      {/* Claim button */}
      {journeyComplete ? (
        <button
          disabled
          className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-black uppercase tracking-widest py-4 rounded-2xl text-sm opacity-80 cursor-not-allowed"
        >
          Journey Complete 🔱
        </button>
      ) : !address ? (
        <button
          disabled
          className="w-full bg-gray-200 text-gray-400 font-black uppercase tracking-widest py-4 rounded-2xl text-sm cursor-not-allowed"
        >
          Connect Wallet First
        </button>
      ) : claimedToday ? (
        <button
          disabled
          className="w-full bg-gray-100 text-gray-400 font-black uppercase tracking-widest py-4 rounded-2xl text-sm cursor-not-allowed border border-gray-200"
        >
          Already Claimed
        </button>
      ) : (
        <button
          onClick={handleClaim}
          disabled={isLoading}
          className="w-full bg-gray-900 text-white font-black uppercase tracking-widest py-4 rounded-2xl text-sm hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isWritePending ? "Confirm in wallet..." : "Claiming..."}</span>
            </>
          ) : (
            "CLAIM"
          )}
        </button>
      )}

      <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1 mt-3">
        Each claim earns $BOOZ and <FaCoins className="text-orange-500" size={11} /> points toward raffle tickets
      </p>
    </div>
  )
}

// ── Shared: check if GM is claimable today ────────────────────────────────────

function useGMClaimable() {
  const { address } = useAccount()
  const { data: streakRaw } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "gmStreaks",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: !!address },
  })
  return useMemo(() => {
    if (!address || !streakRaw) return false
    const lastClaimDay = (streakRaw as [bigint, number, number])[0]
    return lastClaimDay !== BigInt(getUtcDay())
  }, [address, streakRaw])
}

// ── Desktop: icon + Dialog ────────────────────────────────────────────────────

const GM_NATURAL_H = 560

export function GMButton() {
  const [open, setOpen] = useState(false)
  const claimable = useGMClaimable()
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const update = () => {
      const available = window.innerHeight - 96
      setScale(Math.min(1, available / GM_NATURAL_H))
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center justify-center w-[28px] h-[28px] transition-colors cursor-pointer"
        aria-label="Daily GM"
      >
        <HiBolt size={14} className={claimable ? "text-orange-500 animate-pulse" : "text-gray-900 hover:text-[#E63946]"} />
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 max-w-sm rounded-2xl overflow-hidden border border-gray-200"
          style={{
            background: "linear-gradient(160deg, #f0f4ff 0%, #e8f0fe 40%, #f5f7ff 100%)",
            height: GM_NATURAL_H * scale,
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Daily GM</DialogTitle>
          </DialogHeader>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top center", height: GM_NATURAL_H }}>
            <GMContent onClose={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Mobile: icon + Sheet ─────────────────────────────────────────────────────

export function GMMobileButton() {
  const [open, setOpen] = useState(false)
  const claimable = useGMClaimable()

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-[28px] h-[28px] rounded-base transition-colors cursor-pointer"
        aria-label="Daily GM"
      >
        <HiBolt size={14} className={claimable ? "text-orange-500 animate-pulse" : "text-gray-900 hover:text-[#E63946]"} />
      </span>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-tl-2xl rounded-tr-2xl border-t border-gray-200 outline-none p-0 overflow-y-auto max-h-[85dvh]"
          style={{ background: "linear-gradient(160deg, #f0f4ff 0%, #e8f0fe 40%, #f5f7ff 100%)" }}
        >
          <SheetTitle className="sr-only">Daily GM</SheetTitle>
          <SheetDescription className="sr-only">Daily GM streak claim</SheetDescription>
          <GMContent onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
