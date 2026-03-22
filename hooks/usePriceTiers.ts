"use client"

import { useEffect, useState } from "react"
import { usePublicClient, useReadContracts } from "wagmi"
import { parseAbiItem } from "viem"
import { RAFFLE_ADDRESS, RAFFLE_ABI } from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"

export interface PriceTier {
  seconds: number
  label: string
  minPrize: bigint
  fee: bigint
}

// Standard durations seeded by the contract constructor (always polled from contract)
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
  const publicClient = usePublicClient({ chainId: APP_CHAIN.id })
  const [extraSeconds, setExtraSeconds] = useState<number[]>([])

  // Best-effort: discover non-standard durations from PriceTierSet events.
  // Standard durations are always polled directly from the contract below,
  // so this only matters for custom durations the owner created via Basescan.
  // Uses a 1M-block sliding window (~23 days on Base at 2s blocks) to avoid
  // Alchemy range limits — well beyond any recent deployment.
  useEffect(() => {
    if (!publicClient) return
    const LOOKBACK = 1_000_000n
    publicClient.getBlockNumber().then(latest => {
      return publicClient.getLogs({
        address: RAFFLE_ADDRESS,
        event: parseAbiItem("event PriceTierSet(uint256 duration, uint256 minPrize, uint256 fee)"),
        fromBlock: latest > LOOKBACK ? latest - LOOKBACK : 0n,
        toBlock: latest,
      })
    }).then(logs => {
      const discovered = [...new Set(logs.map(l => Number(l.args.duration!)))]
      const custom = discovered.filter(s => !STANDARD_SECONDS.includes(s))
      if (custom.length > 0) setExtraSeconds(custom)
    }).catch(() => { /* ignore RPC range errors — standard tiers still work */ })
  }, [publicClient])

  const allSeconds = [...STANDARD_SECONDS, ...extraSeconds]

  const { data: tiersRaw, refetch } = useReadContracts({
    contracts: allSeconds.map(s => ({
      address: RAFFLE_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: "priceTiers" as const,
      args: [BigInt(s)] as const,
      chainId: APP_CHAIN.id,
    })),
    query: { refetchInterval: 30_000 },
  })

  const tiers: PriceTier[] = allSeconds
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
