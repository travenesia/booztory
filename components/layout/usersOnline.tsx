"use client"

import { useEffect, useRef, useState } from "react"

const PING_INTERVAL_MS = 20_000

function getVisitorId(): string {
  const key = "bz_vid"
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

export function UsersOnline() {
  const [count, setCount] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const ping = async () => {
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: getVisitorId() }),
      })
      if (res.ok) {
        const data = await res.json()
        setCount(data.count)
      }
    } catch {
      // presence is non-critical — fail silently
    }
  }

  useEffect(() => {
    ping()
    intervalRef.current = setInterval(ping, PING_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  if (count === null) return null

  const label = count === 1 ? "User Online" : "Users Online"

  return (
    <div className="flex items-center gap-1.5">
      {/* Blinking green dot */}
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-700 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-700" />
      </span>
      <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
        {count} {label}
      </span>
    </div>
  )
}
