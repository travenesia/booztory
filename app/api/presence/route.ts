import { NextRequest, NextResponse } from "next/server"

// In-memory store: visitorId -> lastSeen (ms). Resets on server restart.
const visitors = new Map<string, number>()
const INACTIVE_TIMEOUT_MS = 60_000 // 60 s

function cleanup() {
  const cutoff = Date.now() - INACTIVE_TIMEOUT_MS
  for (const [id, lastSeen] of visitors) {
    if (lastSeen < cutoff) visitors.delete(id)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const visitorId: unknown = body?.visitorId
    if (!visitorId || typeof visitorId !== "string" || visitorId.length > 64) {
      return NextResponse.json({ error: "Invalid visitorId" }, { status: 400 })
    }
    cleanup()
    visitors.set(visitorId, Date.now())
    return NextResponse.json({ count: visitors.size })
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}

export async function GET() {
  cleanup()
  return NextResponse.json({ count: visitors.size })
}
