"use client"

import { useState, useEffect } from "react"
import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig, WORLD_CHAIN } from "@/lib/wagmi"
import { parseUnits, isAddress } from "viem"
import { WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI } from "@/lib/contractWorld"
import { Loader2, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      <div className="rounded-xl border bg-white divide-y">{children}</div>
    </section>
  )
}

function SettingRow({
  label, sub, current, unit, inputProps, value, onChange, onSave, saving, saved, error,
}: {
  label: string; sub?: string; current: string | null; unit: string
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  value: string; onChange: (v: string) => void; onSave: () => void
  saving: boolean; saved: boolean; error?: string
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
          <Input className="w-32 h-8 text-sm pr-8" value={value} onChange={e => onChange(e.target.value)} disabled={saving} {...inputProps} />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{unit}</span>
        </div>
        <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={onSave} disabled={saving || !value}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} className="text-green-500" /> : "Save"}
        </Button>
      </div>
    </div>
  )
}

type FieldKey =
  | "slotPrice" | "slotDuration" | "maxQueueSize"
  | "donationFeeBps"
  | "discountBurnCost" | "freeSlotCost" | "discountAmount"
  | "slotMintReward" | "donateBoozReward"
  | "mintPointReward" | "donatePointReward" | "pointsPerTicket"
  | "gmFlatDailyReward"

export default function WorldContractPage() {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "slotPrice",        chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "slotDuration",     chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "maxQueueSize",     chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "donationFeeBps",   chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "discountBurnCost", chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "freeSlotCost",     chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "discountAmount",   chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "slotMintReward",   chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "donateBoozReward", chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "mintPointReward",  chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "donatePointReward",chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "pointsPerTicket",  chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "paused",           chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "gmFlatDailyReward",chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "rewardToken",       chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "raffle",            chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "paymentToken",      chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "wldToken",          chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "wldOracle",         chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "ethOracle",         chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "getSlotPriceInWLD", chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "getSlotPriceInETH", chainId: WORLD_CHAIN.id },
    ],
  })

  const [
    slotPriceRaw, slotDurationRaw, maxQueueSizeRaw,
    donationFeeBpsRaw,
    discountBurnCostRaw, freeSlotCostRaw, discountAmountRaw,
    slotMintRewardRaw, donateBoozRewardRaw,
    mintPointRewardRaw, donatePointRewardRaw, pointsPerTicketRaw,
    pausedRaw, gmFlatDailyRewardRaw,
    rewardTokenRaw, raffleRaw, paymentTokenRaw,
    wldTokenRaw, wldOracleRaw, ethOracleRaw,
    slotPriceWldRaw, slotPriceEthRaw,
  ] = data?.map(d => d.result) ?? []

  const currentSlotPrice    = slotPriceRaw     != null ? (Number(slotPriceRaw) / 1e6).toFixed(2) : null
  const currentDurationMin  = slotDurationRaw  != null ? String(Math.round(Number(slotDurationRaw) / 60)) : null
  const currentMaxQueue     = maxQueueSizeRaw  != null ? String(Number(maxQueueSizeRaw)) : null
  const currentFeePct       = donationFeeBpsRaw != null ? (Number(donationFeeBpsRaw) / 100).toFixed(2) : null
  const currentDiscBurn     = discountBurnCostRaw != null ? (Number(discountBurnCostRaw as bigint) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null
  const currentFreeSlot     = freeSlotCostRaw   != null ? (Number(freeSlotCostRaw as bigint) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null
  const currentDiscAmount   = discountAmountRaw != null ? (Number(discountAmountRaw) / 1e6).toFixed(2) : null
  const currentMintReward   = slotMintRewardRaw != null ? (Number(slotMintRewardRaw as bigint) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null
  const currentDonateBooz   = donateBoozRewardRaw != null ? (Number(donateBoozRewardRaw as bigint) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null
  const currentMintPts      = mintPointRewardRaw  != null ? String(Number(mintPointRewardRaw)) : null
  const currentDonatePts    = donatePointRewardRaw != null ? String(Number(donatePointRewardRaw)) : null
  const currentPtsPerTicket = pointsPerTicketRaw  != null ? String(Number(pointsPerTicketRaw)) : null
  const isPaused            = pausedRaw as boolean | undefined
  const currentGmFlat       = gmFlatDailyRewardRaw != null ? (Number(gmFlatDailyRewardRaw as bigint) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null

  const [inputs, setInputs] = useState<Record<FieldKey, string>>({
    slotPrice: "", slotDuration: "", maxQueueSize: "",
    donationFeeBps: "",
    discountBurnCost: "", freeSlotCost: "", discountAmount: "",
    slotMintReward: "", donateBoozReward: "",
    mintPointReward: "", donatePointReward: "", pointsPerTicket: "",
    gmFlatDailyReward: "",
  })

  const [gmDayInput, setGmDayInput]               = useState("")
  const [gmMilestoneInput, setGmMilestoneInput]   = useState("")
  const [isGmDaySaving, setIsGmDaySaving]         = useState(false)
  const [isGmMilestoneSaving, setIsGmMilestoneSaving] = useState(false)
  const [gmDayError, setGmDayError]               = useState("")
  const [gmMilestoneError, setGmMilestoneError]   = useState("")

  const [ctType, setCtType]         = useState("")
  const [ctImageUrl, setCtImageUrl] = useState("")
  const [isCtSaving, setIsCtSaving] = useState(false)
  const [ctSaved, setCtSaved]       = useState(false)
  const [ctError, setCtError]       = useState("")

  const currentSlotPriceWld = slotPriceWldRaw != null ? (Number(slotPriceWldRaw as bigint) / 1e18).toFixed(4) : null
  const currentSlotPriceEth = slotPriceEthRaw != null ? (Number(slotPriceEthRaw as bigint) / 1e18).toFixed(6) : null

  const [withdrawTokenAddr, setWithdrawTokenAddr] = useState("")
  const [newRewardToken, setNewRewardToken]       = useState("")
  const [newRaffleAddr, setNewRaffleAddr]         = useState("")
  const [newPaymentToken, setNewPaymentToken]     = useState("")
  const [newPaymentPrice, setNewPaymentPrice]     = useState("")
  const [newWldToken, setNewWldToken]             = useState("")
  const [newWldOracle, setNewWldOracle]           = useState("")
  const [newEthOracle, setNewEthOracle]           = useState("")
  const [worldIdAddr, setWorldIdAddr]             = useState("")
  const [worldIdAppId, setWorldIdAppId]           = useState("")
  const [worldIdAction, setWorldIdAction]         = useState("")
  const [isActioning, setIsActioning]             = useState<string | null>(null)
  const [errors, setErrors]                       = useState<Partial<Record<FieldKey, string>>>({})
  const [pendingField, setPendingField]           = useState<FieldKey | null>(null)
  const [savedField, setSavedField]               = useState<FieldKey | null>(null)

  const setInput = (field: FieldKey, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const { writeContract, data: txHash, isPending: isWritePending, reset: resetWrite, error: writeError } = useWriteContract()
  const { writeContractAsync } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })
  const saving = isWritePending || isConfirming

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
        case "slotPrice":        writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setSlotPrice",        args: [parseUnits(raw, 6)],                              chainId: WORLD_CHAIN.id }); break
        case "slotDuration":     writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setSlotDuration",     args: [BigInt(Math.round(Number(raw) * 60))],            chainId: WORLD_CHAIN.id }); break
        case "maxQueueSize":     writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setMaxQueueSize",     args: [BigInt(raw)],                                     chainId: WORLD_CHAIN.id }); break
        case "donationFeeBps":   writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setDonationFeeBps",   args: [BigInt(Math.round(Number(raw) * 100))],           chainId: WORLD_CHAIN.id }); break
        case "discountBurnCost": writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setDiscountBurnCost", args: [parseUnits(raw, 18)],                             chainId: WORLD_CHAIN.id }); break
        case "freeSlotCost":     writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setFreeSlotCost",     args: [parseUnits(raw, 18)],                             chainId: WORLD_CHAIN.id }); break
        case "discountAmount":   writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setDiscountAmount",   args: [parseUnits(raw, 6)],                              chainId: WORLD_CHAIN.id }); break
        case "slotMintReward":   writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setSlotMintReward",   args: [parseUnits(raw, 18)],                             chainId: WORLD_CHAIN.id }); break
        case "donateBoozReward": writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setDonateBoozReward", args: [parseUnits(raw, 18)],                             chainId: WORLD_CHAIN.id }); break
        case "mintPointReward":  writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setMintPointReward",  args: [BigInt(raw)],                                     chainId: WORLD_CHAIN.id }); break
        case "donatePointReward":writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setDonatePointReward",args: [BigInt(raw)],                                     chainId: WORLD_CHAIN.id }); break
        case "pointsPerTicket":  writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setPointsPerTicket",  args: [BigInt(raw)],                                     chainId: WORLD_CHAIN.id }); break
        case "gmFlatDailyReward":writeContract({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setGMFlatDailyReward",args: [parseUnits(raw, 18)],                             chainId: WORLD_CHAIN.id }); break
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
      if (action === "pause")
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "pause",         chainId: WORLD_CHAIN.id })
      else if (action === "unpause")
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "unpause",       chainId: WORLD_CHAIN.id })
      else if (action === "advanceCursor")
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "advanceCursor", chainId: WORLD_CHAIN.id })
      else if (action === "withdrawUSDC") {
        // withdraw(paymentToken) — USDC fees
        const token = (paymentTokenRaw as `0x${string}`) || ("0x79A02482A880bCE3F13e09Da970dC34db4CD24d1" as `0x${string}`)
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "withdraw", args: [token], chainId: WORLD_CHAIN.id })
      } else if (action === "withdrawETH") {
        // withdraw(address(0)) — ETH
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "withdraw", args: ["0x0000000000000000000000000000000000000000"], chainId: WORLD_CHAIN.id })
      } else if (action === "withdrawToken") {
        if (!withdrawTokenAddr || !isAddress(withdrawTokenAddr)) return
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "withdraw", args: [withdrawTokenAddr as `0x${string}`], chainId: WORLD_CHAIN.id })
      } else if (action === "setWldToken") {
        if (!newWldToken || !isAddress(newWldToken)) return
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setWldToken", args: [newWldToken as `0x${string}`], chainId: WORLD_CHAIN.id })
        setNewWldToken("")
      } else if (action === "setWldOracle") {
        if (!newWldOracle || !isAddress(newWldOracle)) return
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setWldOracle", args: [newWldOracle as `0x${string}`], chainId: WORLD_CHAIN.id })
        setNewWldOracle("")
      } else if (action === "setEthOracle") {
        if (!newEthOracle || !isAddress(newEthOracle)) return
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setEthOracle", args: [newEthOracle as `0x${string}`], chainId: WORLD_CHAIN.id })
        setNewEthOracle("")
      } else if (action === "setRewardToken") {
        if (!newRewardToken || !isAddress(newRewardToken)) return
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setRewardToken", args: [newRewardToken as `0x${string}`], chainId: WORLD_CHAIN.id })
        setNewRewardToken("")
      } else if (action === "setRaffle") {
        if (!newRaffleAddr || !isAddress(newRaffleAddr)) return
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setRaffle", args: [newRaffleAddr as `0x${string}`], chainId: WORLD_CHAIN.id })
        setNewRaffleAddr("")
      } else if (action === "setPaymentToken") {
        if (!newPaymentToken || !isAddress(newPaymentToken) || !newPaymentPrice) return
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setPaymentToken", args: [newPaymentToken as `0x${string}`, parseUnits(newPaymentPrice, 6)], chainId: WORLD_CHAIN.id })
        setNewPaymentToken(""); setNewPaymentPrice("")
      } else if (action === "setWorldId") {
        if (!worldIdAddr || !isAddress(worldIdAddr) || !worldIdAppId || !worldIdAction) return
        tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setWorldId", args: [worldIdAddr as `0x${string}`, worldIdAppId, worldIdAction], chainId: WORLD_CHAIN.id })
        setWorldIdAddr(""); setWorldIdAppId(""); setWorldIdAction("")
      } else return
      await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      refetch()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
    } finally { setIsActioning(null) }
  }

  async function handleGMDayRewards() {
    const parts = gmDayInput.split(",").map(s => s.trim())
    if (parts.length !== 7 || parts.some(p => isNaN(Number(p)) || Number(p) < 0)) {
      setGmDayError("Enter exactly 7 comma-separated BOOZ values (days 1–7)"); return
    }
    setGmDayError(""); setIsGmDaySaving(true)
    try {
      const args = parts.map(p => parseUnits(p, 18)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint]
      const tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setGMDayRewards", args: [args], chainId: WORLD_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      setGmDayInput("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) setGmDayError("Transaction failed")
    } finally { setIsGmDaySaving(false) }
  }

  async function handleGMMilestoneRewards() {
    const parts = gmMilestoneInput.split(",").map(s => s.trim())
    if (parts.length !== 5 || parts.some(p => isNaN(Number(p)) || Number(p) < 0)) {
      setGmMilestoneError("Enter exactly 5 comma-separated BOOZ values (days 7/14/30/60/90)"); return
    }
    setGmMilestoneError(""); setIsGmMilestoneSaving(true)
    try {
      const args = parts.map(p => parseUnits(p, 18)) as [bigint, bigint, bigint, bigint, bigint]
      const tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setGMMilestoneRewards", args: [args], chainId: WORLD_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      setGmMilestoneInput("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) setGmMilestoneError("Transaction failed")
    } finally { setIsGmMilestoneSaving(false) }
  }

  async function handleContentTypeImage() {
    if (!ctType.trim() || !ctImageUrl.trim()) { setCtError("Both fields required"); return }
    setCtError(""); setIsCtSaving(true)
    try {
      const tx = await writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setContentTypeImage", args: [ctType.trim(), ctImageUrl.trim()], chainId: WORLD_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      setCtSaved(true); setTimeout(() => setCtSaved(false), 2000)
      setCtType(""); setCtImageUrl("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) setCtError("Transaction failed")
    } finally { setIsCtSaving(false) }
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
    return <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 size={15} className="animate-spin" /> Loading…</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Contract Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Adjust on-chain parameters for BooztoryWorld.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">

          <Section title="Slot Settings">
            <SettingRow label="Slot Price" sub="Price to mint a content slot" current={currentSlotPrice} unit="USDC"
              inputProps={{ type: "number", min: "0", step: "0.01", placeholder: "1.00" }} {...rowProps("slotPrice")} />
            <SettingRow label="Slot Duration" sub="How long each slot stays featured" current={currentDurationMin != null ? `${currentDurationMin} min` : null} unit="min"
              inputProps={{ type: "number", min: "1", step: "1", placeholder: "15" }} {...rowProps("slotDuration")} />
            <SettingRow label="Max Queue Size" sub="Max number of queued slots" current={currentMaxQueue} unit="slots"
              inputProps={{ type: "number", min: "1", step: "1", placeholder: "96" }} {...rowProps("maxQueueSize")} />
            {(currentSlotPriceWld || currentSlotPriceEth) && (
              <div className="px-4 py-2 flex gap-4 text-xs text-muted-foreground bg-gray-50">
                {currentSlotPriceWld && <span>≈ <span className="font-mono font-semibold text-gray-700">{currentSlotPriceWld} WLD</span></span>}
                {currentSlotPriceEth && <span>≈ <span className="font-mono font-semibold text-gray-700">{currentSlotPriceEth} ETH</span></span>}
              </div>
            )}
          </Section>

          <Section title="Fees">
            <SettingRow label="Donation Fee" sub="Platform keeps this % of every donation (max 10%)" current={currentFeePct != null ? `${currentFeePct}%` : null} unit="%"
              inputProps={{ type: "number", min: "0", max: "10", step: "0.01", placeholder: "5.00" }} {...rowProps("donationFeeBps")} />
          </Section>

          <Section title="BOOZ Redemption">
            <SettingRow label="Discount Burn Cost" sub="BOOZ burned for -50% discount mint" current={currentDiscBurn} unit="BOOZ"
              inputProps={{ type: "number", min: "0", placeholder: "1000" }} {...rowProps("discountBurnCost")} />
            <SettingRow label="Free Slot Cost" sub="BOOZ burned for a free slot mint" current={currentFreeSlot} unit="BOOZ"
              inputProps={{ type: "number", min: "0", placeholder: "10000" }} {...rowProps("freeSlotCost")} />
            <SettingRow label="Discount Amount" sub="USDC discount applied on discount mint" current={currentDiscAmount} unit="USDC"
              inputProps={{ type: "number", min: "0", step: "0.01", placeholder: "0.50" }} {...rowProps("discountAmount")} />
          </Section>

          <Section title="Rewards">
            <SettingRow label="Slot Mint Reward" sub="BOOZ earned per slot mint" current={currentMintReward} unit="BOOZ"
              inputProps={{ type: "number", min: "0", placeholder: "1000" }} {...rowProps("slotMintReward")} />
            <SettingRow label="Donate BOOZ Reward" sub="BOOZ earned on first donation per 24h" current={currentDonateBooz} unit="BOOZ"
              inputProps={{ type: "number", min: "0", placeholder: "1000" }} {...rowProps("donateBoozReward")} />
          </Section>

          <Section title="Points">
            <SettingRow label="Mint Point Reward" sub="Points earned per slot mint" current={currentMintPts} unit="pts"
              inputProps={{ type: "number", min: "0", placeholder: "15" }} {...rowProps("mintPointReward")} />
            <SettingRow label="Donate Point Reward" sub="Points earned per donation" current={currentDonatePts} unit="pts"
              inputProps={{ type: "number", min: "0", placeholder: "5" }} {...rowProps("donatePointReward")} />
            <SettingRow label="Points per Ticket" sub="Points required to convert to 1 raffle ticket" current={currentPtsPerTicket} unit="pts"
              inputProps={{ type: "number", min: "1", placeholder: "5" }} {...rowProps("pointsPerTicket")} />
          </Section>

        </div>

        <div className="space-y-6">

          <Section title="GM Streak">
            <SettingRow label="Flat Daily Reward" sub="BOOZ per GM claim (non-milestone days)" current={currentGmFlat} unit="BOOZ"
              inputProps={{ type: "number", min: "0", placeholder: "50" }} {...rowProps("gmFlatDailyReward")} />
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">Day Rewards</p>
              <p className="text-xs text-muted-foreground">7 comma-separated BOOZ values (days 1–7)</p>
              <div className="flex gap-2">
                <Input className="flex-1 h-8 text-sm" placeholder="50,100,150,200,300,500,1000" value={gmDayInput}
                  onChange={e => setGmDayInput(e.target.value)} disabled={isGmDaySaving} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={handleGMDayRewards} disabled={isGmDaySaving || !gmDayInput}>
                  {isGmDaySaving ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </Button>
              </div>
              {gmDayError && <p className="text-xs text-destructive">{gmDayError}</p>}
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">Milestone Rewards</p>
              <p className="text-xs text-muted-foreground">5 comma-separated BOOZ values (days 7/14/30/60/90)</p>
              <div className="flex gap-2">
                <Input className="flex-1 h-8 text-sm" placeholder="500,1000,5000,10000,50000" value={gmMilestoneInput}
                  onChange={e => setGmMilestoneInput(e.target.value)} disabled={isGmMilestoneSaving} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={handleGMMilestoneRewards} disabled={isGmMilestoneSaving || !gmMilestoneInput}>
                  {isGmMilestoneSaving ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </Button>
              </div>
              {gmMilestoneError && <p className="text-xs text-destructive">{gmMilestoneError}</p>}
            </div>
          </Section>

          <Section title="Wiring">
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">Payment Token</p>
              <p className="text-xs text-muted-foreground">Current: <span className="font-mono">{paymentTokenRaw as string ?? "—"}</span></p>
              <div className="flex gap-2">
                <Input className="flex-1 h-8 text-sm font-mono" placeholder="Token address (0x…)" value={newPaymentToken}
                  onChange={e => setNewPaymentToken(e.target.value)} disabled={isActioning !== null} />
                <Input className="w-24 h-8 text-sm" placeholder="Price" value={newPaymentPrice}
                  onChange={e => setNewPaymentPrice(e.target.value)} type="number" min="0" step="0.01" disabled={isActioning !== null} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleAction("setPaymentToken")}
                  disabled={isActioning !== null || !isAddress(newPaymentToken) || !newPaymentPrice}>
                  {isActioning === "setPaymentToken" ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">Reward Token</p>
              <p className="text-xs text-muted-foreground">Current: <span className="font-mono">{rewardTokenRaw as string ?? "—"}</span></p>
              <div className="flex gap-2">
                <Input className="flex-1 h-8 text-sm font-mono" placeholder="0x token address" value={newRewardToken}
                  onChange={e => setNewRewardToken(e.target.value)} disabled={isActioning !== null} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleAction("setRewardToken")}
                  disabled={isActioning !== null || !isAddress(newRewardToken)}>
                  {isActioning === "setRewardToken" ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">Raffle Contract</p>
              <p className="text-xs text-muted-foreground">Current: <span className="font-mono">{raffleRaw as string ?? "—"}</span></p>
              <div className="flex gap-2">
                <Input className="flex-1 h-8 text-sm font-mono" placeholder="0x raffle address" value={newRaffleAddr}
                  onChange={e => setNewRaffleAddr(e.target.value)} disabled={isActioning !== null} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleAction("setRaffle")}
                  disabled={isActioning !== null || !isAddress(newRaffleAddr)}>
                  {isActioning === "setRaffle" ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">WLD Token</p>
              <p className="text-xs text-muted-foreground">Current: <span className="font-mono">{wldTokenRaw as string ?? "—"}</span></p>
              <div className="flex gap-2">
                <Input className="flex-1 h-8 text-sm font-mono" placeholder="WLD token address (0x…)" value={newWldToken}
                  onChange={e => setNewWldToken(e.target.value)} disabled={isActioning !== null} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleAction("setWldToken")}
                  disabled={isActioning !== null || !isAddress(newWldToken)}>
                  {isActioning === "setWldToken" ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">WLD/USD Oracle</p>
              <p className="text-xs text-muted-foreground">Api3 dAPI proxy — Current: <span className="font-mono">{wldOracleRaw as string ?? "—"}</span></p>
              <div className="flex gap-2">
                <Input className="flex-1 h-8 text-sm font-mono" placeholder="Api3 WLD/USD proxy (0x…)" value={newWldOracle}
                  onChange={e => setNewWldOracle(e.target.value)} disabled={isActioning !== null} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleAction("setWldOracle")}
                  disabled={isActioning !== null || !isAddress(newWldOracle)}>
                  {isActioning === "setWldOracle" ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">ETH/USD Oracle</p>
              <p className="text-xs text-muted-foreground">Api3 dAPI proxy — Current: <span className="font-mono">{ethOracleRaw as string ?? "—"}</span></p>
              <div className="flex gap-2">
                <Input className="flex-1 h-8 text-sm font-mono" placeholder="Api3 ETH/USD proxy (0x…)" value={newEthOracle}
                  onChange={e => setNewEthOracle(e.target.value)} disabled={isActioning !== null} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleAction("setEthOracle")}
                  disabled={isActioning !== null || !isAddress(newEthOracle)}>
                  {isActioning === "setEthOracle" ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">World ID Oracle</p>
              <p className="text-xs text-muted-foreground">Update verifier address, app ID, and action</p>
              <div className="space-y-2">
                <Input className="h-8 text-sm font-mono" placeholder="WorldID contract (0x…)" value={worldIdAddr}
                  onChange={e => setWorldIdAddr(e.target.value)} disabled={isActioning !== null} />
                <Input className="h-8 text-sm" placeholder="App ID (e.g. app_xyz)" value={worldIdAppId}
                  onChange={e => setWorldIdAppId(e.target.value)} disabled={isActioning !== null} />
                <div className="flex gap-2">
                  <Input className="flex-1 h-8 text-sm" placeholder="Action (e.g. verify)" value={worldIdAction}
                    onChange={e => setWorldIdAction(e.target.value)} disabled={isActioning !== null} />
                  <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleAction("setWorldId")}
                    disabled={isActioning !== null || !isAddress(worldIdAddr) || !worldIdAppId || !worldIdAction}>
                    {isActioning === "setWorldId" ? <Loader2 size={13} className="animate-spin" /> : "Set"}
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Content Type Images">
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-muted-foreground">Map a content type slug to a thumbnail image URL</p>
              <div className="flex gap-2">
                <Input className="w-28 h-8 text-sm" placeholder="Type (youtube)" value={ctType}
                  onChange={e => setCtType(e.target.value)} disabled={isCtSaving} />
                <Input className="flex-1 h-8 text-sm" placeholder="Image URL" value={ctImageUrl}
                  onChange={e => setCtImageUrl(e.target.value)} disabled={isCtSaving} />
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={handleContentTypeImage} disabled={isCtSaving || !ctType || !ctImageUrl}>
                  {isCtSaving ? <Loader2 size={13} className="animate-spin" /> : ctSaved ? <Check size={13} className="text-green-500" /> : "Set"}
                </Button>
              </div>
              {ctError && <p className="text-xs text-destructive">{ctError}</p>}
            </div>
          </Section>

          <Section title="Emergency Controls">
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Contract State</p>
                  {isPaused != null && (
                    <p className="text-xs mt-0.5">
                      Currently <span className={isPaused ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>{isPaused ? "PAUSED" : "Active"}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" className="h-8 px-3"
                    onClick={() => handleAction("pause")} disabled={isActioning !== null || isPaused === true}>
                    {isActioning === "pause" ? <Loader2 size={13} className="animate-spin" /> : "Pause"}
                  </Button>
                  <Button size="sm" className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleAction("unpause")} disabled={isActioning !== null || isPaused === false}>
                    {isActioning === "unpause" ? <Loader2 size={13} className="animate-spin" /> : "Unpause"}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Advance Cursor</p>
                  <p className="text-xs text-muted-foreground">Force the slot cursor to the next queued slot</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 px-3"
                  onClick={() => handleAction("advanceCursor")} disabled={isActioning !== null}>
                  {isActioning === "advanceCursor" ? <Loader2 size={13} className="animate-spin" /> : "Advance"}
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Withdraw">
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Withdraw USDC Fees</p>
                  <p className="text-xs text-muted-foreground">Transfers all USDC balance to owner</p>
                </div>
                <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleAction("withdrawUSDC")} disabled={isActioning !== null}>
                  {isActioning === "withdrawUSDC" ? <Loader2 size={13} className="animate-spin" /> : "Withdraw"}
                </Button>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Withdraw ETH</p>
                  <p className="text-xs text-muted-foreground">Transfers all ETH balance to owner</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => handleAction("withdrawETH")} disabled={isActioning !== null}>
                  {isActioning === "withdrawETH" ? <Loader2 size={13} className="animate-spin" /> : "Withdraw ETH"}
                </Button>
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium text-gray-800">Recover ERC-20 Token</p>
                <p className="text-xs text-muted-foreground">Withdraw WLD, BOOZ, or any ERC-20 to owner</p>
                <div className="flex gap-2">
                  <Input className="flex-1 h-8 text-sm font-mono" placeholder="ERC-20 address (0x…)"
                    value={withdrawTokenAddr} onChange={e => setWithdrawTokenAddr(e.target.value)} disabled={isActioning !== null} />
                  <Button size="sm" variant="outline" className="h-8 px-3"
                    onClick={() => handleAction("withdrawToken")}
                    disabled={isActioning !== null || !isAddress(withdrawTokenAddr)}>
                    {isActioning === "withdrawToken" ? <Loader2 size={13} className="animate-spin" /> : "Recover"}
                  </Button>
                </div>
              </div>
            </div>
          </Section>

        </div>
      </div>
    </div>
  )
}
