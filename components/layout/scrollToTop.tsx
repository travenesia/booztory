"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    try {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth", // Optional: for smooth scrolling
      })
    } catch (error) {
      // Fallback for older browsers
      window.scrollTo(0, 0)
    }
  }, [pathname])

  return null
}
