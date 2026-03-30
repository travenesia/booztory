"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Ticket,
  Megaphone,
  Settings,
  LogOut,
  ExternalLink,
  BadgeCheck,
} from "lucide-react"
import Image from "next/image"
import { useDisconnect } from "wagmi"
import { signOut } from "next-auth/react"

const NAV_ITEMS = [
  { label: "Overview",  href: "/admin",           icon: LayoutDashboard },
  { label: "Raffle",    href: "/admin/raffle",     icon: Ticket         },
  { label: "Sponsors",  href: "/admin/sponsors",   icon: Megaphone      },
  { label: "NFT Pass",  href: "/admin/nft",        icon: BadgeCheck     },
  { label: "Contract",  href: "/admin/contract",   icon: Settings       },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { disconnect } = useDisconnect()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  const handleSignOut = async () => {
    disconnect()
    await signOut({ callbackUrl: "/" })
  }

  return (
    <Sidebar collapsible="icon">

      {/* Header — logo + wordmark */}
      <SidebarHeader className="border-b py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 shrink-0">
                  <Image src="/logo-color.svg" alt="Booztory" width={18} height={18} />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-sm text-gray-900">Booztory</span>
                  <span className="text-[10px] text-amber-600 font-semibold">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const isActive = href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href)
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={collapsed ? label : undefined}
                  >
                    <Link href={href} className="flex items-center gap-2">
                      <Icon size={16} />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — back to app + sign out */}
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={collapsed ? "Back to App" : undefined}>
              <a href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <ExternalLink size={16} />
                <span>Back to App</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip={collapsed ? "Sign Out" : undefined}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  )
}
