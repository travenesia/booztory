"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { HiMiniBars3BottomLeft, HiMiniShieldCheck, HiMegaphone, HiMiniForward, HiFolder } from "react-icons/hi2"
import { HiBolt } from "react-icons/hi2"
import { FaRankingStar } from "react-icons/fa6"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"
import { GMButton, GMContent } from "@/components/modals/gmModal"
import { usePathname } from "next/navigation"
import { useAccount } from "wagmi"
import { useWalletName } from "@/hooks/useWalletName"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Drawer } from "vaul"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"

const navItems: { name: string; href: string; badge?: boolean }[] = [
  { name: "Home", href: "/" },
  { name: "Upcoming", href: "/upcoming" },
  { name: "History", href: "/history" },
  { name: "Reward", href: "/reward" },
  { name: "Sponsor", href: "/sponsor" },
  { name: "FAQ", href: "/faq" },
]

export function Topbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [gmOpen, setGmOpen] = useState(false)
  const { address } = useAccount()
  const { data: session } = useSession()
  const resolvedName = useWalletName(address)
  const displayName = resolvedName || session?.user?.username || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null)

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50 border-b border-gray-200">
      <div className="flex items-center h-full px-4 md:px-12">

        {/* Hamburger — mobile only */}
        <span
          onClick={() => setMenuOpen(true)}
          className="md:hidden flex items-center justify-center w-8 h-8 mr-1 text-gray-900 hover:text-[#cc0000] cursor-pointer transition-colors"
          aria-label="Open menu"
          role="button"
        >
          <HiMiniBars3BottomLeft size={22} />
        </span>

        {/* Left: logo + nav */}
        <div className="flex items-center gap-4 flex-1">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-color.svg" alt="Booztory logo" width={28} height={28} priority className="hidden md:block" />
            <span className="hidden md:inline text-xl font-bold text-gray-900 tracking-tight">Booztory</span>
            <span className="hidden md:inline text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-none">Testnet</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-colors duration-150",
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

        {/* Right: icons + wallet */}
        <div className="flex items-center gap-2">
          {/* GM button — desktop only */}
          <GMButton />

          {/* X icon — desktop only */}
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

          <ConnectWalletButton />
        </div>
      </div>

      {/* ── Hamburger Vaul Drawer (left) — mobile only ──────────────────────────── */}
      <Drawer.Root direction="left" open={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Drawer.Content
            className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white outline-none after:hidden"
          >
            <Drawer.Title className="sr-only">Menu</Drawer.Title>
            <Drawer.Description className="sr-only">Navigation menu</Drawer.Description>

            {/* Header */}
            <div className="px-5 pt-6 pb-4">
              {displayName ? (
                <span className="text-base font-bold text-gray-900 truncate block max-w-[200px]">
                  👋 Gm, {displayName}
                </span>
              ) : (
                <span className="text-xl font-bold text-gray-900 tracking-tight">Booztory</span>
              )}
            </div>

            <div className="mx-5 border-t border-gray-200" />

            {/* Primary items */}
            <div className="flex flex-col px-3 py-3 gap-0.5">
              <button
                onClick={() => { setMenuOpen(false); setTimeout(() => setGmOpen(true), 200) }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-800 hover:bg-gray-100 active:bg-gray-100 transition-colors text-sm font-semibold w-full text-left"
              >
                <HiBolt size={18} className="text-yellow-400 flex-shrink-0" />
                Daily GM
              </button>

              <a
                href="https://x.com/booztory"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-800 hover:bg-gray-100 active:bg-gray-100 transition-colors text-sm font-semibold"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/social/x.svg" alt="X" width={17} height={17} className="flex-shrink-0" />
                Follow Us
              </a>
            </div>

            <div className="mx-5 border-t border-gray-200" />

            {/* Page links */}
            <div className="flex flex-col px-3 py-3 gap-0.5">
              {[
                { href: "/upcoming", label: "Upcoming",  Icon: HiMiniForward,  color: "text-blue-500"   },
                { href: "/history",  label: "History",   Icon: HiFolder,       color: "text-amber-500"  },
                { href: "/reward",   label: "Reward",    Icon: FaRankingStar,  color: "text-purple-500" },
                { href: "/sponsor",  label: "Sponsor",   Icon: HiMegaphone,    color: "text-indigo-500" },
                { href: "/faq",      label: "FAQ",       Icon: HiMiniShieldCheck, color: "text-gray-500" },
              ].map(({ href, label, Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-sm font-semibold",
                    pathname === href
                      ? "bg-gray-100 text-[#aa0000]"
                      : "text-gray-800 hover:bg-gray-100"
                  )}
                >
                  <Icon size={18} className={cn("flex-shrink-0", pathname === href ? "text-[#aa0000]" : color)} />
                  {label}
                </Link>
              ))}
            </div>

            {/* Version */}
            <div className="mt-auto px-6 py-5">
              <span className="text-xs text-gray-400">Booztory Version 0.1.0</span>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* ── GM Sheet (triggered from hamburger) — mobile only ───────────────────── */}
      <Sheet open={gmOpen} onOpenChange={setGmOpen}>
        <SheetContent
          side="bottom"
          className="rounded-tl-2xl rounded-tr-2xl border-t border-gray-200 outline-none p-0"
          style={{ background: "linear-gradient(160deg, #f0f4ff 0%, #e8f0fe 40%, #f5f7ff 100%)" }}
        >
          <SheetTitle className="sr-only">Daily GM</SheetTitle>
          <SheetDescription className="sr-only">Daily GM streak claim</SheetDescription>
          <GMContent onClose={() => setGmOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
