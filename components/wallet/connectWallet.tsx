"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useSession, signIn, signOut } from "next-auth/react"
import { useAccount, useDisconnect, useSignMessage, useAccountEffect, useSwitchChain, useConnect, injected } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { APP_CHAIN } from "@/lib/wagmi"
import { useWalletName } from "@/hooks/useWalletName"
import { SiweMessage } from "siwe"
import { useToast } from "@/hooks/use-toast"
import { cache, CACHE_DURATIONS } from "@/lib/cache"
import { sdk } from "@farcaster/miniapp-sdk"

const USER_PROFILE_CACHE_KEY = "user_profile"

export function ConnectWalletButton() {
  const { data: session, status } = useSession()
  const { address, isConnected: isWalletConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const { switchChainAsync } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const { connect } = useConnect()
  const [isLoading, setIsLoading] = useState(false)
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [isMiniAppChecked, setIsMiniAppChecked] = useState(false)
  const isSigningInRef = useRef(false)
  const { toast } = useToast()

  const isAuthenticated = status === "authenticated"
  // Wallet connected in wagmi but SIWE not yet complete
  const isSigningIn = isWalletConnected && !isAuthenticated && status !== "loading"

  // Resolves Basename → ENS → truncated address (shared hook, cached 5 min)
  const resolvedName = useWalletName(address)
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  const displayName = resolvedName || session?.user?.username || shortAddress

  // Detect mini app on mount; if inside a frame, auto-connect via the frame ethereum provider.
  // RainbowKit modal is never shown in mini app mode.
  useEffect(() => {
    sdk.isInMiniApp().then(async (inMiniApp) => {
      setIsMiniApp(inMiniApp)
      setIsMiniAppChecked(true)
      if (inMiniApp) {
        // Signal to the frame shell that the app is ready to display
        sdk.actions.ready()
        if (!isWalletConnected) {
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
        // Switch to the app chain if the wallet is on a different network
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
    [signMessageAsync, disconnect, toast, switchChainAsync],
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
        // Fall back to SIWE if Quick Auth fails
        await handleSignIn(walletAddress, APP_CHAIN.id)
      } finally {
        isSigningInRef.current = false
        setIsLoading(false)
      }
    },
    [handleSignIn],
  )

  // Auto sign-in once wallet connects.
  // Inside Warpcast/Base mini app: use Quick Auth (no signature prompt needed).
  // Regular browser: use SIWE.
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

  const handleDisconnect = async () => {
    setIsLoading(true)
    cache.clear(USER_PROFILE_CACHE_KEY)
    await signOut({ redirect: false })
    disconnect()
    setIsLoading(false)
  }

  // Determine what the button should show and do:
  // 1. No wallet connected  → "Connect"  (openConnectModal is available)
  // 2. Wallet connected, SIWE pending → "Signing in…"  (disabled)
  // 3. Fully authenticated  → displayName + disconnect on click

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
    // Before mini app check resolves, show nothing to avoid a flicker of "Connect"
    if (!isMiniAppChecked) return null
    return <span>Connect</span>
  }

  // In mini app: no manual connect or disconnect — fully automatic
  const handleClick = isMiniApp
    ? undefined
    : isAuthenticated
    ? handleDisconnect
    : isSigningIn
    ? undefined
    : handleConnect
  const isDisabled = isLoading || isSigningIn || status === "loading" || (isMiniApp && !isAuthenticated)

  return (
    <div className="flex flex-col items-center">
      <Button
        className="h-8 px-4 py-2 elegance-button text-xs flex items-center justify-center space-x-1 min-w-[72px] max-w-[180px] !shadow-none hover:!shadow-none"
        onClick={handleClick}
        disabled={isDisabled}
      >
        {buttonContent()}
      </Button>
    </div>
  )
}
