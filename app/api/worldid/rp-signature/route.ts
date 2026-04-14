import { signRequest } from "@worldcoin/idkit"
import { NextResponse } from "next/server"

/**
 * POST /api/worldid/rp-signature
 *
 * Generates a short-lived RP context required by IDKit v4 to authenticate
 * the verification request. Called by WorldIDVerifyButton before opening
 * the IDKit widget.
 *
 * Env vars required:
 *   WORLD_RP_ID         — RP identifier from developer.worldcoin.org (e.g. "rp_xxxxxxxx")
 *   WORLD_RP_SIGNING_KEY — ECDSA private key hex from Developer Portal (keep secret, server-side only)
 */
export async function POST(req: Request) {
  const rpId = process.env.WORLD_RP_ID
  const signingKey = process.env.WORLD_RP_SIGNING_KEY

  if (!rpId || !signingKey) {
    return NextResponse.json(
      { error: "World ID RP credentials not configured" },
      { status: 500 }
    )
  }

  try {
    // action is fixed — must match the action name in Developer Portal
    const action = "booztory-human"

    // signRequest generates a fresh nonce + ECDSA signature (valid for 5 minutes)
    const sig = signRequest(action, signingKey)

    // Return RpContext shape expected by IDKitRequestConfig
    return NextResponse.json({
      rp_id: rpId,
      nonce: sig.nonce,
      created_at: sig.createdAt,
      expires_at: sig.expiresAt,
      signature: sig.sig,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to sign request"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
