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
  Coins,
  Globe,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDisconnect } from "wagmi"
import { signOut } from "next-auth/react"

const NAV_ITEMS = [
  { label: "Overview",  href: "/admin/base",           icon: LayoutDashboard },
  { label: "Raffle",    href: "/admin/base/raffle",     icon: Ticket         },
  { label: "Sponsors",  href: "/admin/base/sponsors",   icon: Megaphone      },
  { label: "NFT Pass",  href: "/admin/base/nft",        icon: BadgeCheck     },
  { label: "Token",     href: "/admin/base/token",      icon: Coins          },
  { label: "Contract",  href: "/admin/base/contract",   icon: Settings       },
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
      <SidebarHeader className="border-b h-[72px] justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin/base" className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center rounded-lg bg-white border border-gray-200 shrink-0 transition-all duration-200",
                  collapsed ? "h-9 w-9" : "h-8 w-8"
                )}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/base.svg" alt="Base" width={collapsed ? 22 : 18} height={collapsed ? 22 : 18} />
                </div>
                {!collapsed && (
                  <div className="flex flex-col leading-none">
                    <span className="font-bold text-sm text-gray-900">Booztory</span>
                    <span className="text-[10px] text-amber-600 font-semibold">Admin</span>
                  </div>
                )}
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
              const isActive = href === "/admin/base"
                ? pathname === "/admin/base"
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
            <SidebarMenuButton asChild tooltip={collapsed ? "World Admin" : undefined}>
              <Link href="/admin/world" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Globe size={16} />
                <span>World Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
