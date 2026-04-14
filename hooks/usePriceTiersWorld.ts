"use client"

import { useReadContracts } from "wagmi"
import { WORLD_RAFFLE_ADDRESS, WORLD_RAFFLE_ABI } from "@/lib/contractWorld"
import { WORLD_CHAIN } from "@/lib/wagmi"

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

export function usePriceTiersWorld() {
  const { data: tiersRaw, refetch } = useReadContracts({
    contracts: STANDARD_SECONDS.map(s => ({
      address: WORLD_RAFFLE_ADDRESS,
      abi: WORLD_RAFFLE_ABI,
      functionName: "priceTiers" as const,
      args: [BigInt(s)] as const,
      chainId: WORLD_CHAIN.id,
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
