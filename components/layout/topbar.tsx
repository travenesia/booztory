"use client"

import Link from "next/link"
import { ShieldQuestion } from "iconoir-react"
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
        <Link href="/" className="flex items-center">
          <span className="text-xl font-bold text-gray-900 tracking-tight">Booztory</span>
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
                    ? "text-red-700"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {item.name}
                <span className={cn(
                  "absolute bottom-0 left-0 h-[2px] bg-red-700 transition-all duration-200",
                  pathname === item.href ? "w-full" : "w-0 group-hover:w-full"
                )} />
              </Link>
            ))}
          </nav>
          <ConnectWalletButton />
          {/* FAQ icon — mobile only */}
          <Link href="/faq" className="md:hidden text-gray-900 p-1 hover:text-red-700 transition-colors" aria-label="FAQ">
            <ShieldQuestion size={24} />
          </Link>
        </div>
      </div>
    </header>
  )
}
