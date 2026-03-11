"use client"

import { Home, SkipNext, Clock } from "iconoir-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "Upcoming", href: "/upcoming", icon: SkipNext },
  { name: "History", href: "/history", icon: Clock },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-red-700 shadow-lg z-50 w-full h-[52px] pb-1">
      <div className="w-full h-full flex justify-around items-center px-6 mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center py-2 px-5 transition-all duration-200",
                isActive ? "text-white scale-110" : "text-red-100 opacity-80 hover:text-white hover:opacity-100",
              )}
              aria-label={item.name}
            >
              <item.icon width={24} height={24} />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
