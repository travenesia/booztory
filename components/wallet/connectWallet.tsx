"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useSession, signIn } from "next-auth/react"
import { useAccount, useSignMessage, useAccountEffect, useSwitchChain, useConnect, injected } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { APP_CHAIN } from "@/lib/wagmi"
import { useWalletName } from "@/hooks/useWalletName"
import { SiweMessage } from "siwe"
import { useToast } from "@/hooks/use-toast"
import { cache, CACHE_DURATIONS } from "@/lib/cache"
import { sdk } from "@farcaster/miniapp-sdk"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WalletDropdownContent } from "@/components/wallet/walletDropdown"

const USER_PROFILE_CACHE_KEY = "user_profile"

export function ConnectWalletButton() {
  const { data: session, status } = useSession()
  const { address, isConnected: isWalletConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { switchChainAsync } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const { connect } = useConnect()
  const [isLoading, setIsLoading] = useState(false)
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [isMiniAppChecked, setIsMiniAppChecked] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isSigningInRef = useRef(false)
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const isAuthenticated = status === "authenticated"
  const isSigningIn = isWalletConnected && !isAuthenticated && status !== "loading"

  const resolvedName = useWalletName(address)
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  const displayName = resolvedName || session?.user?.username || shortAddress

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (!open || isMobile) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, isMobile])

  // Detect mini app on mount
  useEffect(() => {
    sdk.isInMiniApp().then(async (inMiniApp) => {
      setIsMiniApp(inMiniApp)
      setIsMiniAppChecked(true)
      if (inMiniApp && !isWalletConnected) {
        connect({
          connector: injected({
            target() {
              return {
                id: "farcaster",
                name: "Farcaster",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                provider: () => sdk.wallet.ethProvider as any,
              }
            },
          }),
        })
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cache user profile when session changes
  useEffect(() => {
    if (session?.user) {
      cache.set(
        USER_PROFILE_CACHE_KEY,
        { username: session.user.username, walletAddress: session.user.walletAddress },
        CACHE_DURATIONS.USER_PROFILE,
      )
    }
  }, [session])

  const handleSignIn = useCallback(
    async (walletAddress: string, currentChainId?: number) => {
      if (isSigningInRef.current) return
      isSigningInRef.current = true
      setIsLoading(true)
      try {
        if (currentChainId !== APP_CHAIN.id) {
          await switchChainAsync({ chainId: APP_CHAIN.id })
        }

        const res = await fetch("/api/nonce")
        const { nonce } = await res.json()

        const message = new SiweMessage({
          domain: window.location.host,
          address: walletAddress,
          statement: "Sign in to Booztory",
          uri: window.location.origin,
          version: "1",
          chainId: APP_CHAIN.id,
          nonce,
        })

        const signature = await signMessageAsync({ message: message.prepareMessage() })

        const result = await signIn("ethereum-wallet", {
          message: JSON.stringify(message),
          signature,
          nonce,
          redirect: false,
        })

        if (result?.error) {
          throw new Error("Sign-in failed. Please try again.")
        }
      } catch (error) {
        console.error("Sign-in error:", error)
        const msg = error instanceof Error ? error.message : "Authentication failed."
        const isRejected = msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("user denied")
        toast({
          title: isRejected ? "Signature Rejected" : "Sign-in Failed",
          description: isRejected ? "Please sign the message to continue." : msg,
          variant: "destructive",
        })
      } finally {
        isSigningInRef.current = false
        setIsLoading(false)
      }
    },
    [signMessageAsync, toast, switchChainAsync],
  )

  const handleQuickAuth = useCallback(
    async (walletAddress: string) => {
      if (isSigningInRef.current) return
      isSigningInRef.current = true
      setIsLoading(true)
      try {
        const { token } = await sdk.quickAuth.getToken()
        const result = await signIn("farcaster-quickauth", {
          token,
          address: walletAddress,
          redirect: false,
        })
        if (result?.error) throw new Error("Quick Auth sign-in failed.")
      } catch (error) {
        console.error("Quick Auth error:", error)
        await handleSignIn(walletAddress, APP_CHAIN.id)
      } finally {
        isSigningInRef.current = false
        setIsLoading(false)
      }
    },
    [handleSignIn],
  )

  useAccountEffect({
    onConnect({ address, chainId }) {
      if (status === "unauthenticated") {
        sdk.isInMiniApp().then((inMiniApp) => {
          if (inMiniApp) {
            handleQuickAuth(address)
          } else {
            handleSignIn(address, chainId)
          }
        })
      }
    },
  })

  const handleConnect = () => {
    if (openConnectModal) openConnectModal()
  }

  const buttonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Connecting...</span>
        </>
      )
    }
    if (isAuthenticated) {
      return <span className="truncate max-w-[140px]" title={displayName ?? undefined}>{displayName || "Connected"}</span>
    }
    if (isSigningIn || (isMiniApp && !isAuthenticated)) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Signing in...</span>
        </>
      )
    }
    if (!isMiniAppChecked) return null
    return <span>Connect</span>
  }

  const isDisabled = isLoading || isSigningIn || status === "loading" || (isMiniApp && !isAuthenticated)

  // ── Unauthenticated / mini app — plain connect button ──────────────────────
  if (!isAuthenticated || isMiniApp) {
    return (
      <div className="flex flex-col items-center">
        <Button
          variant="noShadow"
          className="h-9 px-4 text-xs flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] rounded-full"
          onClick={isMiniApp ? undefined : handleConnect}
          disabled={isDisabled}
        >
          {buttonContent()}
        </Button>
      </div>
    )
  }

  // ── Mobile — bottom Sheet ───────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div className="flex flex-col items-center">
          <Button
            variant="noShadow"
            className="h-9 px-4 text-xs flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] rounded-full"
            onClick={() => setOpen(true)}
          >
            {buttonContent()}
          </Button>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="p-0 rounded-t-xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Wallet</SheetTitle>
            </SheetHeader>
            <WalletDropdownContent onClose={() => setOpen(false)} />
            <div className="h-6" />
          </SheetContent>
        </Sheet>
      </>
    )
  }

  // ── Desktop — click-outside dropdown ───────────────────────────────────────
  return (
    <div className="relative flex flex-col items-center" ref={dropdownRef}>
      <Button
        variant="noShadow"
        className="h-9 px-4 text-xs flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] rounded-full"
        onClick={() => setOpen((v) => !v)}
      >
        {buttonContent()}
      </Button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          <WalletDropdownContent onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
