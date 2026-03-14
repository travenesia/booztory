"use client"

import Link from "next/link"
import Image from "next/image"
import { HiOutlineMegaphone } from "react-icons/hi2"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Home", href: "/" },
  { name: "Upcoming", href: "/upcoming" },
  { name: "History", href: "/history" },
  { name: "FAQ", href: "/faq" },
]

export function Topbar() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50 border-b border-gray-200">
      <div className="flex justify-between items-center h-full px-6 mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-color.svg" alt="Booztory logo" width={28} height={28} priority />
          <span className="text-xl font-bold text-gray-900 tracking-tight">Booztory</span>
          <span className="hidden md:inline text-xs italic text-gray-400 leading-none">Live on Base Sepolia, Mainnet Coming Soon</span>
        </Link>
        <div className="flex items-center space-x-1">
          {/* Desktop nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "relative px-3 py-1 text-sm font-medium transition-colors duration-200 group",
                  pathname === item.href
                    ? "text-[#cc0000]"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {item.name}
                <span className={cn(
                  "absolute bottom-0 left-0 h-[2px] bg-[#cc0000] transition-all duration-200",
                  pathname === item.href ? "w-full" : "w-0 group-hover:w-full"
                )} />
              </Link>
            ))}
          </nav>
          {/* X + FAQ icons — mobile/tablet only */}
          <div className="md:hidden flex items-center">
            <a href="https://x.com/booztory" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-7 h-7 rounded-base transition-colors text-gray-900 hover:text-[#cc0000]" aria-label="Follow on X">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <Link href="/faq" className="flex items-center justify-center w-7 h-7 rounded-base transition-colors text-gray-900 hover:text-[#cc0000]" aria-label="FAQ">
              <HiOutlineMegaphone size={16} />
            </Link>
          </div>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  )
}
