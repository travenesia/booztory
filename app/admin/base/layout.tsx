"use client"

import { useAccount, useReadContract, useSwitchChain } from "wagmi"
import { useSession } from "next-auth/react"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin/adminSidebar"
import { Toaster } from "@/components/ui/toaster"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI } from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"
import { Loader2, ShieldAlert } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chainId: currentChain } = useAccount()
  const { switchChain } = useSwitchChain()
  const { status, data: session } = useSession()
  const resolvedAddress = (address ?? session?.user?.walletAddress) as `0x${string}` | undefined

  const { data: ownerAddress, isLoading: ownerLoading } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "owner",
  })

  const isOwner =
    !!(resolvedAddress && ownerAddress && resolvedAddress.toLowerCase() === (ownerAddress as string).toLowerCase())

  const loading = status === "loading" || ownerLoading
  const isWrongChain = isOwner && !!currentChain && currentChain !== APP_CHAIN.id

  return (
    // Fixed overlay — breaks out of root layout's max-w-[650px] container
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (!isConnected && !resolvedAddress) || status === "unauthenticated" ? (
        <AccessDenied message="Connect your wallet to access the admin panel." />
      ) : !isOwner ? (
        <AccessDenied message={"This is not the contract owner.\nOn blockchain, ownership can't be changed.\nNo access or control without the rightful owner."} />
      ) : isWrongChain ? (
        <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm w-full">
          <ShieldAlert className="h-10 w-10 text-yellow-500" />
          <p className="text-base font-semibold text-gray-900">Wrong Network</p>
          <p className="text-sm text-muted-foreground">Switch to Base to access the Base admin panel.</p>
          <button
            onClick={() => switchChain({ chainId: APP_CHAIN.id })}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#E63946] rounded-base"
          >
            Switch to Base
          </button>
        </div>
      ) : (
        <SidebarProvider className="w-full h-full">
          <AdminSidebar />
          <SidebarInset className="flex flex-col">
            <header className="flex h-[72px] items-center gap-2 border-b px-4 shrink-0 sticky top-0 bg-background z-10">
              <SidebarTrigger className="-ml-1" />
              <span className="text-sm font-semibold text-muted-foreground">Admin</span>
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

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm w-full">
      <ShieldAlert className="h-10 w-10 sm:h-12 sm:w-12 text-destructive" />
      <p className="text-base sm:text-lg font-semibold text-gray-900">Access Denied</p>
      <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">{message}</p>
      <a href="/" className="text-sm text-amber-600 hover:underline">← Back to Booztory</a>
    </div>
  )
}
