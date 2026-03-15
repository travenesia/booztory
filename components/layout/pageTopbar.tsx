"use client"

import Link from "next/link"
import Image from "next/image"
import { HiMiniArrowSmallLeft } from "react-icons/hi2"
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
      <div className="flex items-center h-full px-6">

        {/* Left: logo + nav */}
        <div className="flex items-center gap-4 flex-1">
          <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-[#cc0000]">
            <HiMiniArrowSmallLeft size={24} className="md:hidden" />
            <Image src="/logo-color.svg" alt="Booztory logo" width={28} height={28} priority className="hidden md:block" />
            <span className="hidden md:inline text-xl font-bold text-gray-900 tracking-tight hover:text-gray-900">Booztory</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  pathname === item.href
                    ? "text-[#aa0000]"
                    : "text-gray-900 hover:text-[#aa0000]"
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile: page title — absolutely centered */}
        <h1 className="md:hidden absolute left-1/2 -translate-x-1/2 text-lg font-medium text-gray-900">{title}</h1>

        {/* Right */}
        <div className="flex items-center">
          <div className="hidden md:block">
            <ConnectWalletButton />
          </div>
        </div>

      </div>
    </header>
  )
}
