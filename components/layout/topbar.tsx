"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { HiMiniBars3BottomLeft, HiMiniShieldCheck, HiMegaphone, HiMiniForward, HiFolder, HiUser } from "react-icons/hi2"
import { HiBolt, HiChartBar } from "react-icons/hi2"
import { FaRankingStar } from "react-icons/fa6"
import { RiCopperCoinFill } from "react-icons/ri"
import { ConnectWalletButton } from "@/components/wallet/connectWallet"
import { GMButton, GMContent } from "@/components/modals/gmModal"
import { useSponsorAd, useAdCountdown, LiveBadge } from "@/components/ads/sponsorAd"
import { usePathname } from "next/navigation"
import { useAccount } from "wagmi"
import { useIdentity } from "@/hooks/useIdentity"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Drawer } from "vaul"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"

const AVATARS = [
  ...Array.from({ length: 20 }, (_, i) => `/avatars/boy${i + 1}.webp`),
  ...Array.from({ length: 20 }, (_, i) => `/avatars/girl${i + 1}.webp`),
]
function addressAvatar(addr: string): string {
  if (!addr) return AVATARS[0]
  let hash = 0
  for (let i = 2; i < addr.length; i++) {
    hash = (addr.charCodeAt(i) + ((hash << 5) - hash)) | 0
  }
  return AVATARS[Math.abs(hash) % AVATARS.length]
}

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
  const [copied, setCopied] = useState(false)
  const { address } = useAccount()
  const { data: session } = useSession()
  const { avatarUrl, displayName: identityName } = useIdentity(address)
  const sponsorAd = useSponsorAd()
  const adCountdown = useAdCountdown(sponsorAd?.endTime ?? 0)
  const displayName = identityName || session?.user?.username || null
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null

  const handleCopyAddress = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50 border-b border-gray-200">
      <div className="relative flex items-center h-full px-4 md:px-12">

        {/* Hamburger — mobile only */}
        <span
          onClick={() => setMenuOpen(true)}
          className="md:hidden flex items-center justify-center w-8 h-8 mr-1 text-gray-900 hover:text-[#E63946] cursor-pointer transition-colors"
          aria-label="Open menu"
          role="button"
        >
          <HiMiniBars3BottomLeft size={22} />
        </span>

        {/* Left: logo */}
        <div className="flex items-center flex-1">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-color.svg" alt="Booztory logo" width={28} height={28} priority className="hidden md:block" />
            <span className="hidden md:inline text-xl font-bold text-gray-900 tracking-tight">Booztory</span>
            <span className="hidden md:inline text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-none">Testnet</span>
          </Link>
        </div>

        {/* Center: mobile ad teaser — homepage only, hidden on desktop */}
        {sponsorAd && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("booztory:open-ad"))}
            className="md:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 text-[10px] group max-w-[180px]"
          >
            <LiveBadge />
            <span className="text-sky-600 flex-shrink-0">Ads by</span>
            <span className="text-sky-800 font-semibold truncate group-hover:text-sky-900 transition-colors">{sponsorAd.sponsorName}</span>
            <span className="text-sky-500 font-mono tabular-nums flex-shrink-0">{adCountdown}</span>
          </button>
        )}

        {/* Center: nav — desktop only */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-colors duration-150",
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

        {/* Right: icons + wallet */}
        <div className="flex items-center gap-2">
          {/* Stats icon — desktop only */}
          <Link
            href="/stats"
            className="hidden md:flex items-center justify-center w-7 h-7 transition-colors text-gray-500 hover:text-gray-900"
            aria-label="Platform Stats"
          >
            <HiChartBar size={18} />
          </Link>

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
            className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white outline-none after:hidden rounded-tr-[20px] rounded-br-[20px]"
          >
            <Drawer.Title className="sr-only">Menu</Drawer.Title>
            <Drawer.Description className="sr-only">Navigation menu</Drawer.Description>

            {/* Header */}
            <div className="px-5 pt-6 pb-4">
              {address ? (
                <div className="flex items-center gap-3">
                  <img
                    src={avatarUrl || addressAvatar(address)}
                    alt="avatar"
                    className="w-12 h-12 rounded-full flex-shrink-0 object-cover"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-lg font-bold text-gray-900 truncate">
                      {displayName && displayName !== shortAddress ? `Gm, ${displayName} 👋` : "Gm 👋"}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-sm text-gray-500 font-mono">{shortAddress}</span>
                      <button
                        onClick={handleCopyAddress}
                        className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded"
                        aria-label="Copy address"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
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
                { href: "/profile",    label: "Profile",     Icon: HiUser,            color: "text-teal-500"   },
                { href: "/upcoming",    label: "Upcoming",    Icon: HiMiniForward,     color: "text-blue-500"   },
                { href: "/history",    label: "History",     Icon: HiFolder,          color: "text-amber-500"  },
                { href: "/reward",     label: "Reward",      Icon: RiCopperCoinFill,  color: "text-purple-500" },
                { href: "/leaderboard",label: "Leaderboard", Icon: FaRankingStar,     color: "text-amber-500"  },
                { href: "/sponsor",    label: "Sponsor",     Icon: HiMegaphone,       color: "text-indigo-500" },
                { href: "/stats",      label: "Stats",       Icon: HiChartBar,        color: "text-cyan-500"   },
                { href: "/faq",        label: "FAQ",         Icon: HiMiniShieldCheck, color: "text-gray-500"   },
              ].map(({ href, label, Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-sm font-semibold",
                    pathname === href
                      ? "bg-gray-100 text-[#E63946]"
                      : "text-gray-800 hover:bg-gray-100"
                  )}
                >
                  <Icon size={18} className={cn("flex-shrink-0", pathname === href ? "text-[#E63946]" : color)} />
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
