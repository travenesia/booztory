"use client"

import { HiHome, HiMiniForward, HiFolder, HiFire } from "react-icons/hi2"
import { RiCopperCoinFill } from "react-icons/ri"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSubmitDrawer } from "@/providers/submit-drawer-provider"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"

const navItems = [
  { name: "Home", href: "/", icon: HiHome },
  { name: "Upcoming", href: "/upcoming", icon: HiMiniForward },
]

const navItemsRight = [
  { name: "History", href: "/history", icon: HiFolder },
  { name: "Reward", href: "/reward", icon: RiCopperCoinFill },
]

export function Navbar() {
  const pathname = usePathname()
  const { setIsOpen } = useSubmitDrawer()
  const { status } = useSession()
  const { toast } = useToast()

  const handleSubmitClick = () => {
    if (status !== "authenticated") {
      toast({
        title: "Connect Wallet First",
        description: "You need to connect your wallet to submit content.",
        variant: "warning",
      })
      return
    }
    setIsOpen(true)
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 w-full h-[52px]">
      <div className="w-full h-full flex items-center">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-1 items-center justify-center py-2 transition-all duration-200",
                isActive ? "text-red-600 scale-110" : "text-gray-400 hover:text-gray-700",
              )}
              aria-label={item.name}
            >
              <item.icon size={24} />
            </Link>
          )
        })}

        {/* Center CTA */}
        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={handleSubmitClick}
            className="flex items-center justify-center w-16 h-16 rounded-full bg-red-600 shadow-md -mt-8 border-2 border-white transition-transform duration-200 active:scale-95"
            aria-label="Submit Content"
          >
            <HiFire size={40} className="text-white" />
          </button>
        </div>

        {navItemsRight.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-1 items-center justify-center py-2 transition-all duration-200",
                isActive ? "text-red-600 scale-110" : "text-gray-400 hover:text-gray-700",
              )}
              aria-label={item.name}
            >
              <item.icon size={24} />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
