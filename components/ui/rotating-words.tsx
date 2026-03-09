"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

interface RotatingWordsProps {
  words: string[]
  interval?: number
  className?: string
}

export function RotatingWords({ words, interval = 2400, className }: RotatingWordsProps) {
  const [index, setIndex] = useState(0)
  const [minWidth, setMinWidth] = useState(0)
  const measureRef = useRef<HTMLSpanElement>(null)

  // Measure the widest word once on mount so the container never shifts
  useEffect(() => {
    if (!measureRef.current) return
    const el = measureRef.current
    let max = 0
    words.forEach((w) => {
      el.textContent = w
      max = Math.max(max, el.offsetWidth)
    })
    setMinWidth(max)
  }, [words])

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), interval)
    return () => clearInterval(timer)
  }, [words.length, interval])

  return (
    <>
      {/* Hidden span used only for measuring word widths */}
      <span
        ref={measureRef}
        aria-hidden
        className={`invisible absolute pointer-events-none font-bold ${className ?? ""}`}
      />

      <span
        className="relative inline-block overflow-hidden"
        style={{ minWidth: minWidth || undefined, verticalAlign: "bottom" }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={words[index]}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
            className={`inline-block ${className ?? ""}`}
          >
            {words[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </>
  )
}
