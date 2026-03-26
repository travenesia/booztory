"use client"

import { useState, useEffect } from "react"
import { HiChevronUp } from "react-icons/hi2"

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-20 md:bottom-14 right-4 z-50 p-0 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
      aria-label="Scroll to top"
    >
      <HiChevronUp size={18} strokeWidth={1.5} stroke="currentColor" />
    </button>
  )
}
