"use client"

import { useState, useCallback, useEffect } from "react"
import { getIsUserVerified } from "@worldcoin/minikit-js/address-book"
import type { IDKitResult } from "@worldcoin/idkit"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { isWorldApp } from "@/lib/miniapp-flag"

const WORLD_CHAIN_RPC = "https://worldchain-mainnet.g.alchemy.com/public"

export function useVerifyHuman(address?: `0x${string}`) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [isOrbVerified, setIsOrbVerified] = useState(false)
  const { data: session, update: updateSession } = useSession()
  const { toast } = useToast()

  const isWorldVerified = session?.user?.worldVerified ?? false

  // Query Address Book contract on World Chain — on-chain, trustworthy orb-verification check.
  // Only runs in World App context where the user has a World Chain wallet address.
  useEffect(() => {
    if (!isWorldApp() || !address) return
    let cancelled = false
    getIsUserVerified(address, WORLD_CHAIN_RPC)
      .then(verified => { if (!cancelled) setIsOrbVerified(verified) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [address])

  /**
   * Cloud verification flow (World ID 4.0 recommended pattern):
   * 1. Backend calls POST /v4/verify/{rp_id} — World's servers verify the ZK proof
   * 2. Nullifier stored in Redis to prevent re-use
   * 3. Session marked worldVerified: true — frontend gates all sensitive actions on this
   *
   * No on-chain ZK proof submission. No private key. No relayer.
   * Per World docs: "If you do not need contract-level enforcement, use POST /v4/verify instead."
   */
  const handleIDKitSuccess = useCallback(async (result: IDKitResult) => {
    if (!address) {
      toast({ title: "Not signed in", description: "Sign in first before verifying.", variant: "destructive" })
      return
    }

    setIsVerifying(true)
    try {
      const res = await fetch("/api/worldid/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof: result, address }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? "Cloud verification failed")
      }

      await updateSession({ worldVerified: true })

      toast({
        title: "World ID Verified!",
        description: "You're verified as a unique human. Welcome!",
        variant: "success",
      })
    } catch (err: unknown) {
      console.error("[useVerifyHuman] error:", err)
      const msg = err instanceof Error ? err.message : "Verification failed"
      toast({ title: "Verification Failed", description: msg, variant: "destructive" })
    } finally {
      setIsVerifying(false)
    }
  }, [address, toast, updateSession])

  // In World App: accept either session worldVerified (from IDKit ZK flow) OR on-chain
  // Address Book orb-verification (getIsUserVerified queries 0x57b9...330D on World Chain).
  const canProceed = !isWorldApp() || isWorldVerified || isOrbVerified

  return {
    handleIDKitSuccess,
    isWorldVerified,
    isOrbVerified,
    requireVerification: isWorldApp(), // always true in World App context
    isVerifying,
    canProceed,
  }
}
