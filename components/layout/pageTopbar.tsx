"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { HiMiniArrowSmallLeft, HiChartBar } from "react-icons/hi2"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"
import { GMButton } from "@/components/modals/gmModal"

interface PageTopbarProps {
  title: string
  rightExtra?: React.ReactNode
  mobileTransparent?: boolean
}

const navItems: { name: string; href: string; badge?: boolean }[] = [
  { name: "Home", href: "/" },
  { name: "Upcoming", href: "/upcoming" },
  { name: "History", href: "/history" },
  { name: "Reward", href: "/reward" },
  { name: "Sponsor", href: "/sponsor" },
  { name: "FAQ", href: "/faq" },
]

export function PageTopbar({ title, rightExtra, mobileTransparent }: PageTopbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 h-12 w-full z-50",
      mobileTransparent
        ? "bg-transparent border-none md:bg-white md:border-b md:border-gray-200"
        : "bg-gray-0 border-b border-gray-200"
    )}>
      <div className="relative flex items-center h-full px-6 md:px-12">

        {/* Left: logo */}
        <div className="flex items-center flex-1">
          <Link href="/" className={cn("flex items-center gap-2 hover:text-[#E63946]", mobileTransparent ? "text-white md:text-gray-900" : "text-gray-900")}>
            <HiMiniArrowSmallLeft size={24} className="md:hidden" onClick={(e) => { e.preventDefault(); router.back() }} />
            <Image src="/logo-color.svg" alt="Booztory logo" width={28} height={28} priority className="hidden md:block" />
            <span className="hidden md:inline text-xl font-bold text-gray-900 tracking-tight hover:text-gray-900">Booztory</span>
          </Link>
        </div>

        {/* Center: nav — desktop only */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors duration-150",
                pathname === item.href
                  ? "text-[#E63946]"
                  : "text-gray-900 hover:text-[#E63946]"
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

        {/* Mobile: page title — absolutely centered */}
        <h1 className={cn("md:hidden absolute left-1/2 -translate-x-1/2 text-lg font-bold", mobileTransparent ? "text-white" : "text-gray-900")}>{title}</h1>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Extra slot — mobile only (e.g. shortcut icon on specific pages) */}
          {rightExtra && <div className="md:hidden">{rightExtra}</div>}
          {/* Stats icon — desktop only */}
          <Link
            href="/stats"
            className={cn(
              "hidden md:flex items-center justify-center w-7 h-7 transition-colors",
              pathname === "/stats" ? "text-[#E63946]" : "text-gray-500 hover:text-gray-900"
            )}
            aria-label="Platform Stats"
          >
            <HiChartBar size={18} />
          </Link>
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
