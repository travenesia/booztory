"use client"

import { createContext, useContext, useState } from "react"
import type React from "react"

interface SubmitDrawerContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const SubmitDrawerContext = createContext<SubmitDrawerContextValue>({
  isOpen: false,
  setIsOpen: () => {},
})

export function SubmitDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <SubmitDrawerContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </SubmitDrawerContext.Provider>
  )
}

export const useSubmitDrawer = () => useContext(SubmitDrawerContext)
