"use client"

import { useState } from "react"
import { useReadContracts } from "wagmi"
import { formatUnits } from "viem"
import { Copy, Check, ExternalLink } from "lucide-react"
import {
  WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI,
  WORLD_RAFFLE_ADDRESS,   WORLD_RAFFLE_ABI,
  WORLD_TOKEN_ADDRESS,    WORLD_TOKEN_ABI,
  WORLD_USDC_ADDRESS,     WORLD_WLD_ADDRESS,
} from "@/lib/contractWorld"
import { ERC20_ABI } from "@/lib/contract"
import { WORLD_CHAIN } from "@/lib/wagmi"

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function AddressRow({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false)
  const explorerUrl = `https://worldscan.org/address/${address}`

  const copy = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <span className="text-sm font-medium text-gray-700 w-40 shrink-0">{label}</span>
      <span className="text-xs text-muted-foreground font-mono truncate flex-1 mx-3">{address}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={copy} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Copy">
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="View on explorer">
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}

export default function WorldOverviewPage() {
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "nextTokenId",  chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "slotPrice",    chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "slotDuration", chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "donationFeeBps", chainId: WORLD_CHAIN.id },
      { address: WORLD_RAFFLE_ADDRESS,   abi: WORLD_RAFFLE_ABI,   functionName: "nextRaffleId", chainId: WORLD_CHAIN.id },
      { address: WORLD_TOKEN_ADDRESS,    abi: WORLD_TOKEN_ABI,    functionName: "totalSupply",  chainId: WORLD_CHAIN.id },
      { address: WORLD_USDC_ADDRESS,     abi: ERC20_ABI,          functionName: "balanceOf", args: [WORLD_BOOZTORY_ADDRESS], chainId: WORLD_CHAIN.id },
      { address: WORLD_USDC_ADDRESS,     abi: ERC20_ABI,          functionName: "balanceOf", args: [WORLD_RAFFLE_ADDRESS],   chainId: WORLD_CHAIN.id },
      { address: WORLD_WLD_ADDRESS,      abi: ERC20_ABI,          functionName: "balanceOf", args: [WORLD_BOOZTORY_ADDRESS], chainId: WORLD_CHAIN.id },
      { address: WORLD_WLD_ADDRESS,      abi: ERC20_ABI,          functionName: "balanceOf", args: [WORLD_RAFFLE_ADDRESS],   chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "getWLDPrice",       chainId: WORLD_CHAIN.id },
      { address: WORLD_BOOZTORY_ADDRESS, abi: WORLD_BOOZTORY_ABI, functionName: "getSlotPriceInWLD", chainId: WORLD_CHAIN.id },
    ],
  })

  const [nextTokenId, slotPrice, slotDuration, donationFeeBps, nextRaffleId, boozSupply, booztoryUsdc, raffleUsdc, booztoryWld, raffleWld, rawWldPrice, slotPriceInWLD] =
    data?.map(d => d.result) ?? []

  const totalSlots   = nextTokenId  != null ? Number(nextTokenId as bigint) : null
  const totalRaffles = nextRaffleId != null ? Number(nextRaffleId as bigint) : null
  const slotPriceUsd = slotPrice    != null ? Number(slotPrice as bigint) / 1_000_000 : null
  const durationMin  = slotDuration != null ? Math.round(Number(slotDuration as bigint) / 60) : null
  const feePct       = donationFeeBps != null ? Number(donationFeeBps as bigint) / 100 : null
  const boozTotal    = boozSupply   != null ? formatUnits(boozSupply as bigint, 18) : null
  const booztoryBal    = booztoryUsdc != null ? Number(booztoryUsdc as bigint) / 1_000_000 : null
  const raffleBal      = raffleUsdc   != null ? Number(raffleUsdc as bigint) / 1_000_000 : null
  const booztoryWldBal = booztoryWld  != null ? Number(booztoryWld as bigint) / 1e18 : null
  const raffleWldBal   = raffleWld    != null ? Number(raffleWld as bigint) / 1e18 : null
  // Oracle diagnostics — raw values for debugging
  const wldPriceRaw      = rawWldPrice    != null ? (rawWldPrice as bigint).toString() : null
  const slotInWLDDisplay = slotPriceInWLD != null ? formatUnits(slotPriceInWLD as bigint, 18) : null

  const fmt = (v: number | null, prefix = "", suffix = "") =>
    isLoading || v == null ? "—" : `${prefix}${v}${suffix}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live World chain contract stats and addresses.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        <div className="space-y-6">

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">USDC Balances</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="BooztoryWorld"
                value={isLoading || booztoryBal == null ? "—" : `$${booztoryBal.toFixed(2)}`}
                sub="Accumulated fees"
              />
              <StatCard
                label="RaffleWorld"
                value={isLoading || raffleBal == null ? "—" : `$${raffleBal.toFixed(2)}`}
                sub="Sponsor prize pools"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">WLD Balances</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="BooztoryWorld"
                value={isLoading || booztoryWldBal == null ? "—" : `${booztoryWldBal.toFixed(4)} WLD`}
                sub="Accumulated WLD fees"
              />
              <StatCard
                label="RaffleWorld"
                value={isLoading || raffleWldBal == null ? "—" : `${raffleWldBal.toFixed(4)} WLD`}
                sub="WLD prize pools"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Oracle (WLD/USD)</h2>
            <div className="rounded-xl border bg-white px-4 py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Raw price (latestRoundData)</span>
                <span className="font-mono text-xs text-gray-900 break-all text-right max-w-[55%]">{isLoading ? "—" : wldPriceRaw ?? "error"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Slot price in WLD (1 USDC→WLD)</span>
                <span className="font-mono text-xs text-gray-900">{isLoading ? "—" : slotInWLDDisplay != null ? `${Number(slotInWLDDisplay).toFixed(6)} WLD` : "error"}</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Activity</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Slots Minted"     value={isLoading || totalSlots   == null ? "—" : totalSlots.toLocaleString()} />
              <StatCard label="Raffles Created"  value={isLoading || totalRaffles == null ? "—" : totalRaffles.toLocaleString()} />
              <StatCard label="BOOZ Supply"      value={isLoading || boozTotal    == null ? "—" : Number(boozTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
              <StatCard label="Slot Price"       value={fmt(slotPriceUsd, "$")}   sub={durationMin != null ? `${durationMin} min slots` : undefined} />
              <StatCard label="Slot Duration"    value={isLoading || durationMin  == null ? "—" : `${durationMin} min`} />
              <StatCard label="Donation Fee"     value={fmt(feePct, "", "%")}     sub="Platform keeps this %" />
            </div>
          </section>

        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Deployed Contracts</h2>
          <div className="rounded-xl border bg-white px-4 divide-y">
            <AddressRow label="BooztoryWorld"      address={WORLD_BOOZTORY_ADDRESS} />
            <AddressRow label="BooztoryRaffleWorld" address={WORLD_RAFFLE_ADDRESS} />
            <AddressRow label="BOOZ Token"         address={WORLD_TOKEN_ADDRESS} />
            <AddressRow label="USDC"               address={WORLD_USDC_ADDRESS} />
          </div>
          <p className="text-[11px] text-muted-foreground px-1">Chain ID: {WORLD_CHAIN.id}</p>
        </section>

      </div>
    </div>
  )
}
