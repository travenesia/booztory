"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useSession, signIn, signOut } from "next-auth/react"
import { useAccount, useSignMessage, useAccountEffect, useSwitchChain, useDisconnect } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { APP_CHAIN } from "@/lib/wagmi"
import { useWalletName } from "@/hooks/useWalletName"
import { SiweMessage } from "siwe"
import { useToast } from "@/hooks/use-toast"
import { cache, CACHE_DURATIONS } from "@/lib/cache"
import { sdk } from "@farcaster/miniapp-sdk"
import { isMiniApp } from "@/lib/miniapp-flag"
import { useIsMobile } from "@/hooks/use-mobile"
import { Drawer } from "vaul"
import { WalletDropdownContent } from "@/components/wallet/walletDropdown"

const USER_PROFILE_CACHE_KEY = "user_profile"

export function ConnectWalletButton() {
  const { data: session, status } = useSession()
  const { address, isConnected: isWalletConnected, status: walletStatus } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { switchChainAsync } = useSwitchChain()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonWrapperRef = useRef<HTMLDivElement>(null)
  const isSigningInRef = useRef(false)
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const isAuthenticated = status === "authenticated"

  const resolvedName = useWalletName(address)
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  const displayName = resolvedName || session?.user?.username || shortAddress

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (!open || isMobile) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const clickedDropdown = dropdownRef.current?.contains(target)
      const clickedButton = buttonWrapperRef.current?.contains(target)
      if (!clickedDropdown && !clickedButton) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, isMobile])

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

  // QuickAuth — only used in Farcaster mini app context (isMiniApp() = true)
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

  // Re-authenticate when the user switches wallet accounts while a session is active
  useEffect(() => {
    if (
      isAuthenticated &&
      address &&
      session?.user?.walletAddress &&
      address.toLowerCase() !== session.user.walletAddress.toLowerCase()
    ) {
      if (isMiniApp()) {
        handleQuickAuth(address)
      } else {
        handleSignIn(address, APP_CHAIN.id)
      }
    }
  }, [address, isAuthenticated, session?.user?.walletAddress, handleQuickAuth, handleSignIn])

  // isMiniApp() is synchronous — MiniAppInit sets the flag before calling connect(),
  // so by the time onConnect fires here, the flag is already correct.
  useAccountEffect({
    onConnect({ address, chainId }) {
      if (status === "unauthenticated") {
        if (isMiniApp()) {
          handleQuickAuth(address)
        } else {
          handleSignIn(address, chainId)
        }
      }
    },
    onDisconnect() {
      signOut({ redirect: false })
    },
  })

  const handleConnect = () => {
    if (isMiniApp()) return // MiniAppInit handles wallet connect for Farcaster users
    if (openConnectModal) openConnectModal()
  }

  const buttonContent = () => {
    if (isLoading || status === "loading") {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Signing in...</span>
        </>
      )
    }
    if (isAuthenticated) {
      return <span className="truncate max-w-[140px]" title={displayName ?? undefined}>{displayName || "Connected"}</span>
    }
    if (isWalletConnected) {
      return <span>Sign in</span>
    }
    return <span>Connect</span>
  }

  const isDisabled = isLoading || status === "loading"

  // ── Unauthenticated or ghost session (session alive but wallet gone) ────────
  // walletStatus "reconnecting" = wagmi is mid-reconnect on page load — don't flash Connect
  if (!isAuthenticated || (!isWalletConnected && walletStatus !== "reconnecting")) {
    return (
      <div className="flex flex-col items-center">
        <Button
          variant="noShadow"
          className="h-9 px-4 text-xs font-semibold flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] rounded-full"
          onClick={isWalletConnected && address ? () => handleSignIn(address, APP_CHAIN.id) : handleConnect}
          disabled={isDisabled}
        >
          {buttonContent()}
        </Button>
        {/* Escape hatch: wallet connected but SIWE not completed — allow reset */}
        {isWalletConnected && !isAuthenticated && !isLoading && (
          <button
            onClick={() => disconnect()}
            className="text-[10px] text-gray-400 hover:text-gray-600 mt-0.5 underline underline-offset-2"
          >
            disconnect
          </button>
        )}
      </div>
    )
  }

  // ── Mobile — Vaul bottom drawer ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div className="flex flex-col items-center">
          <Button
            variant="noShadow"
            className="h-9 px-4 text-xs font-semibold flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] rounded-full"
            onClick={() => setOpen(true)}
          >
            {buttonContent()}
          </Button>
        </div>
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-tl-2xl rounded-tr-2xl border-t border-gray-200 bg-white outline-none">
              <Drawer.Title className="sr-only">Wallet</Drawer.Title>
              <Drawer.Description className="sr-only">Wallet details and disconnect</Drawer.Description>
              <WalletDropdownContent onClose={() => setOpen(false)} />
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </>
    )
  }

  // ── Desktop — click-outside dropdown (portalled to body to escape topbar stacking context) ──
  return (
    <div className="relative flex flex-col items-center" ref={buttonWrapperRef}>
      <Button
        variant="noShadow"
        className="h-9 px-4 text-xs flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] rounded-full"
        onClick={() => {
          if (!open && buttonWrapperRef.current) {
            const rect = buttonWrapperRef.current.getBoundingClientRect()
            setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
          }
          setOpen((v) => !v)
        }}
      >
        {buttonContent()}
      </Button>

      {open && dropdownPos && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          className="w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-[60]"
          style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right }}
        >
          <WalletDropdownContent onClose={() => setOpen(false)} />
        </div>,
        document.body
      )}
    </div>
  )
}
