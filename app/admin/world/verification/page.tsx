"use client"

import { useState } from "react"
import { useReadContracts, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { isAddress, getAddress } from "viem"
import { WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI, WORLD_RAFFLE_ADDRESS, WORLD_RAFFLE_ABI } from "@/lib/contractWorld"
import { wagmiConfig, WORLD_CHAIN } from "@/lib/wagmi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function StatusPill({ active, labels }: { active: boolean; labels: [string, string] }) {
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
      active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"
    )}>
      {active ? labels[0] : labels[1]}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      <div className="rounded-xl border bg-white divide-y">{children}</div>
    </section>
  )
}

export default function WorldVerificationPage() {
  const [verifyAddr, setVerifyAddr]     = useState("")
  const [busy, setBusy]                 = useState<string | null>(null)

  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "requireVerification", chainId: WORLD_CHAIN.id },
      { address: WORLD_RAFFLE_ADDRESS,   abi: WORLD_RAFFLE_ABI,   functionName: "requireVerification", chainId: WORLD_CHAIN.id },
    ],
  })

  const booztoryRequireVerif = data?.[0].result as boolean | undefined
  const raffleRequireVerif   = data?.[1].result as boolean | undefined  // read-only, no setter in ABI

  async function call(id: string, fn: () => Promise<`0x${string}`>) {
    setBusy(id)
    try {
      const hash = await fn()
      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: WORLD_CHAIN.id })
      toast({ title: "Done", description: `${id} confirmed.` })
      refetch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected"))
        toast({ title: "Failed", description: msg || "Transaction failed.", variant: "destructive" })
    } finally { setBusy(null) }
  }

  const addrValid = isAddress(verifyAddr)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">World ID Verification</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage the human verification gate for World Chain contracts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">

          <Section title="BooztoryWorld Gate">
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Require Verification</p>
                <p className="text-xs text-muted-foreground mt-0.5">Gates mint, donate, and GM claim to verified humans only</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusPill active={!!booztoryRequireVerif} labels={["ON", "OFF"]} />
                <Button
                  size="sm"
                  className={cn("h-8 px-3", booztoryRequireVerif ? "bg-gray-900" : "bg-red-600 hover:bg-red-700")}
                  onClick={() => call(
                    `${booztoryRequireVerif ? "Disable" : "Enable"} Gate (BooztoryWorld)`,
                    () => writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setRequireVerification", args: [!booztoryRequireVerif], chainId: WORLD_CHAIN.id })
                  )}
                  disabled={!!busy}
                >
                  {busy?.includes("BooztoryWorld") ? <Loader2 size={13} className="animate-spin" /> : booztoryRequireVerif ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </Section>

          <Section title="RaffleWorld Gate">
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Require Verification</p>
                <p className="text-xs text-muted-foreground mt-0.5">Gates raffle entry to verified humans only</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusPill active={!!raffleRequireVerif} labels={["ON", "OFF"]} />
                <Button
                  size="sm"
                  className={cn("h-8 px-3", raffleRequireVerif ? "bg-gray-900" : "bg-red-600 hover:bg-red-700")}
                  onClick={() => call(
                    `${raffleRequireVerif ? "Disable" : "Enable"} Gate (RaffleWorld)`,
                    () => writeContractAsync({ address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "setRequireVerification", args: [!raffleRequireVerif], chainId: WORLD_CHAIN.id })
                  )}
                  disabled={!!busy}
                >
                  {busy?.includes("RaffleWorld") ? <Loader2 size={13} className="animate-spin" /> : raffleRequireVerif ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </Section>

        </div>

        <div className="space-y-6">

          <Section title="Manual Verification">
            <div className="px-4 py-3 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Wallet Address</p>
                <p className="text-xs text-muted-foreground">Grant or revoke verified human status on both contracts</p>
              </div>
              <Input
                className="h-8 text-sm font-mono"
                placeholder="0x wallet address"
                value={verifyAddr}
                onChange={e => setVerifyAddr(e.target.value)}
                disabled={!!busy}
              />

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">BooztoryWorld</p>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 px-3 flex-1" onClick={() => call("Grant (BooztoryWorld)", () =>
                    writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setVerifiedHuman", args: [getAddress(verifyAddr), true], chainId: WORLD_CHAIN.id })
                  )} disabled={!!busy || !addrValid}>
                    {busy === "Grant (BooztoryWorld)" ? <Loader2 size={13} className="animate-spin" /> : "Grant"}
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8 px-3 flex-1" onClick={() => call("Revoke (BooztoryWorld)", () =>
                    writeContractAsync({ address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "setVerifiedHuman", args: [getAddress(verifyAddr), false], chainId: WORLD_CHAIN.id })
                  )} disabled={!!busy || !addrValid}>
                    {busy === "Revoke (BooztoryWorld)" ? <Loader2 size={13} className="animate-spin" /> : "Revoke"}
                  </Button>
                </div>

                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide pt-1">RaffleWorld</p>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 px-3 flex-1" onClick={() => call("Grant (RaffleWorld)", () =>
                    writeContractAsync({ address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "setVerifiedHuman", args: [getAddress(verifyAddr), true], chainId: WORLD_CHAIN.id })
                  )} disabled={!!busy || !addrValid}>
                    {busy === "Grant (RaffleWorld)" ? <Loader2 size={13} className="animate-spin" /> : "Grant"}
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8 px-3 flex-1" onClick={() => call("Revoke (RaffleWorld)", () =>
                    writeContractAsync({ address: WORLD_RAFFLE_ADDRESS, abi: WORLD_RAFFLE_ABI, functionName: "setVerifiedHuman", args: [getAddress(verifyAddr), false], chainId: WORLD_CHAIN.id })
                  )} disabled={!!busy || !addrValid}>
                    {busy === "Revoke (RaffleWorld)" ? <Loader2 size={13} className="animate-spin" /> : "Revoke"}
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
