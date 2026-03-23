"use client"

import { useState, useEffect } from "react"
import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseUnits } from "viem"
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
    ],
  })

  const [
    slotPriceRaw, slotDurationRaw, maxQueueSizeRaw,
    donationFeeBpsRaw,
    discountBurnCostRaw, freeSlotCostRaw, discountAmountRaw,
    slotMintRewardRaw, donateBoozRewardRaw,
    mintPointRewardRaw, donatePointRewardRaw, pointsPerTicketRaw,
  ] = data?.map(d => d.result as bigint | undefined) ?? []

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

  // Input state
  const [inputs, setInputs] = useState<Record<FieldKey, string>>({
    slotPrice: "", slotDuration: "", maxQueueSize: "",
    donationFeeBps: "",
    discountBurnCost: "", freeSlotCost: "", discountAmount: "",
    slotMintReward: "", donateBoozReward: "",
    mintPointReward: "", donatePointReward: "", pointsPerTicket: "",
  })
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [pendingField, setPendingField] = useState<FieldKey | null>(null)
  const [savedField, setSavedField] = useState<FieldKey | null>(null)

  const setInput = (field: FieldKey, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  // Single write contract hook
  const { writeContract, data: txHash, isPending: isWritePending, reset: resetWrite, error: writeError } = useWriteContract()
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
      }
    } catch {
      setErrors(prev => ({ ...prev, [field]: "Invalid value" }))
      setPendingField(null)
    }
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

        </div>

      </div>

    </div>
  )
}
