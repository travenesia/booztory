"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useSession, signIn, signOut } from "next-auth/react"
import { useAccount, useSignMessage, useAccountEffect, useSwitchChain, useDisconnect } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { APP_CHAIN } from "@/lib/wagmi"
import { useIdentity } from "@/hooks/useIdentity"
import { SiweMessage } from "siwe"
import { useToast } from "@/hooks/use-toast"
import { cache, CACHE_DURATIONS } from "@/lib/cache"
import { sdk } from "@farcaster/miniapp-sdk"
import { isMiniApp } from "@/lib/miniapp-flag"
import { useIsMobile } from "@/hooks/use-mobile"
import { Drawer } from "vaul"
import { WalletDropdownContent } from "@/components/wallet/walletDropdown"

const USER_PROFILE_CACHE_KEY = "user_profile"

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

export function ConnectWalletButton() {
  const { data: session, status } = useSession()
  const { address, isConnected: isWalletConnected, status: walletStatus } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { switchChainAsync } = useSwitchChain()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [reconnectTimedOut, setReconnectTimedOut] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonWrapperRef = useRef<HTMLDivElement>(null)
  const isSigningInRef = useRef(false)
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const isAuthenticated = status === "authenticated"

  const { avatarUrl, displayName: identityName } = useIdentity(address)
  const displayName = identityName || session?.user?.username || null

  // If wagmi is still "reconnecting" after 5s the wallet is locked — stop blocking UI
  useEffect(() => {
    if (walletStatus !== "reconnecting") {
      setReconnectTimedOut(false)
      return
    }
    const timer = setTimeout(() => setReconnectTimedOut(true), 5000)
    return () => clearTimeout(timer)
  }, [walletStatus])

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

  // Race condition fix: wagmi can reconnect before NextAuth finishes loading the session.
  // onConnect sees status="loading" and skips SIWE. This effect catches the transition
  // "loading" → "unauthenticated" while the wallet is already connected and triggers sign-in.
  const prevStatusRef = useRef(status)
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (
      prev === "loading" &&
      status === "unauthenticated" &&
      isWalletConnected &&
      address &&
      !isSigningInRef.current
    ) {
      if (isMiniApp()) {
        handleQuickAuth(address)
      } else {
        handleSignIn(address, APP_CHAIN.id)
      }
    }
  }, [status, isWalletConnected, address, handleQuickAuth, handleSignIn])

  const handleConnect = () => {
    if (isMiniApp()) return // MiniAppInit handles wallet connect for Farcaster users
    openConnectModal?.()
  }

  const buttonContent = () => {
    if ((walletStatus === "reconnecting" && !reconnectTimedOut) || walletStatus === "connecting") {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Connecting...</span>
        </>
      )
    }
    if (isLoading || status === "loading") {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Signing in...</span>
        </>
      )
    }
    if (isAuthenticated) {
      return (
        <>
          {avatarUrl && (
            <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
          )}
          <span className="truncate max-w-[120px]" title={displayName ?? undefined}>
            {displayName || "Connected"}
          </span>
        </>
      )
    }
    if (isWalletConnected) {
      return <span>Sign in</span>
    }
    return <span>Connect</span>
  }

  const isReconnecting = walletStatus === "reconnecting" && !reconnectTimedOut
  const isDisabled = isLoading || status === "loading" || isReconnecting || walletStatus === "connecting"

  // ── Unauthenticated or ghost session (session alive but wallet gone) ────────
  // isReconnecting = wagmi is mid-reconnect on page load — don't flash Connect (unless timed out)
  if (!isAuthenticated || (!isWalletConnected && !isReconnecting)) {
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
    const mobileAvatar = avatarUrl || (address ? addressAvatar(address) : null)
    return (
      <>
        {mobileAvatar ? (
          <button onClick={() => setOpen(true)} className="w-8 h-8 p-0 rounded-full overflow-hidden focus:outline-none">
            <img src={mobileAvatar} alt="avatar" className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="flex flex-col items-center">
            <Button
              variant="noShadow"
              className="h-9 px-4 text-xs font-semibold flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] rounded-full"
              onClick={() => setOpen(true)}
            >
              {buttonContent()}
            </Button>
          </div>
        )}
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
  const toggleDesktop = () => {
    if (!open && buttonWrapperRef.current) {
      const rect = buttonWrapperRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    setOpen((v) => !v)
  }

  return (
    <div className="relative flex items-center" ref={buttonWrapperRef}>
      {avatarUrl ? (
        <button onClick={toggleDesktop} className="w-8 h-8 p-0 rounded-full overflow-hidden focus:outline-none">
          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        </button>
      ) : (
        <Button
          variant="noShadow"
          className="h-9 px-4 text-xs flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] rounded-full"
          onClick={toggleDesktop}
        >
          {buttonContent()}
        </Button>
      )}

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
