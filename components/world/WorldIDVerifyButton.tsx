"use client"

import { useState, useCallback } from "react"
import { IDKitRequestWidget, orbLegacy } from "@worldcoin/idkit"
import type { IDKitResult, RpContext } from "@worldcoin/idkit"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface WorldIDVerifyButtonProps {
  onSuccess: (result: IDKitResult) => Promise<void>
  isVerifying: boolean
  signal?: string
  className?: string
  disabled?: boolean
  children?: React.ReactNode
}

export function WorldIDVerifyButton({
  onSuccess,
  isVerifying,
  signal,
  className,
  disabled,
  children,
}: WorldIDVerifyButtonProps) {
  const [open, setOpen] = useState(false)
  const [rpContext, setRpContext] = useState<RpContext | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const { toast } = useToast()

  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`

  const handleClick = useCallback(async () => {
    setIsFetching(true)
    try {
      const res = await fetch("/api/worldid/rp-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "booztory-human" }),
      })
      if (!res.ok) throw new Error("World ID not configured. Contact support.")
      const rp = await res.json() as RpContext
      setRpContext(rp)
      setOpen(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start verification"
      toast({ title: "Verification Unavailable", description: msg, variant: "destructive" })
    } finally {
      setIsFetching(false)
    }
  }, [toast])

  const isLoading = isVerifying || isFetching || open

  return (
    <>
      {rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={appId}
          action="booztory-human"
          rp_context={rpContext}
          preset={orbLegacy({ signal })}
          allow_legacy_proofs={true}
          environment="production"
          onSuccess={onSuccess}
        />
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isVerifying ? "Verifying…" : "Loading…"}
          </>
        ) : (
          children ?? "Verify with World ID"
        )}
      </button>
    </>
  )
}
