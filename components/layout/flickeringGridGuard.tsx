"use client"

import { isWorldApp } from "@/lib/miniapp-flag"
import { FlickeringGrid } from "@/components/ui/flickering-grid"

// FlickeringGrid runs requestAnimationFrame at 60fps on a full-screen canvas.
// In World App's WKWebView the sustained GPU/JS load causes the WebView to become
// unresponsive after ~45-60 seconds, triggering a hard reload. Desktop browsers
// and other mini apps are unaffected due to higher resource budgets.
export function FlickeringGridGuard() {
  if (isWorldApp()) return null
  return (
    <FlickeringGrid
      className="fixed inset-0 z-0 pointer-events-none"
      color="#000000"
      maxOpacity={0.08}
      flickerChance={0.1}
      squareSize={4}
      gridGap={6}
    />
  )
}
