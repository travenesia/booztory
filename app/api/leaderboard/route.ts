import { NextResponse } from "next/server"
import { dataLimiter, getIp } from "@/lib/ratelimit"

// ── Config ────────────────────────────────────────────────────────────────────
const SUBGRAPH_URL       = process.env.SUBGRAPH_URL
const WORLD_SUBGRAPH_URL = process.env.WORLD_SUBGRAPH_URL

const CACHE_SECONDS = 1800 // 30 minutes
const SEVEN_DAYS_SECONDS  = 7  * 24 * 60 * 60
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

// ── GraphQL queries ───────────────────────────────────────────────────────────
const ALL_TIME_QUERY = `{
  slotMintEventsAll: slotMintEvents(first: 1000, orderBy: blockTimestamp, orderDirection: desc) {
    creator txHash
  }
  streakers: wallets(first: 10, orderBy: bestStreak, orderDirection: desc, where: { bestStreak_gt: 0 }) {
    id bestStreak
  }
  pointsWallets: wallets(first: 50, orderBy: totalPoints, orderDirection: desc, where: { totalPoints_gt: "0" }) {
    id totalPoints
  }
  ticketsConvertedAll: ticketsConvertedEvents(first: 1000) {
    user pointsBurned
  }
  creators: wallets(first: 10, orderBy: totalReceived, orderDirection: desc, where: { totalReceived_gt: "0" }) {
    id totalReceived
  }
  donors: wallets(first: 10, orderBy: totalDonated, orderDirection: desc, where: { totalDonated_gt: "0" }) {
    id totalDonated
  }
  winners: wallets(first: 10, orderBy: totalWinnings, orderDirection: desc, where: { totalWinnings_gt: "0" }) {
    id totalWins totalWinnings
  }
}`

function thirtyDayQuery(since: number): string {
  return `{
    slotMintEvents(first: 1000, where: { blockTimestamp_gte: "${since}" }) {
      creator txHash blockTimestamp
    }
    gmclaimEvents(first: 1000, where: { blockTimestamp_gte: "${since}" }) {
      user streakCount blockTimestamp
    }
    pointsEarnedEvents(first: 1000, where: { blockTimestamp_gte: "${since}" }) {
      user amount blockTimestamp
    }
    ticketsConvertedEvents(first: 1000, where: { blockTimestamp_gte: "${since}" }) {
      user pointsBurned blockTimestamp
    }
    donationEvents(first: 1000, where: { blockTimestamp_gte: "${since}" }) {
      donor creator creatorAmount totalAmount blockTimestamp
    }
    winEvents(first: 1000, where: { blockTimestamp_gte: "${since}" }) {
      winner usdcAmount blockTimestamp
    }
  }`
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LeaderEntry {
  address: string
  value: number
  wins?: number
}

// ── Aggregation helpers ───────────────────────────────────────────────────────
function aggregateSum(events: Array<{ address: string; value: number }>): LeaderEntry[] {
  const map = new Map<string, number>()
  for (const e of events) {
    map.set(e.address, (map.get(e.address) ?? 0) + e.value)
  }
  return Array.from(map.entries())
    .map(([address, value]) => ({ address, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

function aggregateMax(events: Array<{ address: string; value: number }>): LeaderEntry[] {
  const map = new Map<string, number>()
  for (const e of events) {
    map.set(e.address, Math.max(map.get(e.address) ?? 0, e.value))
  }
  return Array.from(map.entries())
    .map(([address, value]) => ({ address, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

function aggregateCount(addresses: string[]): LeaderEntry[] {
  const map = new Map<string, number>()
  for (const addr of addresses) {
    map.set(addr, (map.get(addr) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([address, value]) => ({ address, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

// Divide 6-decimal USDC BigInt string to float
function usdcToFloat(raw: string): number {
  return Number(BigInt(raw)) / 1_000_000
}

// Deduplicate mint events by txHash, return unique creator addresses
function deduplicateMints(events: Array<{ creator: string; txHash: string }>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const e of events) {
    if (!seen.has(e.txHash)) {
      seen.add(e.txHash)
      result.push(e.creator.toLowerCase())
    }
  }
  return result
}

// Aggregate earned points minus burned points, return top 10
function aggregateNetPoints(
  earned: Array<{ address: string; value: number }>,
  burned: Array<{ address: string; value: number }>
): LeaderEntry[] {
  const map = new Map<string, number>()
  for (const e of earned) map.set(e.address, (map.get(e.address) ?? 0) + e.value)
  for (const e of burned) map.set(e.address, Math.max(0, (map.get(e.address) ?? 0) - e.value))
  return Array.from(map.entries())
    .filter(([, v]) => v > 0)
    .map(([address, value]) => ({ address, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

// ── Subgraph fetch ─────────────────────────────────────────────────────────────
async function querySubgraph(query: string, url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`)
  const json = await res.json() as { data?: Record<string, unknown>; errors?: unknown[] }
  if (json.errors) throw new Error(`Subgraph error: ${JSON.stringify(json.errors)}`)
  return json.data ?? {}
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { success } = await dataLimiter.limit(getIp(request))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const url = new URL(request.url)
  const isWorld = url.searchParams.get("chain") === "world"
  const subgraphUrl = isWorld ? WORLD_SUBGRAPH_URL : SUBGRAPH_URL

  if (!subgraphUrl) {
    return NextResponse.json(
      { error: isWorld ? "WORLD_SUBGRAPH_URL not configured" : "SUBGRAPH_URL not configured" },
      { status: 503 }
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const since7d  = now - SEVEN_DAYS_SECONDS
  const since30d = now - THIRTY_DAYS_SECONDS

  try {
    const [allTime, sevenDay, thirtyDay] = await Promise.all([
      querySubgraph(ALL_TIME_QUERY, subgraphUrl),
      querySubgraph(thirtyDayQuery(since7d), subgraphUrl),
      querySubgraph(thirtyDayQuery(since30d), subgraphUrl),
    ])

    // ── All Time ──
    type WalletRow = { id: string; bestStreak?: number; totalPoints?: string; totalReceived?: string; totalDonated?: string; totalWins?: number; totalWinnings?: string }
    type MintEvRaw = { creator: string; txHash: string }
    type TicketsConvRaw = { user: string; pointsBurned: string }

    const at = allTime as Record<string, unknown>

    // All-time mints: deduplicate by txHash
    const atMintEvents = (at.slotMintEventsAll as MintEvRaw[] ?? [])
    const atTicketsConv = (at.ticketsConvertedAll as TicketsConvRaw[] ?? [])
    const atPointsWallets = (at.pointsWallets as WalletRow[] ?? [])

    // All-time net points: totalPoints - sum(pointsBurned) per address
    const atBurnMap = new Map<string, number>()
    for (const e of atTicketsConv) {
      const addr = e.user.toLowerCase()
      atBurnMap.set(addr, (atBurnMap.get(addr) ?? 0) + Number(e.pointsBurned))
    }
    const atNetPoints = atPointsWallets
      .map(w => ({ address: w.id, value: Math.max(0, Number(w.totalPoints ?? "0") - (atBurnMap.get(w.id) ?? 0)) }))
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    const atWallets = at as Record<string, WalletRow[]>
    const allTimeResult = {
      minters:  aggregateCount(deduplicateMints(atMintEvents)),
      streakers:(atWallets.streakers ?? []).map(w => ({ address: w.id, value: w.bestStreak ?? 0 })),
      points:   atNetPoints,
      creators: (atWallets.creators ?? []).map(w => ({ address: w.id, value: usdcToFloat(w.totalReceived ?? "0") })),
      donors:   (atWallets.donors   ?? []).map(w => ({ address: w.id, value: usdcToFloat(w.totalDonated ?? "0") })),
      winners:  (atWallets.winners  ?? []).map(w => ({ address: w.id, value: usdcToFloat(w.totalWinnings ?? "0"), wins: w.totalWins ?? 0 })),
    }

    // ── Period helpers ──
    type SlotEv  = { creator: string; txHash: string; blockTimestamp: string }
    type GmEv    = { user: string; streakCount: number; blockTimestamp: string }
    type PtsEv   = { user: string; amount: string; blockTimestamp: string }
    type TcEv    = { user: string; pointsBurned: string; blockTimestamp: string }
    type DonEv   = { donor: string; creator: string; creatorAmount: string; totalAmount: string; blockTimestamp: string }
    type WinEv   = { winner: string; usdcAmount: string; blockTimestamp: string }
    type PeriodRaw = { slotMintEvents: SlotEv[]; gmclaimEvents: GmEv[]; pointsEarnedEvents: PtsEv[]; ticketsConvertedEvents: TcEv[]; donationEvents: DonEv[]; winEvents: WinEv[] }

    function buildPeriodResult(raw: PeriodRaw) {
      return {
        minters:  aggregateCount(deduplicateMints(raw.slotMintEvents ?? [])),
        streakers: aggregateMax((raw.gmclaimEvents ?? []).map(e => ({ address: e.user.toLowerCase(), value: e.streakCount }))),
        points:   aggregateNetPoints(
          (raw.pointsEarnedEvents ?? []).map(e => ({ address: e.user.toLowerCase(), value: Number(e.amount) })),
          (raw.ticketsConvertedEvents ?? []).map(e => ({ address: e.user.toLowerCase(), value: Number(e.pointsBurned) }))
        ),
        creators: aggregateSum((raw.donationEvents ?? []).map(e => ({ address: e.creator.toLowerCase(), value: usdcToFloat(e.creatorAmount) }))),
        donors:   aggregateSum((raw.donationEvents ?? []).map(e => ({ address: e.donor.toLowerCase(), value: usdcToFloat(e.totalAmount) }))),
        winners: (() => {
          const usdc = aggregateSum((raw.winEvents ?? []).map(e => ({ address: e.winner.toLowerCase(), value: usdcToFloat(e.usdcAmount ?? "0") })))
          const winCounts = new Map<string, number>()
          for (const e of raw.winEvents ?? []) winCounts.set(e.winner.toLowerCase(), (winCounts.get(e.winner.toLowerCase()) ?? 0) + 1)
          return usdc.map(entry => ({ ...entry, wins: winCounts.get(entry.address) ?? 0 }))
        })(),
      }
    }

    return NextResponse.json(
      {
        allTime: allTimeResult,
        "7d":  buildPeriodResult(sevenDay  as PeriodRaw),
        "30d": buildPeriodResult(thirtyDay as PeriodRaw),
      },
      {
        headers: {
          "Cache-Control": `s-maxage=${CACHE_SECONDS}, stale-while-revalidate`,
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[leaderboard]", message)
    return NextResponse.json({ error: "Failed to fetch leaderboard", detail: message }, { status: 500 })
  }
}
