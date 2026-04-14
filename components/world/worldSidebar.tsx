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
import { LayoutDashboard, Settings, Coins, ShieldCheck, LogOut, ExternalLink, Database, Ticket, Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDisconnect } from "wagmi"
import { signOut } from "next-auth/react"

const NAV_ITEMS = [
  { label: "Overview",     href: "/admin/world",              icon: LayoutDashboard },
  { label: "Raffle",       href: "/admin/world/raffle",       icon: Ticket          },
  { label: "Sponsors",     href: "/admin/world/sponsors",     icon: Megaphone       },
  { label: "Verification", href: "/admin/world/verification", icon: ShieldCheck     },
  { label: "Token",        href: "/admin/world/token",        icon: Coins           },
  { label: "Contract",     href: "/admin/world/contract",     icon: Settings        },
]

export function WorldSidebar() {
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

      <SidebarHeader className="border-b h-[72px] justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin/world" className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center rounded-lg bg-blue-600 shrink-0 transition-all duration-200",
                  collapsed ? "h-9 w-9" : "h-8 w-8"
                )}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/world.svg" alt="World" width={collapsed ? 22 : 18} height={collapsed ? 22 : 18} className="brightness-0 invert" />
                </div>
                {!collapsed && (
                  <div className="flex flex-col leading-none">
                    <span className="font-bold text-sm text-gray-900">Booztory</span>
                    <span className="text-[10px] text-blue-600 font-semibold">World Admin</span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const isActive = href === "/admin/world"
                ? pathname === "/admin/world"
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

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={collapsed ? "Base Admin" : undefined}>
              <Link href="/admin/base" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Database size={16} />
                <span>Base Admin</span>
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
