import { NextResponse } from "next/server"

// ── Config ────────────────────────────────────────────────────────────────────
// Set SUBGRAPH_URL in .env.local after deploying to Subgraph Studio:
// SUBGRAPH_URL=https://api.studio.thegraph.com/query/<id>/booztory/version/latest
const SUBGRAPH_URL = process.env.SUBGRAPH_URL

const CACHE_SECONDS = 1800 // 30 minutes
const SEVEN_DAYS_SECONDS  = 7  * 24 * 60 * 60
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

// ── GraphQL queries ───────────────────────────────────────────────────────────
const ALL_TIME_QUERY = `{
  minters: wallets(first: 10, orderBy: totalSlots, orderDirection: desc, where: { totalSlots_gt: "0" }) {
    id totalSlots
  }
  streakers: wallets(first: 10, orderBy: bestStreak, orderDirection: desc, where: { bestStreak_gt: 0 }) {
    id bestStreak
  }
  points: wallets(first: 10, orderBy: totalPoints, orderDirection: desc, where: { totalPoints_gt: "0" }) {
    id totalPoints
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
      creator blockTimestamp
    }
    gmclaimEvents(first: 1000, where: { blockTimestamp_gte: "${since}" }) {
      user streakCount blockTimestamp
    }
    pointsEarnedEvents(first: 1000, where: { blockTimestamp_gte: "${since}" }) {
      user amount blockTimestamp
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

// ── Subgraph fetch ─────────────────────────────────────────────────────────────
async function querySubgraph(query: string): Promise<Record<string, unknown>> {
  const res = await fetch(SUBGRAPH_URL!, {
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
export async function GET() {
  if (!SUBGRAPH_URL) {
    return NextResponse.json(
      { error: "SUBGRAPH_URL not configured" },
      { status: 503 }
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const since7d  = now - SEVEN_DAYS_SECONDS
  const since30d = now - THIRTY_DAYS_SECONDS

  try {
    const [allTime, sevenDay, thirtyDay] = await Promise.all([
      querySubgraph(ALL_TIME_QUERY),
      querySubgraph(thirtyDayQuery(since7d)),
      querySubgraph(thirtyDayQuery(since30d)),
    ])

    // ── All Time ──
    type WalletRow = { id: string; totalSlots?: string; bestStreak?: number; totalPoints?: string; totalReceived?: string; totalDonated?: string; totalWins?: number; totalWinnings?: string }

    const at = allTime as Record<string, WalletRow[]>

    const allTimeResult = {
      minters:  (at.minters  ?? []).map(w => ({ address: w.id, value: Number(w.totalSlots) })),
      streakers:(at.streakers ?? []).map(w => ({ address: w.id, value: w.bestStreak ?? 0 })),
      points:   (at.points   ?? []).map(w => ({ address: w.id, value: Number(w.totalPoints) })),
      creators: (at.creators ?? []).map(w => ({ address: w.id, value: usdcToFloat(w.totalReceived ?? "0") })),
      donors:   (at.donors   ?? []).map(w => ({ address: w.id, value: usdcToFloat(w.totalDonated ?? "0") })),
      winners:  (at.winners  ?? []).map(w => ({ address: w.id, value: usdcToFloat(w.totalWinnings ?? "0"), wins: w.totalWins ?? 0 })),
    }

    // ── Period helpers ──
    type SlotEv  = { creator: string; blockTimestamp: string }
    type GmEv    = { user: string; streakCount: number; blockTimestamp: string }
    type PtsEv   = { user: string; amount: string; blockTimestamp: string }
    type DonEv   = { donor: string; creator: string; creatorAmount: string; totalAmount: string; blockTimestamp: string }
    type WinEv   = { winner: string; usdcAmount: string; blockTimestamp: string }
    type PeriodRaw = { slotMintEvents: SlotEv[]; gmclaimEvents: GmEv[]; pointsEarnedEvents: PtsEv[]; donationEvents: DonEv[]; winEvents: WinEv[] }

    function buildPeriodResult(raw: PeriodRaw) {
      return {
        minters:  aggregateCount((raw.slotMintEvents ?? []).map(e => e.creator.toLowerCase())),
        streakers: aggregateMax((raw.gmclaimEvents ?? []).map(e => ({ address: e.user.toLowerCase(), value: e.streakCount }))),
        points:   aggregateSum((raw.pointsEarnedEvents ?? []).map(e => ({ address: e.user.toLowerCase(), value: Number(e.amount) }))),
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
