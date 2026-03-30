"use client"

import { useState, useEffect } from "react"
import { useReadContract, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig, APP_CHAIN } from "@/lib/wagmi"
import { isAddress } from "viem"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { BadgeCheck, Ban } from "lucide-react"

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

// ── Check row — reads approvedNFTContracts for a single address ────────────────

function ApprovalStatus({ address: nftAddress, onRevoke, revoking }: {
  address: string
  onRevoke: () => void
  revoking: boolean
}) {
  const { data: approved, isLoading } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "approvedNFTContracts",
    args: [nftAddress as `0x${string}`],
    chainId: APP_CHAIN.id,
  })

  if (isLoading) return <p className="text-xs text-muted-foreground">Checking…</p>

  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        {approved
          ? <BadgeCheck size={15} className="text-emerald-500 shrink-0" />
          : <Ban size={15} className="text-gray-400 shrink-0" />
        }
        <span className="text-xs font-mono text-gray-700 truncate">{nftAddress}</span>
      </div>
      <span className={cn("text-[11px] font-semibold ml-3 shrink-0", approved ? "text-emerald-600" : "text-gray-400")}>
        {approved ? "Approved" : "Revoked"}
      </span>
      {approved && (
        <button
          onClick={onRevoke}
          disabled={revoking}
          className="ml-3 text-[11px] text-red-500 hover:text-red-700 font-semibold disabled:opacity-50 shrink-0"
        >
          {revoking ? "Revoking…" : "Revoke"}
        </button>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminNFTPage() {
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const [approveInput, setApproveInput]     = useState("")
  const [isApproving, setIsApproving]       = useState(false)
  const [approvedList, setApprovedList]     = useState<string[]>([])
  const [revokingAddr, setRevokingAddr]     = useState<string | null>(null)
  const [checkInput, setCheckInput]         = useState("")
  const [checkedAddr, setCheckedAddr]       = useState<string | null>(null)

  const { data: onChainList, refetch: refetchList } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getApprovedNFTContracts",
    chainId: APP_CHAIN.id,
  })

  useEffect(() => {
    if (onChainList) setApprovedList((onChainList as string[]).map(a => a.toLowerCase()))
  }, [onChainList])

  const approveInputValid = isAddress(approveInput)

  async function handleApprove() {
    if (!approveInputValid) return
    setIsApproving(true)
    try {
      const tx = await writeContractAsync({
        address: BOOZTORY_ADDRESS,
        abi: BOOZTORY_ABI,
        functionName: "setNFTContract",
        args: [approveInput as `0x${string}`, true],
        chainId: APP_CHAIN.id,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setApproveInput("")
      await refetchList()
      toast({ title: "NFT Contract Approved", description: `${approveInput.slice(0, 10)}… can now grant perks to holders.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setIsApproving(false) }
  }

  async function handleRevoke(addr: string) {
    setRevokingAddr(addr)
    try {
      const tx = await writeContractAsync({
        address: BOOZTORY_ADDRESS,
        abi: BOOZTORY_ABI,
        functionName: "setNFTContract",
        args: [addr as `0x${string}`, false],
        chainId: APP_CHAIN.id,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      await refetchList()
      toast({ title: "NFT Contract Revoked", description: `${addr.slice(0, 10)}… perks disabled.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.toLowerCase().includes("rejected")) return
      toast({ title: "Failed", description: "Transaction failed.", variant: "destructive" })
    } finally { setRevokingAddr(null) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">NFT Pass</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Approve ERC-721 collections to grant platform perks to their holders.</p>
      </div>

      {/* Perk summary */}
      <div className="rounded-xl border bg-amber-50 border-amber-100 p-4 space-y-2 text-sm">
        <p className="font-bold text-amber-900 text-xs uppercase tracking-wide">Perks per NFT token ID</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-800">
          <div className="bg-white rounded-lg px-3 py-2 border border-amber-100">
            <p className="font-bold">50% Discount Mint</p>
            <p className="text-amber-600 mt-0.5">Once per 24h · 1 raffle ticket · No BOOZ earned</p>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 border border-amber-100">
            <p className="font-bold">Free Mint</p>
            <p className="text-amber-600 mt-0.5">Once per 30 days · 1 raffle ticket · Cooldown stays on transfer</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Approve */}
        <Section
          title="Approve NFT Collection"
          description="The NFT contract does not need to exist yet. Approve now, activate later by deploying the collection."
        >
          <div className="flex gap-2">
            <input
              value={approveInput}
              onChange={e => setApproveInput(e.target.value)}
              placeholder="ERC-721 contract address (0x…)"
              className={cn(
                "flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400",
                approveInput && !approveInputValid ? "border-red-400" : ""
              )}
            />
            <button
              onClick={handleApprove}
              disabled={isApproving || !approveInputValid}
              className="bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isApproving ? "Approving…" : "Approve"}
            </button>
          </div>
          {approveInput && !approveInputValid && (
            <p className="text-xs text-red-500">Invalid address</p>
          )}
        </Section>

        {/* Check any address */}
        <Section
          title="Check Approval Status"
          description="Verify whether any ERC-721 contract is currently approved."
        >
          <div className="flex gap-2">
            <input
              value={checkInput}
              onChange={e => setCheckInput(e.target.value)}
              placeholder="ERC-721 contract address (0x…)"
              className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={() => setCheckedAddr(isAddress(checkInput) ? checkInput.toLowerCase() : null)}
              disabled={!isAddress(checkInput)}
              className="bg-gray-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              Check
            </button>
          </div>
          {checkedAddr && (
            <ApprovalStatus
              address={checkedAddr}
              onRevoke={() => handleRevoke(checkedAddr)}
              revoking={revokingAddr === checkedAddr}
            />
          )}
        </Section>

      </div>

      {/* Approved contracts — loaded from chain */}
      <Section
        title="Approved Collections"
        description={approvedList.length === 0 ? "No collections approved yet." : `${approvedList.length} collection${approvedList.length === 1 ? "" : "s"} currently approved on-chain.`}
      >
        {approvedList.length === 0 ? (
          <p className="text-xs text-muted-foreground">Approve a collection above to see it here.</p>
        ) : (
          <div className="space-y-2">
            {approvedList.map(addr => (
              <ApprovalStatus
                key={addr}
                address={addr}
                onRevoke={() => handleRevoke(addr)}
                revoking={revokingAddr === addr}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
