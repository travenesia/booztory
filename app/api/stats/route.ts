import { NextResponse } from "next/server"

const QUERY = `{
  wallets(first: 1000) {
    totalSlots
    totalDonated
    totalWins
    totalWinnings
    totalPoints
  }
  gmclaimEvents(first: 1000) {
    boozAmount
  }
  ticketsConvertedEvents(first: 1000) {
    ticketsMinted
    pointsBurned
  }
}`

export async function GET() {
  const subgraphUrl = process.env.SUBGRAPH_URL
  if (!subgraphUrl) {
    return NextResponse.json({ error: "SUBGRAPH_URL not configured" }, { status: 503 })
  }

  try {
    const res = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY }),
    })

    if (!res.ok) {
      throw new Error(`Subgraph responded with ${res.status}`)
    }

    const json = await res.json()
    if (json.errors) {
      throw new Error(json.errors[0]?.message ?? "Subgraph query error")
    }

    const { wallets = [], gmclaimEvents = [], ticketsConvertedEvents = [] } = json.data ?? {}

    // Content
    const totalSlotsMinted = wallets.reduce((sum: number, w: { totalSlots: string }) => sum + Number(w.totalSlots), 0)
    const totalContentHours = parseFloat((totalSlotsMinted * 15 / 60).toFixed(1))
    const totalUniqueCreators = wallets.filter((w: { totalSlots: string }) => Number(w.totalSlots) > 0).length
    const totalUsers = wallets.length

    // Community
    const totalGMClaims = gmclaimEvents.length
    const totalUSDCDonated = parseFloat(
      (wallets.reduce((sum: number, w: { totalDonated: string }) => sum + Number(w.totalDonated), 0) / 1_000_000).toFixed(2)
    )

    // Rewards & Raffle
    const totalBOOZEarned = Math.round(
      gmclaimEvents.reduce((sum: number, e: { boozAmount: string }) => sum + Number(e.boozAmount), 0) / 1e18
    )
    const totalPointsEarned = wallets.reduce((sum: number, w: { totalPoints: string }) => sum + Number(w.totalPoints), 0)
    const totalTicketsIssued = ticketsConvertedEvents.reduce(
      (sum: number, e: { ticketsMinted: string }) => sum + Number(e.ticketsMinted),
      0
    )
    const totalPrizePoolPaid = parseFloat(
      (wallets.reduce((sum: number, w: { totalWinnings: string }) => sum + Number(w.totalWinnings), 0) / 1_000_000).toFixed(2)
    )
    const totalUniqueWinners = wallets.filter((w: { totalWins: string }) => Number(w.totalWins) > 0).length

    return NextResponse.json(
      {
        totalSlotsMinted,
        totalContentHours,
        totalUniqueCreators,
        totalUsers,
        totalGMClaims,
        totalUSDCDonated,
        totalBOOZEarned,
        totalPointsEarned,
        totalTicketsIssued,
        totalPrizePoolPaid,
        totalUniqueWinners,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=1800, stale-while-revalidate",
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
