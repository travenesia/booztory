"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "iconoir-react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"

interface PageTopbarProps {
  title: string
}

const navItems = [
  { name: "Home", href: "/" },
  { name: "Upcoming", href: "/upcoming" },
  { name: "History", href: "/history" },
  { name: "FAQ", href: "/faq" },
]

export function PageTopbar({ title }: PageTopbarProps) {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50 border-b border-gray-200">
      <div className="flex justify-between items-center h-full px-6 mx-auto">

        {/* Mobile: back arrow | Desktop: logo + Booztory wordmark */}
        <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-[#0090de]">
          <ArrowLeft width={24} height={24} className="md:hidden" />
          <Image src="/logo-color.svg" alt="Booztory logo" width={28} height={28} priority className="hidden md:block" />
          <span className="hidden md:inline text-xl font-bold text-gray-900 tracking-tight hover:text-gray-900">Booztory</span>
        </Link>

        {/* Mobile: page title */}
        <h1 className="md:hidden text-lg font-medium text-gray-900">{title}</h1>

        {/* Desktop: nav links + connect wallet | Mobile: connect wallet + FAQ icon */}
        <div className="flex items-center space-x-4">
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
          <div className="hidden md:block">
            <ConnectWalletButton />
          </div>
        </div>

      </div>
    </header>
  )
}
