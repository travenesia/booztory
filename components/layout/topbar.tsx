"use client"

import Link from "next/link"
import Image from "next/image"
import { HiOutlineMegaphone } from "react-icons/hi2"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems: { name: string; href: string; badge?: boolean }[] = [
  { name: "Home", href: "/" },
  { name: "Upcoming", href: "/upcoming" },
  { name: "History", href: "/history" },
  { name: "Reward", href: "/reward", badge: true },
  { name: "FAQ", href: "/faq" },
]

export function Topbar() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50 border-b border-gray-200">
      <div className="flex items-center h-full px-6">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-4 flex-1">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-color.svg" alt="Booztory logo" width={28} height={28} priority />
            <span className="text-xl font-bold text-gray-900 tracking-tight">Booztory</span>
            <span className="hidden md:inline text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-none">Testnet</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors duration-150",
                pathname === item.href
                  ? "text-[#aa0000]"
                  : "text-gray-900 hover:text-[#aa0000]"
              )}
            >
              {item.name}
              {item.badge && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-none">
                  New
                </span>
              )}
            </Link>
          ))}
          </nav>
        </div>

        {/* Right: mobile icons + wallet */}
        <div className="flex items-center gap-2">
          {/* X icon — desktop */}
          <a
            href="https://x.com/booztory"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center justify-center w-7 h-7 transition-colors"
            aria-label="Follow on X"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#111827" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
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
