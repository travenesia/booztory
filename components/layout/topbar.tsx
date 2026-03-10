"use client"

import Link from "next/link"
import { Book } from "iconoir-react"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function Topbar() {
  const pathname = usePathname()

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Upcoming", href: "/upcoming" },
    { name: "History", href: "/history" },
    { name: "FAQ", href: "/faq" },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50 border-b border-gray-200">
      <div className="flex justify-between items-center h-full px-6 mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900 tracking-tight">Booztory</span>
          <span className="hidden md:inline text-xs italic text-gray-400 leading-none">Live on Base Sepolia, Mainnet Coming Soon</span>
        </Link>
        <div className="flex items-center space-x-4">
          {/* Desktop nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "relative px-3 py-1 text-sm font-medium transition-colors duration-200 group",
                  pathname === item.href
                    ? "text-[#0090de]"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {item.name}
                <span className={cn(
                  "absolute bottom-0 left-0 h-[2px] bg-[#0090de] transition-all duration-200",
                  pathname === item.href ? "w-full" : "w-0 group-hover:w-full"
                )} />
              </Link>
            ))}
          </nav>
          {/* FAQ icon — mobile/tablet only */}
          <Link href="/faq" className="md:hidden p-1 transition-colors text-gray-900 hover:text-[#0090de]" aria-label="FAQ">
            <Book size={24} />
          </Link>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  )
}
