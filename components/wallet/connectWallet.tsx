"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Wallet, Loader2 } from "lucide-react"
import { useSession, signIn, signOut } from "next-auth/react"
import { useAccount, useDisconnect, useSignMessage, useAccountEffect, useSwitchChain } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { APP_CHAIN } from "@/lib/wagmi"
import { useWalletName } from "@/hooks/useWalletName"
import { SiweMessage } from "siwe"
import { useToast } from "@/hooks/use-toast"
import { cache, CACHE_DURATIONS } from "@/lib/cache"

const USER_PROFILE_CACHE_KEY = "user_profile"

export function ConnectWalletButton() {
  const { data: session, status } = useSession()
  const { address, isConnected: isWalletConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const { switchChainAsync } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const isAuthenticated = status === "authenticated"
  // Wallet connected in wagmi but SIWE not yet complete
  const isSigningIn = isWalletConnected && !isAuthenticated && status !== "loading"

  // Resolves Basename → ENS → truncated address (shared hook, cached 5 min)
  const resolvedName = useWalletName(address)
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  const displayName = resolvedName || session?.user?.username || shortAddress

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
        disconnect()

        const msg = error instanceof Error ? error.message : "Authentication failed."
        const isRejected = msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("user denied")

        toast({
          title: isRejected ? "Signature Rejected" : "Sign-in Failed",
          description: isRejected ? "Please sign the message to continue." : msg,
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [signMessageAsync, disconnect, toast, switchChainAsync],
  )

  // Auto sign-in with SIWE once wallet connects.
  // useAccountEffect fires only after the connector is fully ready to sign —
  // avoiding the ConnectorNotConnectedError from the previous useEffect approach.
  useAccountEffect({
    onConnect({ address, chainId }) {
      if (status === "unauthenticated") {
        handleSignIn(address, chainId)
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
  // 1. No wallet connected  → "Connect Wallet"  (openConnectModal is available)
  // 2. Wallet connected, SIWE pending → "Signing in…"  (disabled)
  // 3. Fully authenticated  → displayName + disconnect on click

  const buttonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{isAuthenticated ? "Disconnecting..." : "Connecting..."}</span>
        </>
      )
    }
    if (isAuthenticated) {
      return (
        <>
          <span className="truncate max-w-[90px]">{displayName || "Connected"}</span>
          <Wallet size={16} />
        </>
      )
    }
    if (isSigningIn) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Signing in...</span>
        </>
      )
    }
    return (
      <>
        <span>Connect Wallet</span>
        <Wallet size={16} />
      </>
    )
  }

  const handleClick = isAuthenticated ? handleDisconnect : isSigningIn ? undefined : handleConnect
  const isDisabled = isLoading || isSigningIn || status === "loading"

  return (
    <div className="flex flex-col items-center">
      <Button
        className="h-8 px-2 py-2 elegance-button text-xs flex items-center justify-end space-x-1 min-w-[120px] !shadow-custom-sm hover:!shadow-custom-sm"
        onClick={handleClick}
        disabled={isDisabled}
      >
        {buttonContent()}
      </Button>
    </div>
  )
}
