import { NextRequest, NextResponse } from "next/server"
import { createPublicClient, http } from "viem"
import { baseSepolia, base as baseChain } from "viem/chains"
import { RAFFLE_ADDRESS, RAFFLE_ABI } from "@/lib/contract"

const SUBGRAPH_URL = process.env.SUBGRAPH_URL

const APP_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_APP_CHAIN_ID ?? "84532")
const viemChain = APP_CHAIN_ID === 8453 ? baseChain : baseSepolia
const publicClient = createPublicClient({ chain: viemChain, transport: http() })

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
      id tokenId totalAmount creator txHash blockTimestamp
    }
    donationsReceived: donationEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { creator: "${addr}" }
    ) {
      id tokenId creatorAmount donor txHash blockTimestamp
    }
    wins: winEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { winner: "${addr}" }
    ) {
      id raffleId usdcAmount txHash blockTimestamp
    }
    ticketsConverted: ticketsConvertedEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { user: "${addr}" }
    ) {
      id pointsBurned ticketsMinted txHash blockTimestamp
    }
    raffleEntries: raffleEnteredEvents(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
      where: { user: "${addr}" }
    ) {
      id raffleId ticketAmount txHash blockTimestamp
    }
    drawnRaffles(first: 1000) {
      id
    }
  }`
}

export type TxType = "mint" | "gm" | "points" | "donated" | "received" | "won" | "tickets" | "entered"

export interface TxItem {
  id: string
  type: TxType
  txHash: string
  timestamp: number
  // mint
  mintType?: string       // "standard" | "discount" | "free"
  tokenId?: string
  // gm
  streakCount?: number
  boozAmount?: string     // raw 18-decimal string
  // points (merged into parent or standalone)
  pointsAmount?: string   // raw units
  // donation
  counterparty?: string   // "to" address (donated) or "from" address (received)
  usdcAmount?: string     // raw 6-decimal string
  // raffle win
  raffleId?: string
  // tickets converted
  pointsBurned?: string
  ticketsMinted?: string
  // raffle entry
  ticketAmount?: string
  raffleDrawn?: boolean
  raffleEndTime?: number  // unix seconds — used to distinguish Live vs Awaiting Draw
  wonAmount?: string      // set if user won this raffle
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

// ── Merge events sharing the same txHash ──────────────────────────────────────
// Rules:
//   {gm, points}     → keep gm, attach pointsAmount from points
//   {mint, points}   → keep mint, attach pointsAmount from points
//   {donated, points}→ keep donated, attach pointsAmount from points
//   everything else  → pass through individually
function mergeTxs(txs: TxItem[]): TxItem[] {
  const groups = new Map<string, TxItem[]>()
  for (const tx of txs) {
    const arr = groups.get(tx.txHash) ?? []
    arr.push(tx)
    groups.set(tx.txHash, arr)
  }

  const result: TxItem[] = []
  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    // Prefer free/discount over standard — _createSlot always emits SlotMinted
    // so free/discount mints produce two SlotMintEvent entries (standard + specific)
    const mint    = group.find(t => t.type === "mint" && t.mintType !== "standard")
                 ?? group.find(t => t.type === "mint")
    const gm      = group.find(t => t.type === "gm")
    const donated = group.find(t => t.type === "donated")
    const pts     = group.find(t => t.type === "points")

    if (mint && pts) {
      result.push({ ...mint, pointsAmount: pts.pointsAmount })
      // Drop all mint entries (including the duplicate standard one) + pts
      for (const t of group) if (t.type !== "mint" && t !== pts) result.push(t)
      continue
    }

    if (mint) {
      result.push(mint)
      // Drop duplicate mint entries, push everything else
      for (const t of group) if (t.type !== "mint") result.push(t)
      continue
    }
    if (gm && pts) {
      result.push({ ...gm, pointsAmount: pts.pointsAmount })
      for (const t of group) if (t !== gm && t !== pts) result.push(t)
      continue
    }
    if (donated && pts) {
      result.push({ ...donated, pointsAmount: pts.pointsAmount })
      for (const t of group) if (t !== donated && t !== pts) result.push(t)
      continue
    }

    // Unknown group — push all individually
    for (const t of group) result.push(t)
  }

  return result
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

    type WalletRaw       = { totalSlots: string; bestStreak: number; totalPoints: string; totalDonated: string; totalReceived: string; totalWins: number; totalWinnings: string }
    type MintRaw         = { id: string; tokenId: string; mintType: string; txHash: string; blockTimestamp: string }
    type GmRaw           = { id: string; streakCount: number; boozAmount: string; txHash: string; blockTimestamp: string }
    type PointsRaw       = { id: string; amount: string; txHash: string; blockTimestamp: string }
    type DonSentRaw      = { id: string; tokenId: string; totalAmount: string; creator: string; txHash: string; blockTimestamp: string }
    type DonRecvRaw      = { id: string; tokenId: string; creatorAmount: string; donor: string; txHash: string; blockTimestamp: string }
    type WinRaw          = { id: string; raffleId: string; usdcAmount: string; txHash: string; blockTimestamp: string }
    type TicketsConvRaw  = { id: string; pointsBurned: string; ticketsMinted: string; txHash: string; blockTimestamp: string }
    type RaffleEntryRaw  = { id: string; raffleId: string; ticketAmount: string; txHash: string; blockTimestamp: string }
    type DrawnRaffleRaw  = { id: string }

    const walletRaw       = data.wallet            as WalletRaw | null
    const mints           = (data.mints            as MintRaw[]        ) ?? []
    const gmClaims        = (data.gmClaims         as GmRaw[]          ) ?? []
    const points          = (data.points           as PointsRaw[]      ) ?? []
    const donSent         = (data.donationsSent    as DonSentRaw[]     ) ?? []
    const donRecv         = (data.donationsReceived as DonRecvRaw[]    ) ?? []
    const wins            = (data.wins             as WinRaw[]         ) ?? []
    const ticketsConv     = (data.ticketsConverted as TicketsConvRaw[] ) ?? []
    const raffleEntries   = (data.raffleEntries    as RaffleEntryRaw[] ) ?? []
    const drawnRafflesRaw = (data.drawnRaffles     as DrawnRaffleRaw[] ) ?? []

    // Build lookup sets for raffle enrichment
    const drawnRaffleIds = new Set(drawnRafflesRaw.map(r => r.id))
    // Map raffleId → usdcAmount won (for entries this user won)
    const wonByRaffleId = new Map<string, string>()
    for (const w of wins) {
      wonByRaffleId.set(w.raffleId, w.usdcAmount)
    }

    const rawTxs: TxItem[] = [
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
        counterparty: e.creator,
      })),
      ...donRecv.map(e => ({
        id: `recv-${e.id}`, type: "received" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), tokenId: e.tokenId, usdcAmount: e.creatorAmount,
        counterparty: e.donor,
      })),
      ...wins.map(e => ({
        id: e.id, type: "won" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), raffleId: e.raffleId, usdcAmount: e.usdcAmount,
      })),
      ...ticketsConv.map(e => ({
        id: e.id, type: "tickets" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp), pointsBurned: e.pointsBurned, ticketsMinted: e.ticketsMinted,
      })),
      ...raffleEntries.map(e => ({
        id: e.id, type: "entered" as TxType, txHash: e.txHash,
        timestamp: Number(e.blockTimestamp),
        raffleId: e.raffleId,
        ticketAmount: e.ticketAmount,
        raffleDrawn: drawnRaffleIds.has(e.raffleId),
        raffleEndTime: undefined as number | undefined,
        wonAmount: wonByRaffleId.get(e.raffleId),
      })),
    ]

    // Fetch endTime for unique non-drawn raffleIds
    const liveEntries = rawTxs.filter(t => t.type === "entered" && !t.raffleDrawn)
    if (liveEntries.length > 0 && RAFFLE_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      const uniqueRaffleIds = [...new Set(liveEntries.map(t => t.raffleId!))]
      const endTimes = await Promise.all(
        uniqueRaffleIds.map(async (raffleId) => {
          try {
            const result = await publicClient.readContract({
              address: RAFFLE_ADDRESS,
              abi: RAFFLE_ABI,
              functionName: "getRaffle",
              args: [BigInt(raffleId)],
            })
            return { raffleId, endTime: Number(result[3]) }
          } catch {
            return { raffleId, endTime: 0 }
          }
        })
      )
      const endTimeMap = new Map(endTimes.map(e => [e.raffleId, e.endTime]))
      for (const tx of rawTxs) {
        if (tx.type === "entered" && !tx.raffleDrawn && tx.raffleId !== undefined) {
          tx.raffleEndTime = endTimeMap.get(tx.raffleId)
        }
      }
    }

    // Merge same-txHash events and sort newest first
    const txs = mergeTxs(rawTxs).sort((a, b) => b.timestamp - a.timestamp)

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
