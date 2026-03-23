"use client"

import { useReadContracts } from "wagmi"
import { formatUnits } from "viem"
import { useState } from "react"
import { Copy, Check, ExternalLink } from "lucide-react"
import {
  BOOZTORY_ADDRESS, BOOZTORY_ABI,
  RAFFLE_ADDRESS, RAFFLE_ABI,
  TOKEN_ADDRESS, TOKEN_ABI,
  USDC_ADDRESS, ERC20_ABI,
} from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"

// ── helpers ──────────────────────────────────────────────────────────────────

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
  const explorerBase = APP_CHAIN.blockExplorers?.default.url ?? "https://basescan.org"

  const copy = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <span className="text-sm font-medium text-gray-700 w-36 shrink-0">{label}</span>
      <span className="text-xs text-muted-foreground font-mono truncate flex-1 mx-3">
        {address}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={copy}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          title="Copy address"
        >
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
        <a
          href={`${explorerBase}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          title="View on explorer"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { data, isLoading } = useReadContracts({
    contracts: [
      // Booztory stats
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "nextTokenId" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "slotPrice" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "slotDuration" },
      { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "donationFeeBps" },
      // Raffle stats
      { address: RAFFLE_ADDRESS, abi: RAFFLE_ABI, functionName: "nextRaffleId" },
      // BOOZ token
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "totalSupply" },
      // USDC balances
      { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [BOOZTORY_ADDRESS] },
      { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [RAFFLE_ADDRESS] },
    ],
  })

  const [nextTokenId, slotPrice, slotDuration, donationFeeBps, nextRaffleId, boozSupply, booztoryUsdc, raffleUsdc] =
    data?.map(d => d.result) ?? []

  const totalSlots   = nextTokenId != null ? Math.max(0, Number(nextTokenId as bigint) - 1) : null
  const totalRaffles = nextRaffleId != null ? Number(nextRaffleId as bigint) : null
  const slotPriceUsd = slotPrice   != null ? Number(slotPrice as bigint) / 1_000_000 : null
  const durationMin  = slotDuration != null ? Math.round(Number(slotDuration as bigint) / 60) : null
  const feePct       = donationFeeBps != null ? Number(donationFeeBps as bigint) / 100 : null
  const boozTotal    = boozSupply  != null ? formatUnits(boozSupply as bigint, 18) : null
  const booztoryBal  = booztoryUsdc != null ? Number(booztoryUsdc as bigint) / 1_000_000 : null
  const raffleBal    = raffleUsdc  != null ? Number(raffleUsdc as bigint) / 1_000_000 : null

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live contract stats and key addresses.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left column */}
        <div className="space-y-6">

          {/* USDC Balances */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">USDC Balances</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Booztory Contract"
                value={isLoading || booztoryBal == null ? "—" : `$${booztoryBal.toFixed(2)}`}
                sub="Accumulated fees"
              />
              <StatCard
                label="Raffle Contract"
                value={isLoading || raffleBal == null ? "—" : `$${raffleBal.toFixed(2)}`}
                sub="Sponsor prize pools"
              />
            </div>
          </section>

          {/* Activity Stats */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Activity</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Slots Minted"
                value={isLoading || totalSlots == null ? "—" : totalSlots.toLocaleString()}
              />
              <StatCard
                label="Raffles Created"
                value={isLoading || totalRaffles == null ? "—" : totalRaffles.toLocaleString()}
              />
              <StatCard
                label="BOOZ Supply"
                value={isLoading || boozTotal == null ? "—" : Number(boozTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              />
              <StatCard
                label="Slot Price"
                value={isLoading || slotPriceUsd == null ? "—" : `$${slotPriceUsd.toFixed(2)}`}
                sub={durationMin != null ? `${durationMin} min slots` : undefined}
              />
              <StatCard
                label="Slot Duration"
                value={isLoading || durationMin == null ? "—" : `${durationMin} min`}
              />
              <StatCard
                label="Donation Fee"
                value={isLoading || feePct == null ? "—" : `${feePct}%`}
                sub="Platform keeps this %"
              />
            </div>
          </section>

        </div>

        {/* Right column — Deployed Contracts */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Deployed Contracts</h2>
          <div className="rounded-xl border bg-white px-4 divide-y">
            <AddressRow label="Booztory"       address={BOOZTORY_ADDRESS} />
            <AddressRow label="BooztoryToken"  address={TOKEN_ADDRESS} />
            <AddressRow label="BooztoryRaffle" address={RAFFLE_ADDRESS} />
            <AddressRow label="USDC"           address={USDC_ADDRESS} />
          </div>
        </section>

      </div>

    </div>
  )
}
