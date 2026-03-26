import { NextRequest, NextResponse } from "next/server"

const SUBGRAPH_URL = process.env.SUBGRAPH_URL

// 2 min cache — profile data is per-user and changes frequently
const CACHE_SECONDS = 120

async function querySubgraph(query: string): Promise<Record<string, unknown>> {
  const res = await fetch(SUBGRAPH_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`)
  const json = await res.json() as { data?: Record<string, unknown>; errors?: unknown[] }
  if (json.errors) throw new Error(`Subgraph errors: ${JSON.stringify(json.errors)}`)
  return json.data ?? {}
}

function profileQuery(addr: string): string {
  // addr must be lowercase hex
  return `{
    wallet(id: "${addr}") {
      id totalSlots bestStreak totalPoints totalDonated totalReceived totalWins totalWinnings
    }
    mints: slotMintEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { creator: "${addr}" }
    ) {
      id tokenId mintType txHash blockTimestamp
    }
    gmClaims: gmclaimEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { user: "${addr}" }
    ) {
      id streakCount boozAmount txHash blockTimestamp
    }
    points: pointsEarnedEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { user: "${addr}" }
    ) {
      id amount txHash blockTimestamp
    }
    donationsSent: donationEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { donor: "${addr}" }
    ) {
      id tokenId totalAmount txHash blockTimestamp
    }
    donationsReceived: donationEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { creator: "${addr}" }
    ) {
      id tokenId creatorAmount txHash blockTimestamp
    }
    wins: winEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { winner: "${addr}" }
    ) {
      id raffleId usdcAmount txHash blockTimestamp
    }
  }`
}

export type TxType = "mint" | "gm" | "points" | "donated" | "received" | "won"

export interface TxItem {
  id: string
  type: TxType
  txHash: string
  timestamp: number
  // type-specific fields
  mintType?: string       // "standard" | "discount" | "free"
  tokenId?: string
  streakCount?: number
  boozAmount?: string     // raw 18-decimal string
  pointsAmount?: string   // raw units
  usdcAmount?: string     // raw 6-decimal string
  raffleId?: string
}

export interface ProfileData {
  wallet: {
    totalSlots: number
    bestStreak: number
    totalPoints: string
    totalDonated: string
    totalReceived: string
    totalWins: number
    totalWinnings: string
  } | null
  transactions: TxItem[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  if (!SUBGRAPH_URL) {
    return NextResponse.json({ error: "SUBGRAPH_URL not configured" }, { status: 503 })
  }

  const { address } = await params
  const addr = address.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 })
  }

  try {
    const data = await querySubgraph(profileQuery(addr))

    type WalletRaw = {
      totalSlots: string; bestStreak: number; totalPoints: string
      totalDonated: string; totalReceived: string; totalWins: number; totalWinnings: string
    }
    type MintRaw       = { id: string; tokenId: string; mintType: string; txHash: string; blockTimestamp: string }
    type GmRaw         = { id: string; streakCount: number; boozAmount: string; txHash: string; blockTimestamp: string }
    type PointsRaw     = { id: string; amount: string; txHash: string; blockTimestamp: string }
    type DonSentRaw    = { id: string; tokenId: string; totalAmount: string; txHash: string; blockTimestamp: string }
    type DonRecvRaw    = { id: string; tokenId: string; creatorAmount: string; txHash: string; blockTimestamp: string }
    type WinRaw        = { id: string; raffleId: string; usdcAmount: string; txHash: string; blockTimestamp: string }

    const walletRaw = data.wallet as WalletRaw | null
    const mints     = (data.mints     as MintRaw[]     ) ?? []
    const gmClaims  = (data.gmClaims  as GmRaw[]       ) ?? []
    const points    = (data.points    as PointsRaw[]   ) ?? []
    const donSent   = (data.donationsSent   as DonSentRaw[] ) ?? []
    const donRecv   = (data.donationsReceived as DonRecvRaw[]) ?? []
    const wins      = (data.wins      as WinRaw[]      ) ?? []

    const txs: TxItem[] = [
      ...mints.map(e => ({
        id: e.id, type: "mint" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), mintType: e.mintType, tokenId: e.tokenId,
      })),
      ...gmClaims.map(e => ({
        id: e.id, type: "gm" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), streakCount: e.streakCount, boozAmount: e.boozAmount,
      })),
      ...points.map(e => ({
        id: e.id, type: "points" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), pointsAmount: e.amount,
      })),
      ...donSent.map(e => ({
        id: e.id, type: "donated" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), tokenId: e.tokenId, usdcAmount: e.totalAmount,
      })),
      ...donRecv.map(e => ({
        id: e.id, type: "received" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), tokenId: e.tokenId, usdcAmount: e.creatorAmount,
      })),
      ...wins.map(e => ({
        id: e.id, type: "won" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), raffleId: e.raffleId, usdcAmount: e.usdcAmount,
      })),
    ]

    // Sort newest first
    txs.sort((a, b) => b.timestamp - a.timestamp)

    const profile: ProfileData = {
      wallet: walletRaw ? {
        totalSlots: Number(walletRaw.totalSlots),
        bestStreak: walletRaw.bestStreak,
        totalPoints: walletRaw.totalPoints,
        totalDonated: walletRaw.totalDonated,
        totalReceived: walletRaw.totalReceived,
        totalWins: walletRaw.totalWins,
        totalWinnings: walletRaw.totalWinnings,
      } : null,
      transactions: txs,
    }

    return NextResponse.json(profile, {
      headers: { "Cache-Control": `s-maxage=${CACHE_SECONDS}, stale-while-revalidate` },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[profile]", message)
    return NextResponse.json({ error: "Failed to fetch profile", detail: message }, { status: 500 })
  }
}
