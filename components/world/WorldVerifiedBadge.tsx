"use client"

import { useState } from "react"

interface WorldVerifiedBadgeProps {
  verified: boolean
  className?: string
}

export function WorldVerifiedBadge({ verified, className = "w-[1em] h-[1em]" }: WorldVerifiedBadgeProps) {
  const [show, setShow] = useState(false)
  const label = verified ? "Human Verified" : "Not Verified"

  return (
    <span
      className="relative inline-flex items-center flex-shrink-0"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(true)}
      onTouchEnd={() => setTimeout(() => setShow(false), 1200)}
    >
      <img
        src={verified ? "/badge/verified.svg" : "/badge/notverified.svg"}
        alt={label}
        aria-label={label}
        className={className}
      />
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded bg-gray-900 text-white text-[10px] font-medium whitespace-nowrap pointer-events-none z-50 shadow-md">
          {label}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}
