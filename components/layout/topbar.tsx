"use client"

import Link from "next/link"
import { ShieldQuestion } from "iconoir-react"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"

export function Topbar() {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50">
      <div className="flex justify-between items-center h-full px-6 mx-auto">
        <Link href="/" className="flex items-center">
          <span className="text-xl font-bold text-gray-900 tracking-tight">Booztory</span>
        </Link>
        <div className="flex items-center space-x-4">
          <ConnectWalletButton />
          <Link href="/faq" className="text-gray-900 p-1 hover:text-red-700 transition-colors" aria-label="FAQ">
            <ShieldQuestion size={24} />
          </Link>
        </div>
      </div>
    </header>
  )
}
