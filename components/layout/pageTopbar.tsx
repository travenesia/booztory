"use client"

import Link from "next/link"
import Image from "next/image"
import { HiMiniArrowSmallLeft } from "react-icons/hi2"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"
import { GMButton } from "@/components/modals/gmModal"

interface PageTopbarProps {
  title: string
}

const navItems: { name: string; href: string; badge?: boolean }[] = [
  { name: "Home", href: "/" },
  { name: "Upcoming", href: "/upcoming" },
  { name: "History", href: "/history" },
  { name: "Reward", href: "/reward", badge: true },
  { name: "Sponsor", href: "/sponsor" },
  { name: "FAQ", href: "/faq" },
]

export function PageTopbar({ title }: PageTopbarProps) {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50 border-b border-gray-200">
      <div className="flex items-center h-full px-6 md:px-12">

        {/* Left: logo + nav */}
        <div className="flex items-center gap-4 flex-1">
          <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-[#cc0000]">
            <HiMiniArrowSmallLeft size={24} className="md:hidden" />
            <Image src="/logo-color.svg" alt="Booztory logo" width={28} height={28} priority className="hidden md:block" />
            <span className="hidden md:inline text-xl font-bold text-gray-900 tracking-tight hover:text-gray-900">Booztory</span>
            <span className="hidden md:inline text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-none">Testnet</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors duration-150",
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

        {/* Mobile: page title — absolutely centered */}
        <h1 className="md:hidden absolute left-1/2 -translate-x-1/2 text-lg font-bold text-gray-900">{title}</h1>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* GM button — desktop */}
          <GMButton />

          <a
            href="https://x.com/booztory"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center justify-center w-7 h-7 transition-colors"
            aria-label="Follow on X"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/social/x.svg" alt="X" width={13} height={13} />
          </a>
          <div className="hidden md:block">
            <ConnectWalletButton />
          </div>
        </div>

      </div>
    </header>
  )
}
