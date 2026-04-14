"use client"

import { useAccount, useReadContract, useSwitchChain } from "wagmi"
import { useSession } from "next-auth/react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { WorldSidebar } from "@/components/world/worldSidebar"
import { Toaster } from "@/components/ui/toaster"
import { WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI } from "@/lib/contractWorld"
import { WORLD_CHAIN } from "@/lib/wagmi"
import { Loader2, ShieldAlert } from "lucide-react"
import { useEffect } from "react"

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm w-full">
      <ShieldAlert className="h-10 w-10 sm:h-12 sm:w-12 text-destructive" />
      <p className="text-base sm:text-lg font-semibold text-gray-900">Access Denied</p>
      <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">{message}</p>
      <a href="/" className="text-sm text-blue-600 hover:underline">← Back to Booztory</a>
    </div>
  )
}

export default function WorldAdminLayout({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chainId: currentChain } = useAccount()
  const { switchChain } = useSwitchChain()
  const { status, data: session } = useSession()
  const resolvedAddress = (address ?? session?.user?.walletAddress) as `0x${string}` | undefined

  const { data: ownerAddress, isLoading: ownerLoading } = useReadContract({
    address: WORLD_BOOZTORY_ADDRESS,
    abi: WORLD_BOOZTORY_ABI,
    functionName: "owner",
    chainId: WORLD_CHAIN.id,
    query: { enabled: !!resolvedAddress },
  })

  const isOwner = !!(resolvedAddress && ownerAddress &&
    resolvedAddress.toLowerCase() === (ownerAddress as string).toLowerCase())

  const loading = status === "loading" || ownerLoading

  useEffect(() => {
    if (isOwner && currentChain !== WORLD_CHAIN.id) switchChain({ chainId: WORLD_CHAIN.id })
  }, [isOwner, currentChain, switchChain])

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : !isConnected || status === "unauthenticated" ? (
        <AccessDenied message="Connect your wallet to access the World admin panel." />
      ) : !isOwner ? (
        <AccessDenied message={"This is not the World contract owner.\nOnly the deployer wallet has access."} />
      ) : (
        <SidebarProvider className="w-full h-full">
          <WorldSidebar />
          <SidebarInset className="flex flex-col">
            <header className="flex h-[72px] items-center gap-2 border-b px-4 shrink-0 sticky top-0 bg-background z-10">
              <SidebarTrigger className="-ml-1" />
              <span className="text-sm font-semibold text-muted-foreground">World Admin</span>
            </header>
            <main className="flex-1 p-6 overflow-y-auto">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      )}
      <Toaster />
    </div>
  )
}
