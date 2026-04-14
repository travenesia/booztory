"use client"

import { useReadContracts } from "wagmi"
import { RAFFLE_ADDRESS, RAFFLE_ABI } from "@/lib/contract"
import { WORLD_RAFFLE_ADDRESS, WORLD_RAFFLE_ABI } from "@/lib/contractWorld"
import { APP_CHAIN, WORLD_CHAIN } from "@/lib/wagmi"
import { isWorldApp } from "@/lib/miniapp-flag"

export interface PriceTier {
  seconds: number
  label: string
  minPrize: bigint
  fee: bigint
}

// Standard durations seeded by the contract constructor.
// If you add a new tier via setPriceTier(), add its duration here too.
const STANDARD_SECONDS = [3600, 7 * 86400, 14 * 86400, 30 * 86400]

function formatDuration(seconds: number): string {
  const w = seconds / (86400 * 7)
  const d = seconds / 86400
  const h = seconds / 3600
  if (Number.isInteger(w) && w >= 1) return w === 1 ? "1 Week" : `${w} Weeks`
  if (Number.isInteger(d) && d >= 1) return d === 1 ? "1 Day" : `${d} Days`
  if (Number.isInteger(h) && h >= 1) return h === 1 ? "1 Hour" : `${h} Hours`
  return `${seconds}s`
}

export function usePriceTiers() {
  const inWorldApp = isWorldApp()
  const rAddr   = inWorldApp ? WORLD_RAFFLE_ADDRESS : RAFFLE_ADDRESS
  const rAbi    = inWorldApp ? WORLD_RAFFLE_ABI     : RAFFLE_ABI
  const chainId = inWorldApp ? WORLD_CHAIN.id       : APP_CHAIN.id

  const { data: tiersRaw, refetch } = useReadContracts({
    contracts: STANDARD_SECONDS.map(s => ({
      address: rAddr,
      abi: rAbi,
      functionName: "priceTiers" as const,
      args: [BigInt(s)] as const,
      chainId,
    })),
    query: { refetchInterval: 30_000 },
  })

  const tiers: PriceTier[] = STANDARD_SECONDS
    .map((s, i) => {
      const result = tiersRaw?.[i]?.result as readonly [bigint, bigint] | undefined
      return {
        seconds: s,
        label: formatDuration(s),
        minPrize: result?.[0] ?? 0n,
        fee: result?.[1] ?? 0n,
      }
    })
    .filter(t => t.minPrize > 0n)
    .sort((a, b) => a.seconds - b.seconds)

  return { tiers, loading: !tiersRaw, refetch }
}
