"use client"

import { useState, useMemo } from "react"
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig, APP_CHAIN } from "@/lib/wagmi"
import { parseUnits, isAddress } from "viem"
import { sendTransaction } from "wagmi/actions"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  RAFFLE_ADDRESS, RAFFLE_ABI,
  TOKEN_ADDRESS, USDC_ADDRESS, ERC20_ABI,
} from "@/lib/contract"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ── Constants ──────────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { label: "7 days",  seconds: 7  * 86400 },
  { label: "14 days", seconds: 14 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
  { label: "Custom",  seconds: 0 },
]

// ── Sponsor helpers ────────────────────────────────────────────────────────────

interface AcceptedSponsor {
  appId: number
  sponsorName: string
  duration: number
  prizePaid: bigint
  acceptedAt: number
}

function parseSponsorName(adContent: string): string {
  try { return (JSON.parse(adContent) as Record<string, string>).sponsorName ?? "" } catch { return "" }
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

function InputRow({
  placeholder, value, onChange, onSubmit, loading, label, min = 1,
}: {
  placeholder: string; value: string; onChange: (v: string) => void
  onSubmit: () => void; loading: boolean; label: string; min?: number
}) {
  return (
    <div className="flex gap-2">
      <input
        type="number" min={min} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      <button
        onClick={onSubmit} disabled={loading || !value}
        className="bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {loading ? "Saving..." : label}
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminRafflePage() {
  const { address } = useAccount()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  // Thresholds state
  const [thresholdInput, setThresholdInput]       = useState("")
  const [minUniqueInput, setMinUniqueInput]       = useState("")
  const [isSettingThreshold, setIsSettingThreshold] = useState(false)
  const [isSettingMinUnique, setIsSettingMinUnique] = useState(false)

  // Per-raffle override state
  const [rtRaffleId, setRtRaffleId]               = useState("")
  const [rtThreshold, setRtThreshold]             = useState("")
  const [rtMinUnique, setRtMinUnique]             = useState("")
  const [isSettingRt, setIsSettingRt]             = useState(false)

  // Withdraw state
  const [isWithdrawing, setIsWithdrawing]         = useState(false)

  // Create raffle state
  const [crToken, setCrToken]                     = useState<"usdc" | "booz" | "eth" | "custom">("usdc")
  const [crCustomTokenAddress, setCrCustomTokenAddress] = useState("")
  const [crCustomDecimals, setCrCustomDecimals]   = useState("18")
  const [crWinnerCount, setCrWinnerCount]         = useState("3")
  const [crPrizes, setCrPrizes]                   = useState<string[]>(["", "", ""])
  const [crDurationIdx, setCrDurationIdx]         = useState(1)
  const [crCustomHours, setCrCustomHours]         = useState("1")
  const [crSponsorAppId, setCrSponsorAppId]       = useState<number | null>(null)
  const [isCreatingRaffle, setIsCreatingRaffle]   = useState(false)

  // ── Contract reads ──────────────────────────────────────────────────────────

  const { data: defaultThresholdRaw, refetch: refetchThreshold } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "defaultDrawThreshold",
    chainId: APP_CHAIN.id, query: { refetchInterval: 60_000 },
  })
  const { data: defaultMinUniqueRaw, refetch: refetchMinUnique } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "defaultMinUniqueEntrants",
    chainId: APP_CHAIN.id, query: { refetchInterval: 60_000 },
  })
  const { data: raffleUsdcRaw, refetch: refetchRaffleUsdc } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [RAFFLE_ADDRESS],
    chainId: APP_CHAIN.id, query: { refetchInterval: 30_000 },
  })
  const { data: nextRaffleIdRaw, refetch: refetchNextRaffleId } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "nextRaffleId",
    chainId: APP_CHAIN.id, query: { refetchInterval: 30_000 },
  })
  const { data: nextAppIdRaw } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "nextApplicationId",
    chainId: APP_CHAIN.id, query: { refetchInterval: 60_000 },
  })
  const { data: boozTokenRaw } = useReadContract({
    address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "boozToken",
    chainId: APP_CHAIN.id,
  })

  const totalRaffles = Number(nextRaffleIdRaw ?? 0n)
  const _appCount    = Number(nextAppIdRaw ?? 0n)

  const { data: allAppsRaw } = useReadContracts({
    contracts: Array.from({ length: _appCount }, (_, i) => ({
      address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
      functionName: "applications" as const, args: [BigInt(i)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: _appCount > 0, refetchInterval: 5 * 60_000 },
  })

  const { data: allRafflesRaw } = useReadContracts({
    contracts: Array.from({ length: Math.min(totalRaffles, 10) }, (_, i) => ({
      address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
      functionName: "getRaffle" as const,
      args: [BigInt(Math.max(0, totalRaffles - Math.min(totalRaffles, 10)) + i)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: totalRaffles > 0, refetchInterval: 60_000 },
  })

  const { data: allRafflePrizesRaw } = useReadContracts({
    contracts: Array.from({ length: Math.min(totalRaffles, 10) }, (_, i) => ({
      address: RAFFLE_ADDRESS, abi: RAFFLE_ABI,
      functionName: "getRafflePrizeAmounts" as const,
      args: [BigInt(Math.max(0, totalRaffles - Math.min(totalRaffles, 10)) + i)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { enabled: totalRaffles > 0, refetchInterval: 60_000 },
  })

  // ── Derived ─────────────────────────────────────────────────────────────────

  const defaultThreshold = Number(defaultThresholdRaw ?? 100n)
  const defaultMinUnique = Number(defaultMinUniqueRaw ?? 5n)
  const raffleUsdcNum    = raffleUsdcRaw != null ? Number(raffleUsdcRaw as bigint) / 1_000_000 : null

  const activeRaffleIds: bigint[] = useMemo(() => {
    return allRafflesRaw?.flatMap((r, i) => {
      const d = r.result as readonly [readonly string[], bigint, bigint, bigint, number] | undefined
      if (!d || d[4] !== 0) return [] // only Active (status=0)
      return [BigInt(Math.max(0, totalRaffles - Math.min(totalRaffles, 10)) + i)]
    }) ?? []
  }, [allRafflesRaw, totalRaffles])

  // Raffle IDs that are Active only (status=0) — excludes drawn and cancelled
  const notDrawnRaffleIds: number[] = useMemo(() => {
    const offset = Math.max(0, totalRaffles - Math.min(totalRaffles, 10))
    return allRafflesRaw?.flatMap((r, i) => {
      const d = r.result as readonly [readonly string[], bigint, bigint, bigint, number] | undefined
      if (!d || d[4] !== 0) return [] // only Active (status=0)
      return [offset + i]
    }) ?? []
  }, [allRafflesRaw, totalRaffles])

  const acceptedSponsors = useMemo((): AcceptedSponsor[] => {
    if (!allAppsRaw) return []
    return allAppsRaw.flatMap((r, i) => {
      const app = r.result as readonly [string, string, string, string, bigint, bigint, bigint, bigint, bigint, number] | undefined
      if (!app) return []
      const [, , adContent, adLink, duration, prizePaid, , , acceptedAt, status] = app
      if (status !== 1) return []
      const sponsorName = parseSponsorName(adContent)
      if (!sponsorName) return []
      return [{ appId: i, sponsorName, duration: Number(duration), prizePaid, acceptedAt: Number(acceptedAt) }]
    })
  }, [allAppsRaw])

  const { activeSponsors, missedSponsors } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const boozAddr = ((boozTokenRaw as string | undefined) ?? TOKEN_ADDRESS).toLowerCase()

    function isAlreadyUsed(s: AcceptedSponsor) {
      return (allRafflesRaw ?? []).some((r, i) => {
        const rData = r.result as readonly [readonly string[], bigint, bigint, bigint, number] | undefined
        if (!rData) return false
        const [prizeTokens, , startTime, , raffleStatus] = rData
        if (raffleStatus === 2 || raffleStatus === 3) return false // drawn or cancelled
        if (Number(startTime) < s.acceptedAt || Number(startTime) >= s.acceptedAt + s.duration) return false
        if ((prizeTokens as string[])[0]?.toLowerCase() === boozAddr) return false
        const prizeData = (allRafflePrizesRaw ?? [])[i]?.result as readonly (readonly bigint[])[] | undefined
        const totalPrize = (prizeData?.[0] ?? []).reduce((a: bigint, b: bigint) => a + b, 0n)
        const diff = totalPrize > s.prizePaid ? totalPrize - s.prizePaid : s.prizePaid - totalPrize
        return diff <= 1_000_000n
      })
    }

    const active: AcceptedSponsor[] = []
    const missed: AcceptedSponsor[] = []

    for (const s of acceptedSponsors) {
      if (s.acceptedAt > now) continue // not started yet
      if (isAlreadyUsed(s)) continue   // raffle already created
      if (s.acceptedAt + s.duration > now) active.push(s)
      else missed.push(s)              // expired without a raffle
    }

    return { activeSponsors: active, missedSponsors: missed }
  }, [acceptedSponsors, allRafflesRaw, allRafflePrizesRaw, boozTokenRaw])

  const availableUsdcBn = useMemo(() => {
    let committed = 0n
    ;(allRafflesRaw ?? []).forEach((r, i) => {
      const rData = r.result as readonly [readonly string[], bigint, bigint, bigint, number] | undefined
      if (!rData) return
      const [prizeTokens, , , , raffleStatus] = rData
      if (raffleStatus !== 0) return
      const usdcIdx = (prizeTokens as string[]).findIndex(t => t.toLowerCase() === USDC_ADDRESS.toLowerCase())
      if (usdcIdx === -1) return
      const prizeData = (allRafflePrizesRaw ?? [])[i]?.result as readonly (readonly bigint[])[] | undefined
      const total = (prizeData?.[usdcIdx] ?? []).reduce((a: bigint, b: bigint) => a + b, 0n)
      committed += total
    })
    const balance = (raffleUsdcRaw as bigint | undefined) ?? 0n
    return balance > committed ? balance - committed : 0n
  }, [allRafflesRaw, allRafflePrizesRaw, raffleUsdcRaw])

  const winnerCount = Math.max(1, Math.min(20, parseInt(crWinnerCount) || 1))

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSetThreshold() {
    const val = parseInt(thresholdInput)
    if (!val || val < 1) return
    setIsSettingThreshold(true)
    try {
      const tx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "setDefaultDrawThreshold", args: [BigInt(val)], chainId: APP_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setThresholdInput(""); refetchThreshold()
      toast({ title: "Updated", description: `Default threshold set to ${val}.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsSettingThreshold(false) }
  }

  async function handleSetMinUnique() {
    const val = parseInt(minUniqueInput)
    if (!val || val < 1) return
    setIsSettingMinUnique(true)
    try {
      const tx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "setDefaultMinUniqueEntrants", args: [BigInt(val)], chainId: APP_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setMinUniqueInput(""); refetchMinUnique()
      toast({ title: "Updated", description: `Min unique entrants set to ${val}.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsSettingMinUnique(false) }
  }

  async function handleSetRaffleThresholds() {
    const raffleId  = parseInt(rtRaffleId)
    const threshold = parseInt(rtThreshold)
    const minUnique = parseInt(rtMinUnique)
    if (isNaN(raffleId) || raffleId < 0) return
    if (rtThreshold  && (isNaN(threshold) || threshold < 1)) return
    if (rtMinUnique  && (isNaN(minUnique) || minUnique < 1)) return
    if (!rtThreshold && !rtMinUnique) return
    const t = rtThreshold ? BigInt(threshold) : BigInt(defaultThreshold)
    const u = rtMinUnique ? BigInt(minUnique)  : BigInt(defaultMinUnique)
    setIsSettingRt(true)
    try {
      const tx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "setRaffleThresholds", args: [BigInt(raffleId), t, u], chainId: APP_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setRtRaffleId(""); setRtThreshold(""); setRtMinUnique("")
      toast({ title: "Updated", description: `Raffle #${raffleId + 1} thresholds updated.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsSettingRt(false) }
  }

  async function handleWithdraw() {
    setIsWithdrawing(true)
    try {
      const tx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "withdraw", args: [USDC_ADDRESS], chainId: APP_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetchRaffleUsdc()
      toast({ title: "Withdrawn", description: "USDC withdrawn to owner wallet." })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsWithdrawing(false) }
  }

  async function handleCreateRaffle() {
    const prizes = crPrizes.slice(0, winnerCount)
    if (prizes.some(p => !p || parseFloat(p) <= 0)) return
    if (crToken === "custom" && !isAddress(crCustomTokenAddress)) return

    const sponsorApp     = crSponsorAppId !== null ? [...activeSponsors, ...missedSponsors].find(s => s.appId === crSponsorAppId) : undefined
    const selectedOption = DURATION_OPTIONS[crDurationIdx]
    const isCustomDuration = selectedOption?.seconds === 0
    const duration       = sponsorApp
      ? sponsorApp.duration
      : isCustomDuration ? Math.max(1, parseInt(crCustomHours) || 1) * 3600 : (selectedOption?.seconds ?? DURATION_OPTIONS[1].seconds)

    const tokenType   = sponsorApp ? "usdc" : crToken
    const decimals    = tokenType === "usdc" ? 6 : tokenType === "custom" ? (parseInt(crCustomDecimals) || 18) : 18
    const prizeToken  = tokenType === "usdc" ? USDC_ADDRESS
                      : tokenType === "booz" ? TOKEN_ADDRESS
                      : tokenType === "eth"  ? "0x0000000000000000000000000000000000000000"
                      : crCustomTokenAddress
    const prizeBns    = prizes.map(p => parseUnits(p, decimals))
    const totalPrize  = prizeBns.reduce((a, b) => a + b, 0n)
    const prizeAmounts = [prizeBns]

    const prizeLabel = tokenType === "usdc"   ? `$${(Number(totalPrize) / 1e6).toFixed(2)} USDC`
                     : tokenType === "booz"   ? `${(Number(totalPrize) / 1e18).toFixed(0)} BOOZ`
                     : tokenType === "eth"    ? `${(Number(totalPrize) / 1e18).toFixed(4)} ETH`
                     : `${prizes.reduce((a, p) => a + parseFloat(p), 0).toFixed(4)} (custom)`

    setIsCreatingRaffle(true)
    try {
      if (sponsorApp) {
        // Sponsor-funded — USDC prize already in contract
        const tx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "createRaffle", args: [[prizeToken], prizeAmounts, BigInt(winnerCount), BigInt(duration)], chainId: APP_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      } else if (tokenType === "booz") {
        // BOOZ — minted at draw, no deposit needed
        const tx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "createRaffle", args: [[prizeToken], prizeAmounts, BigInt(winnerCount), BigInt(duration)], chainId: APP_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      } else if (tokenType === "eth") {
        // ETH — send to contract first, then create raffle
        const ethTx = await sendTransaction(wagmiConfig, { to: RAFFLE_ADDRESS, value: totalPrize, chainId: APP_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: ethTx })
        const createTx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "createRaffle", args: [[prizeToken], prizeAmounts, BigInt(winnerCount), BigInt(duration)], chainId: APP_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: createTx })
      } else {
        // USDC or custom ERC-20 — approve → create → deposit
        const tokenAddr = tokenType === "usdc" ? USDC_ADDRESS : crCustomTokenAddress as `0x${string}`
        const approveTx = await writeContractAsync({ address: tokenAddr, abi: ERC20_ABI, functionName: "approve", args: [RAFFLE_ADDRESS, totalPrize], chainId: APP_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx })
        const createTx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "createRaffle", args: [[prizeToken], prizeAmounts, BigInt(winnerCount), BigInt(duration)], chainId: APP_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: createTx })
        const depositTx = await writeContractAsync({ address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "depositPrize", args: [tokenAddr, totalPrize], chainId: APP_CHAIN.id })
        await waitForTransactionReceipt(wagmiConfig, { hash: depositTx })
      }

      setCrPrizes(["", "", ""]); setCrWinnerCount("3"); setCrSponsorAppId(null); setCrCustomTokenAddress(""); setCrCustomDecimals("18")
      refetchActiveRaffles()
      toast({ title: "Raffle Created!", description: `${winnerCount} winner${winnerCount !== 1 ? "s" : ""} · ${prizeLabel}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsCreatingRaffle(false) }
  }

  function refetchActiveRaffles() { refetchNextRaffleId(); refetchRaffleUsdc() }

  // Sync prize slots when winner count changes
  function handleWinnerCountChange(v: string) {
    setCrWinnerCount(v)
    const n = Math.max(1, Math.min(20, parseInt(v) || 1))
    setCrPrizes(prev => {
      const next = [...prev]
      while (next.length < n) next.push("")
      return next.slice(0, n)
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Raffle</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage raffles, draw thresholds, and USDC balance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left column */}
        <div className="space-y-6">

          {/* USDC Balance + Withdraw */}
          <Section
            title="Contract USDC Balance"
            description="Sponsor prizes accumulate here. Withdraw collects fees to your wallet."
          >
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Total balance</p>
                <p className="text-2xl font-black text-gray-900 tabular-nums">
                  {raffleUsdcNum != null ? `$${raffleUsdcNum.toFixed(2)}` : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Available (uncommitted)</p>
                <p className="text-lg font-bold text-amber-600 tabular-nums">
                  ${(Number(availableUsdcBn) / 1_000_000).toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !raffleUsdcNum || raffleUsdcNum <= 0}
              className="w-full bg-gray-900 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw USDC to Owner"}
            </button>
          </Section>

          {/* Global Draw Thresholds */}
          <Section
            title="Draw Thresholds"
            description={`Both must be met before a draw can be triggered. Current: ticket threshold = ${defaultThreshold}, min unique wallets = ${defaultMinUnique}.`}
          >
            <InputRow
              placeholder={`Ticket threshold (now ${defaultThreshold})`}
              value={thresholdInput} onChange={setThresholdInput}
              onSubmit={handleSetThreshold} loading={isSettingThreshold} label="Set"
            />
            <InputRow
              placeholder={`Min unique wallets (now ${defaultMinUnique})`}
              value={minUniqueInput} onChange={setMinUniqueInput}
              onSubmit={handleSetMinUnique} loading={isSettingMinUnique} label="Set"
            />
          </Section>

          {/* Per-Raffle Override — only when non-drawn raffles exist */}
          {notDrawnRaffleIds.length > 0 && (
            <Section
              title="Override Raffle Thresholds"
              description="Override draw thresholds for a specific active raffle. Leave a field blank to keep its current value."
            >
              <select
                value={rtRaffleId} onChange={e => { setRtRaffleId(e.target.value); setRtThreshold(""); setRtMinUnique("") }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">Select raffle…</option>
                {notDrawnRaffleIds.map(id => (
                  <option key={id} value={id.toString()}>Raffle #{id + 1}</option>
                ))}
              </select>
              {rtRaffleId !== "" && (
                <div className="flex gap-2">
                  <input
                    type="number" min={1} value={rtThreshold} onChange={e => setRtThreshold(e.target.value)}
                    placeholder={`Tickets (default ${defaultThreshold})`}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="number" min={1} value={rtMinUnique} onChange={e => setRtMinUnique(e.target.value)}
                    placeholder={`Wallets (default ${defaultMinUnique})`}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={handleSetRaffleThresholds}
                    disabled={isSettingRt || (!rtThreshold && !rtMinUnique)}
                    className="bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isSettingRt ? "Saving..." : "Set"}
                  </button>
                </div>
              )}
            </Section>
          )}

        </div>

        {/* Right column — Create Raffle */}
        <Section
        title="Create Raffle"
        description="Owner-funded (USDC: approve → create → deposit) or BOOZ (1 tx, minted at draw). Sponsor-funded if a matching application is selected."
      >
        {/* Sponsor select */}
        {(activeSponsors.length > 0 || missedSponsors.length > 0) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">Sponsor (optional)</p>
            <Select
              value={crSponsorAppId !== null ? crSponsorAppId.toString() : "none"}
              onValueChange={v => {
                if (v === "none") { setCrSponsorAppId(null); return }
                const id = Number(v)
                setCrSponsorAppId(id)
                const s = [...activeSponsors, ...missedSponsors].find(sp => sp.appId === id)
                if (s) {
                  const idx = DURATION_OPTIONS.findIndex(o => o.seconds === s.duration && o.seconds !== 0)
                  if (idx !== -1) setCrDurationIdx(idx)
                  else { setCrDurationIdx(DURATION_OPTIONS.findIndex(o => o.seconds === 0)); setCrCustomHours(String(Math.round(s.duration / 3600))) }
                }
              }}
            >
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No sponsor (owner-funded)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No sponsor (owner-funded)</SelectItem>
                {activeSponsors.map(s => (
                  <SelectItem key={s.appId} value={s.appId.toString()}>
                    {s.sponsorName} — ${(Number(s.prizePaid) / 1e6).toFixed(2)} USDC · {Math.round(s.duration / 86400)}d
                  </SelectItem>
                ))}
                {missedSponsors.length > 0 && activeSponsors.length > 0 && (
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Expired (no raffle created)</div>
                )}
                {missedSponsors.map(s => (
                  <SelectItem key={s.appId} value={s.appId.toString()}>
                    {s.sponsorName} — ${(Number(s.prizePaid) / 1e6).toFixed(2)} USDC · {Math.round(s.duration / 86400)}d · Expired
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Token toggle — hidden when sponsor selected */}
        {crSponsorAppId === null && (
          <div className="space-y-2">
            <div className="flex rounded-lg border overflow-hidden text-sm font-semibold">
              {(["usdc", "booz", "eth", "custom"] as const).map(t => (
                <button key={t} onClick={() => setCrToken(t)}
                  className={cn("flex-1 py-2 transition-colors", crToken === t ? "bg-amber-500 text-white" : "bg-white text-amber-700 hover:bg-amber-50")}
                >
                  {t === "usdc" ? "USDC" : t === "booz" ? "BOOZ" : t === "eth" ? "ETH" : "Custom"}
                </button>
              ))}
            </div>
            {crToken === "custom" && (
              <div className="flex gap-2">
                <input
                  value={crCustomTokenAddress} onChange={e => setCrCustomTokenAddress(e.target.value)}
                  placeholder="Token address (0x…)"
                  className={cn("flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400", crCustomTokenAddress && !isAddress(crCustomTokenAddress) ? "border-red-400" : "")}
                />
                <input
                  type="number" min={0} max={18} value={crCustomDecimals} onChange={e => setCrCustomDecimals(e.target.value)}
                  placeholder="Decimals"
                  className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            )}
            {crToken === "eth" && (
              <p className="text-xs text-muted-foreground">ETH will be sent to the raffle contract (tx 1), then the raffle is created (tx 2).</p>
            )}
          </div>
        )}

        {/* Duration */}
        {crSponsorAppId === null && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">Duration</p>
            <div className="flex rounded-lg border overflow-hidden text-sm font-semibold">
              {DURATION_OPTIONS.map((opt, i) => (
                <button key={opt.label} onClick={() => setCrDurationIdx(i)}
                  className={cn("flex-1 py-2 transition-colors", crDurationIdx === i ? "bg-amber-500 text-white" : "bg-white text-amber-700 hover:bg-amber-50")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {DURATION_OPTIONS[crDurationIdx]?.seconds === 0 && (
              <input type="number" min={1} value={crCustomHours} onChange={e => setCrCustomHours(e.target.value)}
                placeholder="Hours" className="w-32 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            )}
          </div>
        )}

        {/* Winners + prizes */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Winners & Prizes</p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-24 shrink-0">Winner count</label>
            <input type="number" min={1} max={20} value={crWinnerCount} onChange={e => handleWinnerCountChange(e.target.value)}
              className="w-20 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          {crSponsorAppId !== null && (() => {
            const sponsorPool = Number([...activeSponsors, ...missedSponsors].find(s => s.appId === crSponsorAppId)?.prizePaid ?? 0n) / 1e6
            const allocated   = crPrizes.slice(0, winnerCount).reduce((a, p) => a + (parseFloat(p) || 0), 0)
            const remaining   = sponsorPool - allocated
            return (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-gray-500">Sponsor prize pool</span>
                <span className={remaining < -0.001 ? "font-bold text-red-600" : "font-bold text-amber-700"}>
                  ${sponsorPool.toFixed(2)} USDC
                  {allocated > 0 && ` · $${remaining.toFixed(2)} remaining`}
                </span>
              </div>
            )
          })()}
          <div className="space-y-1.5">
            {crPrizes.slice(0, winnerCount).map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-24 shrink-0">
                  {i === 0 ? "1st place" : i === 1 ? "2nd place" : i === 2 ? "3rd place" : `${i + 1}th place`}
                </label>
                <input
                  type="number" min={0} step="0.01" value={p}
                  onChange={e => { const next = [...crPrizes]; next[i] = e.target.value; setCrPrizes(next) }}
                  placeholder={crSponsorAppId !== null || crToken === "usdc" ? "USDC amount" : crToken === "booz" ? "BOOZ amount" : crToken === "eth" ? "ETH amount" : "Token amount"}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreateRaffle}
          disabled={isCreatingRaffle || crPrizes.slice(0, winnerCount).some(p => !p || parseFloat(p) <= 0) || (crToken === "custom" && !isAddress(crCustomTokenAddress))}
          className="w-full bg-amber-500 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {isCreatingRaffle ? "Creating..." : `Create Raffle (${
            crSponsorAppId !== null ? "Sponsor-funded" :
            crToken === "booz"   ? "1 tx" :
            crToken === "eth"    ? "2 txs" :
            "3 txs"
          })`}
        </button>
      </Section>

      </div>{/* end grid */}
    </div>
  )
}
