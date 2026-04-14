"use client"

import { useState } from "react"
import { useReadContracts, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { formatUnits, isAddress } from "viem"
import { WORLD_TOKEN_ADDRESS, WORLD_TOKEN_ABI, WORLD_BOOZTORY_ADDRESS, WORLD_RAFFLE_ADDRESS } from "@/lib/contractWorld"
import { wagmiConfig, WORLD_CHAIN } from "@/lib/wagmi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      <div className="rounded-xl border bg-white divide-y">{children}</div>
    </section>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export default function WorldTokenPage() {
  const [minterAddr, setMinterAddr]     = useState("")
  const [authorizingIdx, setAuthorizingIdx] = useState<number | null>(null)
  const [isTogglingPhase, setIsTogglingPhase] = useState(false)

  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "totalSupply",        chainId: WORLD_CHAIN.id },
      { address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "MAX_SUPPLY",         chainId: WORLD_CHAIN.id },
      { address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "treasuryMinted",     chainId: WORLD_CHAIN.id },
      { address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "soulbound",          chainId: WORLD_CHAIN.id },
      { address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "authorizedMinters",  args: [WORLD_BOOZTORY_ADDRESS], chainId: WORLD_CHAIN.id },
      { address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "authorizedMinters",  args: [WORLD_RAFFLE_ADDRESS],   chainId: WORLD_CHAIN.id },
    ],
  })

  const [totalSupplyR, maxSupplyR, treasuryMintedR, soulboundR, booztoryMinterR, raffleMinterR] =
    data?.map(d => d.result) ?? []

  const totalSupply    = totalSupplyR    as bigint  | undefined
  const maxSupply      = maxSupplyR      as bigint  | undefined
  const treasuryMinted = treasuryMintedR as bigint  | undefined
  const isSoulbound    = soulboundR      as boolean | undefined

  const fmt = (v: bigint | undefined) =>
    v != null ? Number(formatUnits(v, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"

  const KNOWN_MINTERS = [
    { label: "BooztoryWorld", address: WORLD_BOOZTORY_ADDRESS, authorized: booztoryMinterR as boolean | undefined, index: 0 },
    { label: "RaffleWorld",   address: WORLD_RAFFLE_ADDRESS,   authorized: raffleMinterR   as boolean | undefined, index: 1 },
  ]

  async function handleSetSoulbound(value: boolean) {
    setIsTogglingPhase(true)
    try {
      const tx = await writeContractAsync({ address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "setSoulbound", args: [value], chainId: WORLD_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      await refetch()
      toast({ title: value ? "Transfers Disabled" : "Transfers Enabled" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) toast({ title: "Transaction Failed", variant: "destructive" })
    } finally { setIsTogglingPhase(false) }
  }

  async function handleSetAuthorizedMinter(minterAddress: `0x${string}`, authorize: boolean, index: number) {
    setAuthorizingIdx(index)
    try {
      const tx = await writeContractAsync({ address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "setAuthorizedMinter", args: [minterAddress, authorize], chainId: WORLD_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      await refetch()
      toast({ title: authorize ? "Minter Authorized" : "Minter Revoked" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) toast({ title: "Transaction Failed", variant: "destructive" })
    } finally { setAuthorizingIdx(null) }
  }

  async function handleSetCustomMinter(authorize: boolean) {
    if (!minterAddr || !isAddress(minterAddr)) {
      toast({ title: "Invalid address", variant: "destructive" }); return
    }
    setAuthorizingIdx(99)
    try {
      const tx = await writeContractAsync({ address: WORLD_TOKEN_ADDRESS, abi: WORLD_TOKEN_ABI, functionName: "setAuthorizedMinter", args: [minterAddr as `0x${string}`, authorize], chainId: WORLD_CHAIN.id })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx, chainId: WORLD_CHAIN.id })
      setMinterAddr("")
      await refetch()
      toast({ title: authorize ? "Minter Authorized" : "Minter Revoked" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) toast({ title: "Transaction Failed", variant: "destructive" })
    } finally { setAuthorizingIdx(null) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Token Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage BOOZ supply and authorized minters on World Chain.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Token Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Supply"    value={fmt(totalSupply)}    sub={maxSupply != null ? `/ ${fmt(maxSupply)} max` : undefined} />
          <StatCard label="Treasury Minted" value={fmt(treasuryMinted)} />
          <StatCard label="Phase"           value={isSoulbound === undefined ? "—" : isSoulbound ? "Soulbound" : "Transferable"} />
        </div>
      </section>

      <Section title="Soulbound Control">
        <div className="flex items-start justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Transfer Status</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isSoulbound === undefined ? "—" : isSoulbound
                ? <span className="font-semibold text-amber-600">Soulbound (non-transferable)</span>
                : <span className="font-semibold text-emerald-600">Transferable</span>}
            </p>
            {isSoulbound === true && (
              <p className="text-xs text-destructive mt-1.5">Warning: enabling transfers cannot be undone.</p>
            )}
          </div>
          <div className="shrink-0 pt-0.5">
            {isSoulbound === true && (
              <Button size="sm" variant="destructive" className="h-8 px-3" onClick={() => handleSetSoulbound(false)} disabled={isTogglingPhase}>
                {isTogglingPhase ? <Loader2 size={13} className="animate-spin" /> : "Enable Transfers"}
              </Button>
            )}
            {isSoulbound === false && (
              <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => handleSetSoulbound(true)} disabled={isTogglingPhase}>
                {isTogglingPhase ? <Loader2 size={13} className="animate-spin" /> : "Disable Transfers"}
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section title="Authorized Minters">
        {KNOWN_MINTERS.map(({ label, address, authorized, index }) => (
          <div key={address} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs font-mono text-muted-foreground truncate">{address}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {authorized === undefined ? <span className="text-xs text-muted-foreground">—</span>
                : authorized
                  ? <span className="text-xs font-semibold text-emerald-600">Authorized ✓</span>
                  : <span className="text-xs font-semibold text-gray-400">Not authorized ✗</span>}
              {authorized === true && (
                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                  onClick={() => handleSetAuthorizedMinter(address, false, index)} disabled={authorizingIdx !== null}>
                  {authorizingIdx === index ? <Loader2 size={11} className="animate-spin" /> : "Revoke"}
                </Button>
              )}
              {authorized === false && (
                <Button size="sm" className="h-7 px-2 text-xs"
                  onClick={() => handleSetAuthorizedMinter(address, true, index)} disabled={authorizingIdx !== null}>
                  {authorizingIdx === index ? <Loader2 size={11} className="animate-spin" /> : "Authorize"}
                </Button>
              )}
            </div>
          </div>
        ))}
        <div className="px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-gray-800">Custom Minter</p>
          <div className="flex gap-2">
            <Input className="flex-1 h-8 text-sm font-mono" placeholder="0x minter address"
              value={minterAddr} onChange={e => setMinterAddr(e.target.value)} disabled={authorizingIdx !== null} />
            <Button size="sm" className="h-8 px-3"
              onClick={() => handleSetCustomMinter(true)} disabled={authorizingIdx !== null || !isAddress(minterAddr)}>
              {authorizingIdx === 99 ? <Loader2 size={13} className="animate-spin" /> : "Authorize"}
            </Button>
            <Button size="sm" variant="destructive" className="h-8 px-3"
              onClick={() => handleSetCustomMinter(false)} disabled={authorizingIdx !== null || !isAddress(minterAddr)}>
              Revoke
            </Button>
          </div>
        </div>
      </Section>
    </div>
  )
}
