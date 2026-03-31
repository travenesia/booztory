import { NextResponse } from "next/server"
import { dataLimiter, getIp } from "@/lib/ratelimit"

// ── Pagination helper ──────────────────────────────────────────────────────────
// The Graph caps `first` at 1000 and `skip` at 5000. We loop pages until a
// partial page is returned, giving us up to 6 000 records per entity — enough
// for any early-stage stats query. Each call is a separate POST to the subgraph,
// so entities are fetched in parallel via Promise.all in the handler below.
async function fetchAll<T>(url: string, entity: string, fields: string): Promise<T[]> {
  const all: T[] = []
  let skip = 0
  for (;;) {
    const q = `{ r: ${entity}(first: 1000, skip: ${skip}) { ${fields} } }`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    })
    if (!res.ok) throw new Error(`Subgraph responded with ${res.status}`)
    const json = await res.json()
    if (json.errors) throw new Error(json.errors[0]?.message ?? "Subgraph query error")
    const page: T[] = json.data?.r ?? []
    all.push(...page)
    if (page.length < 1000) break
    skip += 1000
    if (skip > 5000) break // The Graph skip ceiling
  }
  return all
}

export async function GET(request: Request) {
  const { success } = await dataLimiter.limit(getIp(request))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const subgraphUrl = process.env.SUBGRAPH_URL
  if (!subgraphUrl) {
    return NextResponse.json({ error: "SUBGRAPH_URL not configured" }, { status: 503 })
  }

  try {
    const [
      wallets,
      gmclaimEvents,
      ticketsConvertedEvents,
      donationEvents,
      drawnRaffles,
      slotMintEvents,
      raffleEnteredEvents,
    ] = await Promise.all([
      fetchAll<{ totalSlots: string; totalDonated: string; totalWins: string; totalWinnings: string; totalPoints: string }>(
        subgraphUrl, "wallets", "id totalSlots totalDonated totalWins totalWinnings totalPoints"
      ),
      fetchAll<{ boozAmount: string }>(
        subgraphUrl, "gmclaimEvents", "id boozAmount"
      ),
      fetchAll<{ ticketsMinted: string; pointsBurned: string }>(
        subgraphUrl, "ticketsConvertedEvents", "id ticketsMinted pointsBurned"
      ),
      fetchAll<{ id: string }>(
        subgraphUrl, "donationEvents", "id"
      ),
      fetchAll<{ id: string }>(
        subgraphUrl, "drawnRaffles", "id"
      ),
      fetchAll<{ mintType: string }>(
        subgraphUrl, "slotMintEvents", "id mintType"
      ),
      fetchAll<{ ticketAmount: string }>(
        subgraphUrl, "raffleEnteredEvents", "id ticketAmount"
      ),
    ])

    // ── Content ──────────────────────────────────────────────────────────────
    const totalSlotsMinted     = slotMintEvents.length
    const totalContentHours    = parseFloat((totalSlotsMinted * 15 / 60).toFixed(1))
    const totalUniqueCreators  = wallets.filter(w => Number(w.totalSlots) > 0).length
    const totalUsers           = wallets.length
    const totalStandardMints   = slotMintEvents.filter(e => e.mintType === "standard").length
    const totalDiscountMints   = slotMintEvents.filter(e => e.mintType === "discount").length
    const totalFreeMints       = slotMintEvents.filter(e => e.mintType === "free").length

    // ── Community ─────────────────────────────────────────────────────────────
    const totalGMClaims        = gmclaimEvents.length
    const totalUSDCDonated     = parseFloat(
      (wallets.reduce((s, w) => s + Number(w.totalDonated), 0) / 1_000_000).toFixed(2)
    )
    const totalDonationCount   = donationEvents.length

    // ── Rewards & Raffle ──────────────────────────────────────────────────────
    const totalBOOZEarned      = Math.round(
      gmclaimEvents.reduce((s, e) => s + Number(e.boozAmount), 0) / 1e18
    )
    const totalPointsEarned    = wallets.reduce((s, w) => s + Number(w.totalPoints), 0)
    const totalTicketsIssued   = ticketsConvertedEvents.reduce((s, e) => s + Number(e.ticketsMinted), 0)
    const totalPointsBurned    = ticketsConvertedEvents.reduce((s, e) => s + Number(e.pointsBurned), 0)
    const totalRaffleEntries   = raffleEnteredEvents.reduce((s, e) => s + Number(e.ticketAmount), 0)
    const totalRafflesDrawn    = drawnRaffles.length
    const totalPrizePoolPaid   = parseFloat(
      (wallets.reduce((s, w) => s + Number(w.totalWinnings), 0) / 1_000_000).toFixed(2)
    )
    const totalUniqueWinners   = wallets.filter(w => Number(w.totalWins) > 0).length

    return NextResponse.json(
      {
        totalSlotsMinted,
        totalContentHours,
        totalUniqueCreators,
        totalUsers,
        totalStandardMints,
        totalDiscountMints,
        totalFreeMints,
        totalGMClaims,
        totalUSDCDonated,
        totalDonationCount,
        totalBOOZEarned,
        totalPointsEarned,
        totalTicketsIssued,
        totalPointsBurned,
        totalRaffleEntries,
        totalRafflesDrawn,
        totalPrizePoolPaid,
        totalUniqueWinners,
      },
      { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate" } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
