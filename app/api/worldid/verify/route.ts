import { NextResponse } from "next/server"
import { redis } from "@/lib/ratelimit"

/**
 * POST /api/worldid/verify
 *
 * Cloud-only World ID verification (World ID 4.0 recommended pattern).
 * Forwards the IDKit proof to World's cloud verification API, then stores
 * the nullifier in Redis. No private key, no relayer, no on-chain calls.
 *
 * Per World docs: "If you do not need contract-level enforcement,
 * use POST /v4/verify instead."
 *
 * Body: { proof: IDKitResult, address: string }
 *
 * Env vars required:
 *   WORLD_RP_ID — RP identifier (rp_...) from developer.worldcoin.org
 */
export async function POST(req: Request) {
  const rpId = process.env.WORLD_RP_ID
  if (!rpId) return NextResponse.json({ error: "RP ID not configured" }, { status: 500 })

  let proof: Record<string, unknown>, address: string
  try {
    const body = await req.json()
    proof   = body.proof
    address = (body.address as string)?.toLowerCase()
    if (!proof || !address) throw new Error("Missing proof or address")
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // ── Cloud verify — World's servers verify the ZK proof ────────────────────
  const verifyRes = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...proof, action: "booztory-human" }),
  })

  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}))
    const msg = (err as { detail?: string }).detail ?? "World ID verification failed"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const data = await verifyRes.json() as { nullifier?: string }

  // Store nullifier — prevents re-use and persists worldVerified across sessions
  await redis.set(`worldVerified:${address}`, data.nullifier ?? "1")

  return NextResponse.json({ success: true })
}
