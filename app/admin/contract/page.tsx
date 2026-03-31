"use client"

import { useState, useEffect } from "react"
import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig, APP_CHAIN } from "@/lib/wagmi"
import { parseUnits, isAddress } from "viem"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI } from "@/lib/contract"
import { Loader2, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ── helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      <div className="rounded-xl border bg-white divide-y">{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  sub,
  current,
  unit,
  inputProps,
  value,
  onChange,
  onSave,
  saving,
  saved,
  error,
}: {
  label: string
  sub?: string
  current: string | null
  unit: string
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  value: string
  onChange: (v: string) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error?: string
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {current != null && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Current: <span className="font-mono font-semibold text-gray-700">{current} {unit}</span>
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1 mt-1">
            <AlertCircle size={11} /> {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <Input
            className="w-32 h-8 text-sm pr-8"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={saving}
            {...inputProps}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {unit}
          </span>
        </div>
        <Button
          size="sm"
          className="h-8 px-3"
          onClick={onSave}
          disabled={saving || !value}
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : saved ? (
            <Check size={13} className="text-green-500" />
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

type FieldKey =
  | "slotPrice" | "slotDuration" | "maxQueueSize"
  | "donationFeeBps"
  | "discountBurnCost" | "freeSlotCost" | "discountAmount"
  | "slotMintReward" | "donateBoozReward"
  | "mintPointReward" | "donatePointReward" | "pointsPerTicket"
  | "gmFlatDailyReward"

export default function AdminContractPage() {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "slotPrice" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "slotDuration" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "maxQueueSize" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "donationFeeBps" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "discountBurnCost" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "freeSlotCost" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "discountAmount" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "slotMintReward" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "donateBoozReward" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "mintPointReward" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "donatePointReward" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "pointsPerTicket" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "paused" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "gmFlatDailyReward" },
    ],
  })

  const [
    slotPriceRaw, slotDurationRaw, maxQueueSizeRaw,
    donationFeeBpsRaw,
    discountBurnCostRaw, freeSlotCostRaw, discountAmountRaw,
    slotMintRewardRaw, donateBoozRewardRaw,
    mintPointRewardRaw, donatePointRewardRaw, pointsPerTicketRaw,
    pausedRaw, gmFlatDailyRewardRaw,
  ] = data?.map(d => d.result) ?? []

  // Derived display values
  const currentSlotPrice    = slotPriceRaw     != null ? (Number(slotPriceRaw) / 1e6).toFixed(2) : null
  const currentDurationMin  = slotDurationRaw  != null ? String(Math.round(Number(slotDurationRaw) / 60)) : null
  const currentMaxQueue     = maxQueueSizeRaw  != null ? String(Number(maxQueueSizeRaw)) : null
  const currentFeePct       = donationFeeBpsRaw != null ? (Number(donationFeeBpsRaw) / 100).toFixed(2) : null
  const currentDiscBurn     = discountBurnCostRaw != null ? (Number(discountBurnCostRaw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null
  const currentFreeSlot     = freeSlotCostRaw   != null ? (Number(freeSlotCostRaw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null
  const currentDiscAmount   = discountAmountRaw != null ? (Number(discountAmountRaw) / 1e6).toFixed(2) : null
  const currentMintReward   = slotMintRewardRaw != null ? (Number(slotMintRewardRaw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null
  const currentDonateBooz   = donateBoozRewardRaw != null ? (Number(donateBoozRewardRaw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null
  const currentMintPts      = mintPointRewardRaw  != null ? String(Number(mintPointRewardRaw)) : null
  const currentDonatePts    = donatePointRewardRaw != null ? String(Number(donatePointRewardRaw)) : null
  const currentPtsPerTicket = pointsPerTicketRaw  != null ? String(Number(pointsPerTicketRaw)) : null
  const isPaused            = pausedRaw as boolean | undefined
  const currentGmFlat       = gmFlatDailyRewardRaw != null ? (Number(gmFlatDailyRewardRaw as bigint) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null

  // Input state
  const [inputs, setInputs] = useState<Record<FieldKey, string>>({
    slotPrice: "", slotDuration: "", maxQueueSize: "",
    donationFeeBps: "",
    discountBurnCost: "", freeSlotCost: "", discountAmount: "",
    slotMintReward: "", donateBoozReward: "",
    mintPointReward: "", donatePointReward: "", pointsPerTicket: "",
    gmFlatDailyReward: "",
  })

  // GM array inputs (comma-separated)
  const [gmDayInput, setGmDayInput]           = useState("")
  const [gmMilestoneInput, setGmMilestoneInput] = useState("")
  const [isGmDaySaving, setIsGmDaySaving]     = useState(false)
  const [isGmMilestoneSaving, setIsGmMilestoneSaving] = useState(false)
  const [gmDayError, setGmDayError]           = useState("")
  const [gmMilestoneError, setGmMilestoneError] = useState("")

  // Content type image
  const [ctType, setCtType]       = useState("")
  const [ctImageUrl, setCtImageUrl] = useState("")
  const [isCtSaving, setIsCtSaving] = useState(false)
  const [ctSaved, setCtSaved]     = useState(false)
  const [ctError, setCtError]     = useState("")

  // Emergency / withdraw
  const [withdrawTokenAddr, setWithdrawTokenAddr] = useState("")
  const [isActioning, setIsActioning]             = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [pendingField, setPendingField] = useState<FieldKey | null>(null)
  const [savedField, setSavedField] = useState<FieldKey | null>(null)

  const setInput = (field: FieldKey, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  // Single write contract hook (for settings rows)
  const { writeContract, data: txHash, isPending: isWritePending, reset: resetWrite, error: writeError } = useWriteContract()
  // Async write hook for action buttons (pause, withdraw, etc.)
  const { writeContractAsync } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  const saving = isWritePending || isConfirming

  // On success, clear pending + flash saved
  useEffect(() => {
    if (isConfirmed && pendingField) {
      setSavedField(pendingField)
      setPendingField(null)
      resetWrite()
      setInputs(prev => ({ ...prev, [pendingField]: "" }))
      refetch()
      const field = pendingField
      setTimeout(() => setSavedField(f => f === field ? null : f), 2000)
    }
  }, [isConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Write error → show on field
  useEffect(() => {
    if (writeError && pendingField) {
      const msg = (writeError as Error).message?.split("\n")[0] ?? "Transaction failed"
      setErrors(prev => ({ ...prev, [pendingField]: msg }))
      setPendingField(null)
      resetWrite()
    }
  }, [writeError]) // eslint-disable-line react-hooks/exhaustive-deps

  function save(field: FieldKey) {
    const raw = inputs[field].trim()
    if (!raw) return

    setPendingField(field)
    setErrors(prev => ({ ...prev, [field]: undefined }))

    try {
      switch (field) {
        // USDC 6 decimals
        case "slotPrice":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setSlotPrice", args: [parseUnits(raw, 6)] })
          break
        // seconds (input = minutes)
        case "slotDuration":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setSlotDuration", args: [BigInt(Math.round(Number(raw) * 60))] })
          break
        case "maxQueueSize":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setMaxQueueSize", args: [BigInt(raw)] })
          break
        // bps (input = %)
        case "donationFeeBps":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setDonationFeeBps", args: [BigInt(Math.round(Number(raw) * 100))] })
          break
        // BOOZ 18 decimals
        case "discountBurnCost":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setDiscountBurnCost", args: [parseUnits(raw, 18)] })
          break
        case "freeSlotCost":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setFreeSlotCost", args: [parseUnits(raw, 18)] })
          break
        // USDC 6 decimals
        case "discountAmount":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setDiscountAmount", args: [parseUnits(raw, 6)] })
          break
        // BOOZ 18 decimals
        case "slotMintReward":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setSlotMintReward", args: [parseUnits(raw, 18)] })
          break
        case "donateBoozReward":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setDonateBoozReward", args: [parseUnits(raw, 18)] })
          break
        // Raw integers
        case "mintPointReward":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setMintPointReward", args: [BigInt(raw)] })
          break
        case "donatePointReward":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setDonatePointReward", args: [BigInt(raw)] })
          break
        case "pointsPerTicket":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setPointsPerTicket", args: [BigInt(raw)] })
          break
        // BOOZ 18 decimals
        case "gmFlatDailyReward":
          writeContract({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setGMFlatDailyReward", args: [parseUnits(raw, 18)] })
          break
      }
    } catch {
      setErrors(prev => ({ ...prev, [field]: "Invalid value" }))
      setPendingField(null)
    }
  }

  async function handleAction(action: string) {
    setIsActioning(action)
    try {
      let tx: `0x${string}`
      if (action === "pause") {
        tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "pause", chainId: APP_CHAIN.id })
      } else if (action === "unpause") {
        tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "unpause", chainId: APP_CHAIN.id })
      } else if (action === "advanceCursor") {
        tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "advanceCursor", chainId: APP_CHAIN.id })
      } else if (action === "withdraw") {
        tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "withdraw", chainId: APP_CHAIN.id })
      } else if (action === "withdrawETH") {
        tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "withdrawETH", chainId: APP_CHAIN.id })
      } else if (action === "withdrawToken") {
        if (!withdrawTokenAddr || !isAddress(withdrawTokenAddr)) return
        tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "withdrawToken", args: [withdrawTokenAddr as `0x${string}`], chainId: APP_CHAIN.id })
      } else return
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      refetch()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
    } finally { setIsActioning(null) }
  }

  async function handleGMDayRewards() {
    const parts = gmDayInput.split(",").map(s => s.trim())
    if (parts.length !== 7 || parts.some(p => isNaN(Number(p)) || Number(p) < 0)) {
      setGmDayError("Enter exactly 7 comma-separated BOOZ values (days 1–7)")
      return
    }
    setGmDayError("")
    setIsGmDaySaving(true)
    try {
      const args = parts.map(p => parseUnits(p, 18)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint]
      const tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setGMDayRewards", args: [args], chainId: APP_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setGmDayInput("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) setGmDayError("Transaction failed")
    }
    finally { setIsGmDaySaving(false) }
  }

  async function handleGMMilestoneRewards() {
    const parts = gmMilestoneInput.split(",").map(s => s.trim())
    if (parts.length !== 5 || parts.some(p => isNaN(Number(p)) || Number(p) < 0)) {
      setGmMilestoneError("Enter exactly 5 comma-separated BOOZ values (days 7/14/30/60/90)")
      return
    }
    setGmMilestoneError("")
    setIsGmMilestoneSaving(true)
    try {
      const args = parts.map(p => parseUnits(p, 18)) as [bigint, bigint, bigint, bigint, bigint]
      const tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setGMMilestoneRewards", args: [args], chainId: APP_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setGmMilestoneInput("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) setGmMilestoneError("Transaction failed")
    }
    finally { setIsGmMilestoneSaving(false) }
  }

  async function handleContentTypeImage() {
    if (!ctType.trim() || !ctImageUrl.trim()) { setCtError("Both fields required"); return }
    setCtError("")
    setIsCtSaving(true)
    try {
      const tx = await writeContractAsync({ address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "setContentTypeImage", args: [ctType.trim(), ctImageUrl.trim()], chainId: APP_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setCtSaved(true)
      setTimeout(() => setCtSaved(false), 2000)
      setCtType(""); setCtImageUrl("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) setCtError("Transaction failed")
    }
    finally { setIsCtSaving(false) }
  }

  function rowProps(field: FieldKey) {
    return {
      value: inputs[field],
      onChange: (v: string) => setInput(field, v),
      onSave: () => save(field),
      saving: saving && pendingField === field,
      saved: savedField === field,
      error: errors[field],
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 size={15} className="animate-spin" /> Loading contract state…
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-xl font-bold text-gray-900">Contract Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Adjust on-chain parameters. Each save sends a transaction.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left column */}
        <div className="space-y-6">

          {/* Slot Settings */}
          <Section title="Slot Settings">
            <SettingRow
              label="Slot Price"
              sub="Price users pay to mint a content slot"
              current={currentSlotPrice}
              unit="USDC"
              inputProps={{ type: "number", min: "0", step: "0.01", placeholder: "1.00" }}
              {...rowProps("slotPrice")}
            />
            <SettingRow
              label="Slot Duration"
              sub="How long each slot stays featured"
              current={currentDurationMin != null ? `${currentDurationMin} min` : null}
              unit="min"
              inputProps={{ type: "number", min: "1", step: "1", placeholder: "15" }}
              {...rowProps("slotDuration")}
            />
            <SettingRow
              label="Max Queue Size"
              sub="Maximum number of slots that can be queued at once"
              current={currentMaxQueue}
              unit="slots"
              inputProps={{ type: "number", min: "1", step: "1", placeholder: "50" }}
              {...rowProps("maxQueueSize")}
            />
          </Section>

          {/* Fee Settings */}
          <Section title="Fees">
            <SettingRow
              label="Donation Fee"
              sub="Platform keeps this % of every donation (max 10%)"
              current={currentFeePct != null ? `${currentFeePct}%` : null}
              unit="%"
              inputProps={{ type: "number", min: "0", max: "10", step: "0.01", placeholder: "5.00" }}
              {...rowProps("donationFeeBps")}
            />
          </Section>

          {/* Burn Paths */}
          <Section title="Burn Paths">
            <SettingRow
              label="Discount Burn Cost"
              sub="BOOZ burned for the 10% discount mint path"
              current={currentDiscBurn}
              unit="BOOZ"
              inputProps={{ type: "number", min: "0", step: "1", placeholder: "1000" }}
              {...rowProps("discountBurnCost")}
            />
            <SettingRow
              label="Discount Amount"
              sub="USDC price reduction on the discount path"
              current={currentDiscAmount}
              unit="USDC"
              inputProps={{ type: "number", min: "0", step: "0.01", placeholder: "0.10" }}
              {...rowProps("discountAmount")}
            />
            <SettingRow
              label="Free Slot Cost"
              sub="BOOZ burned to mint a free slot (no BOOZ earned)"
              current={currentFreeSlot}
              unit="BOOZ"
              inputProps={{ type: "number", min: "0", step: "1", placeholder: "10000" }}
              {...rowProps("freeSlotCost")}
            />
          </Section>

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* BOOZ Rewards */}
          <Section title="BOOZ Rewards">
            <SettingRow
              label="Slot Mint Reward"
              sub="BOOZ minted to user when they mint a slot"
              current={currentMintReward}
              unit="BOOZ"
              inputProps={{ type: "number", min: "0", step: "1", placeholder: "1000" }}
              {...rowProps("slotMintReward")}
            />
            <SettingRow
              label="Donate BOOZ Reward"
              sub="BOOZ earned on first donation per 24h (donor ≠ creator)"
              current={currentDonateBooz}
              unit="BOOZ"
              inputProps={{ type: "number", min: "0", step: "1", placeholder: "1000" }}
              {...rowProps("donateBoozReward")}
            />
          </Section>

          {/* Points */}
          <Section title="Points">
            <SettingRow
              label="Mint Point Reward"
              sub="Points earned when minting a slot"
              current={currentMintPts}
              unit="pts"
              inputProps={{ type: "number", min: "0", step: "1", placeholder: "100" }}
              {...rowProps("mintPointReward")}
            />
            <SettingRow
              label="Donate Point Reward"
              sub="Points earned when donating"
              current={currentDonatePts}
              unit="pts"
              inputProps={{ type: "number", min: "0", step: "1", placeholder: "5" }}
              {...rowProps("donatePointReward")}
            />
            <SettingRow
              label="Points Per Ticket"
              sub="Points needed to convert into 1 raffle ticket"
              current={currentPtsPerTicket}
              unit="pts"
              inputProps={{ type: "number", min: "1", step: "1", placeholder: "100" }}
              {...rowProps("pointsPerTicket")}
            />
          </Section>

          {/* GM Rewards */}
          <Section title="GM Rewards" description="Daily streak BOOZ rewards. Changes take effect on the next claim.">
            <SettingRow
              label="Flat Daily Reward (day 8+)"
              sub="BOOZ per day after the first 7-day cycle"
              current={currentGmFlat}
              unit="BOOZ"
              inputProps={{ type: "number", min: "0", step: "1", placeholder: "50" }}
              {...rowProps("gmFlatDailyReward")}
            />
            <div className="px-4 py-3 space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-800">Day 1–7 Rewards</p>
                <p className="text-xs text-muted-foreground">7 comma-separated BOOZ values (e.g. 5,10,15,20,25,30,35)</p>
              </div>
              <div className="flex gap-2">
                <Input
                  className="flex-1 h-8 text-sm"
                  placeholder="5,10,15,20,25,30,35"
                  value={gmDayInput}
                  onChange={e => { setGmDayInput(e.target.value); setGmDayError("") }}
                  disabled={isGmDaySaving}
                />
                <Button size="sm" className="h-8 px-3" onClick={handleGMDayRewards} disabled={isGmDaySaving || !gmDayInput}>
                  {isGmDaySaving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
                </Button>
              </div>
              {gmDayError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{gmDayError}</p>}
            </div>
            <div className="px-4 py-3 space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-800">Milestone Bonuses (day 7/14/30/60/90)</p>
                <p className="text-xs text-muted-foreground">5 comma-separated BOOZ values (e.g. 50,250,350,500,4560)</p>
              </div>
              <div className="flex gap-2">
                <Input
                  className="flex-1 h-8 text-sm"
                  placeholder="50,250,350,500,4560"
                  value={gmMilestoneInput}
                  onChange={e => { setGmMilestoneInput(e.target.value); setGmMilestoneError("") }}
                  disabled={isGmMilestoneSaving}
                />
                <Button size="sm" className="h-8 px-3" onClick={handleGMMilestoneRewards} disabled={isGmMilestoneSaving || !gmMilestoneInput}>
                  {isGmMilestoneSaving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
                </Button>
              </div>
              {gmMilestoneError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{gmMilestoneError}</p>}
            </div>
          </Section>

          {/* Content Type Image */}
          <Section title="Content Type NFT Image" description="Override the NFT image URL for a content type. Pass an empty imageUrl to remove the override.">
            <div className="px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Content type</p>
                  <Input
                    className="h-8 text-sm"
                    placeholder="youtube"
                    value={ctType}
                    onChange={e => { setCtType(e.target.value); setCtError("") }}
                    disabled={isCtSaving}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Image URL</p>
                  <Input
                    className="h-8 text-sm"
                    placeholder="https://…"
                    value={ctImageUrl}
                    onChange={e => { setCtImageUrl(e.target.value); setCtError("") }}
                    disabled={isCtSaving}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" className="h-8 px-3" onClick={handleContentTypeImage} disabled={isCtSaving || !ctType || !ctImageUrl}>
                  {isCtSaving ? <Loader2 size={13} className="animate-spin" /> : ctSaved ? <Check size={13} className="text-green-500" /> : "Save"}
                </Button>
              </div>
              {ctError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{ctError}</p>}
            </div>
          </Section>

        </div>

      </div>

      {/* Emergency Controls + Withdraw — full-width row below the settings grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        <Section title="Emergency Controls" description="Pause halts all user-facing actions (mint, donate, GM claim). advanceCursor manually expires stale slots.">
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Contract State</p>
                {isPaused != null && (
                  <p className="text-xs mt-0.5">
                    Currently{" "}
                    <span className={isPaused ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                      {isPaused ? "PAUSED" : "Active"}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="destructive" className="h-8 px-3"
                  onClick={() => handleAction("pause")}
                  disabled={isActioning !== null || isPaused === true}
                >
                  {isActioning === "pause" ? <Loader2 size={13} className="animate-spin" /> : "Pause"}
                </Button>
                <Button
                  size="sm" className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleAction("unpause")}
                  disabled={isActioning !== null || isPaused === false}
                >
                  {isActioning === "unpause" ? <Loader2 size={13} className="animate-spin" /> : "Unpause"}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Advance Cursor</p>
                <p className="text-xs text-muted-foreground">Manually expire stale slots</p>
              </div>
              <Button
                size="sm" variant="outline" className="h-8 px-3"
                onClick={() => handleAction("advanceCursor")}
                disabled={isActioning !== null}
              >
                {isActioning === "advanceCursor" ? <Loader2 size={13} className="animate-spin" /> : "Advance"}
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Withdraw" description="Withdraw accumulated mint and donation fees from the Booztory contract to the owner wallet.">
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Withdraw USDC Fees</p>
                <p className="text-xs text-muted-foreground">Transfers all paymentToken balance to owner</p>
              </div>
              <Button size="sm" className="h-8 px-3" onClick={() => handleAction("withdraw")} disabled={isActioning !== null}>
                {isActioning === "withdraw" ? <Loader2 size={13} className="animate-spin" /> : "Withdraw"}
              </Button>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Withdraw ETH</p>
                <p className="text-xs text-muted-foreground">For ETH payment mode or accidental ETH sends</p>
              </div>
              <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => handleAction("withdrawETH")} disabled={isActioning !== null}>
                {isActioning === "withdrawETH" ? <Loader2 size={13} className="animate-spin" /> : "Withdraw ETH"}
              </Button>
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">Recover ERC-20 Token</p>
              <p className="text-xs text-muted-foreground">Emergency recovery for non-paymentToken ERC-20s</p>
              <div className="flex gap-2">
                <Input
                  className="flex-1 h-8 text-sm font-mono"
                  placeholder="ERC-20 address (0x…)"
                  value={withdrawTokenAddr}
                  onChange={e => setWithdrawTokenAddr(e.target.value)}
                  disabled={isActioning !== null}
                />
                <Button
                  size="sm" variant="outline" className="h-8 px-3"
                  onClick={() => handleAction("withdrawToken")}
                  disabled={isActioning !== null || !isAddress(withdrawTokenAddr)}
                >
                  {isActioning === "withdrawToken" ? <Loader2 size={13} className="animate-spin" /> : "Recover"}
                </Button>
              </div>
            </div>
          </div>
        </Section>

      </div>

    </div>
  )
}
