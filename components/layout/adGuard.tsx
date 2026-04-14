"use client"

import { usePathname } from "next/navigation"
import { SponsorAdSidebar, LivePill } from "@/providers/lazy-ui"

const SUPPRESS_PATHS = ["/admin"]

export function AdGuard() {
  const pathname = usePathname()
  const suppress = SUPPRESS_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))
  if (suppress) return null
  return (
    <>
      <SponsorAdSidebar />
      <LivePill />
    </>
  )
}
