"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"

export default function ProfileRedirectPage() {
  const { address } = useAccount()
  const router = useRouter()

  useEffect(() => {
    if (address) {
      router.replace(`/profile/${address.toLowerCase()}`)
    }
  }, [address, router])

  if (address) return null

  return (
    <main className="min-h-screen pt-12">
      <PageTopbar title="Profile" />
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
        <span className="text-5xl">👤</span>
        <h2 className="text-lg font-black text-gray-900 uppercase tracking-wide">Connect Your Wallet</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          Connect your wallet to view your profile, transaction history, and stats.
        </p>
        <ConnectWalletButton />
      </div>
      <Navbar />
    </main>
  )
}
