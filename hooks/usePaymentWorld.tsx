"use client"

import { useState, useCallback, useRef } from "react"
import { useReadContract } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { MiniKit } from "@worldcoin/minikit-js"
import { parseUnits, encodeFunctionData } from "viem"
import { WORLD_CHAIN } from "@/lib/wagmi"
import { WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI, WORLD_USDC_ADDRESS, WORLD_WLD_ADDRESS, PERMIT2_ADDRESS, PERMIT2_ABI, ERC20_APPROVE_ABI } from "@/lib/contractWorld"
import { useToast } from "@/hooks/use-toast"
import { waitForWorldOp } from "@/lib/miniapp-flag"
import confetti from "canvas-confetti"

/**
 * World Chain mint hook — uses MiniKit v2 sendTransaction API.
 *
 * MiniKit v2: MiniKit.sendTransaction({ transactions: CalldataTransaction[], chainId })
 * Calldata must be pre-encoded via encodeFunctionData (viem).
 * Returns result.data.userOpHash which doubles as the tx hash on World Chain.
 */

export interface SlotData {
  contentUrl: string
  contentType: string
  aspectRatio: string
  title: string
  authorName: string
  imageUrl: string
}

const FALLBACK_SLOT_PRICE     = parseUnits("1",     6)
const FALLBACK_DISCOUNT_BURN  = parseUnits("1000",  18)
const FALLBACK_FREE_SLOT_COST = parseUnits("10000", 18)
const FALLBACK_DISCOUNT_AMOUNT = parseUnits("0.1",  6)

function fireConfetti() {
  const duration = 5 * 1000
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min
  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now()
    if (timeLeft <= 0) return clearInterval(interval)
    const particleCount = 50 * (timeLeft / duration)
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
  }, 250)
}

function parseReject(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : ""
  return msg.includes("user rejected") || msg.includes("rejected the request") || msg.includes("user denied") || msg.includes("cancelled") || msg.includes("user_rejected")
}

function extractUserOpHash(result: { data?: { userOpHash?: string } } | null | undefined): string {
  if (!result?.data?.userOpHash) throw new Error("No userOpHash")
  return result.data.userOpHash
}

export function usePaymentWorld() {
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // ── On-chain reads (World Chain) ──────────────────────────────────────────────
  const { data: onChainSlotPrice } = useReadContract({
    address: WORLD_BOOZTORY_ADDRESS,
    abi: WORLD_BOOZTORY_ABI,
    functionName: "slotPrice",
    chainId: WORLD_CHAIN.id,
  })
  const { data: onChainDiscountBurnCost } = useReadContract({
    address: WORLD_BOOZTORY_ADDRESS,
    abi: WORLD_BOOZTORY_ABI,
    functionName: "discountBurnCost",
    chainId: WORLD_CHAIN.id,
  })
  const { data: onChainFreeSlotCost } = useReadContract({
    address: WORLD_BOOZTORY_ADDRESS,
    abi: WORLD_BOOZTORY_ABI,
    functionName: "freeSlotCost",
    chainId: WORLD_CHAIN.id,
  })
  const { data: onChainDiscountAmount } = useReadContract({
    address: WORLD_BOOZTORY_ADDRESS,
    abi: WORLD_BOOZTORY_ABI,
    functionName: "discountAmount",
    chainId: WORLD_CHAIN.id,
  })
  const { data: onChainSlotPriceInWLD } = useReadContract({
    address: WORLD_BOOZTORY_ADDRESS,
    abi: WORLD_BOOZTORY_ABI,
    functionName: "getSlotPriceInWLD",
    chainId: WORLD_CHAIN.id,
    query: { refetchInterval: 30_000 }, // oracle price refreshes every 30s
  })

  const slotPrice        = (onChainSlotPrice       as bigint | undefined) ?? FALLBACK_SLOT_PRICE
  const discountBurnCost = (onChainDiscountBurnCost as bigint | undefined) ?? FALLBACK_DISCOUNT_BURN
  const freeSlotCost     = (onChainFreeSlotCost    as bigint | undefined) ?? FALLBACK_FREE_SLOT_COST
  const discountAmount   = (onChainDiscountAmount  as bigint | undefined) ?? FALLBACK_DISCOUNT_AMOUNT
  // WLD price from oracle — 18 decimals. 0n when oracle not set (Sepolia).
  const slotPriceInWLD   = (onChainSlotPriceInWLD  as bigint | undefined) ?? 0n

  const slotPriceRef        = useRef(slotPrice);        slotPriceRef.current        = slotPrice
  const discountAmountRef   = useRef(discountAmount);   discountAmountRef.current   = discountAmount
  const slotPriceInWLDRef   = useRef(slotPriceInWLD);  slotPriceInWLDRef.current   = slotPriceInWLD

  const resetState = useCallback(() => setIsProcessing(false), [])

  function handleError(error: unknown): { success: false; error: string } {
    resetState()
    if (parseReject(error)) return { success: false, error: "Transaction cancelled" }
    const msg = error instanceof Error ? error.message : "Transaction failed"
    toast({ title: "Transaction Failed", description: msg, variant: "destructive" })
    return { success: false, error: msg }
  }

  const SLOT_ARGS = (s: SlotData) =>
    [s.contentUrl, s.contentType, s.aspectRatio, s.title, s.authorName, s.imageUrl] as const

  // ── mintSlot (standard — 1 USDC) ─────────────────────────────────────────────
  const mintSlot = useCallback(async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
    if (isProcessing) return { success: false, error: "Payment already in progress" }
    setIsProcessing(true)
    try {
      const result = await MiniKit.sendTransaction({
        transactions: [
          {
            to: PERMIT2_ADDRESS,
            data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "approve", args: [WORLD_USDC_ADDRESS, WORLD_BOOZTORY_ADDRESS, slotPriceRef.current, 0] }),
          },
          {
            to: WORLD_BOOZTORY_ADDRESS,
            data: encodeFunctionData({ abi: WORLD_BOOZTORY_ABI, functionName: "mintSlot", args: SLOT_ARGS(slotData) }),
          },
        ],
        chainId: WORLD_CHAIN.id,
      })

      const userOpHash = extractUserOpHash(result)
      await waitForWorldOp(userOpHash)
      queryClient.invalidateQueries({ queryKey: ["readContract"] })

      toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 1,000 $BOOZ and 15 points.", variant: "success" })
      fireConfetti()
      resetState()
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  }, [isProcessing, toast, resetState, queryClient])

  // ── mintSlotWithDiscount (burn 1,000 BOOZ + pay discounted USDC) ──────────────
  const mintSlotWithDiscount = useCallback(async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
    if (isProcessing) return { success: false, error: "Payment already in progress" }
    setIsProcessing(true)
    try {
      const discountedPrice = slotPriceRef.current - discountAmountRef.current

      const result = await MiniKit.sendTransaction({
        transactions: [
          {
            to: PERMIT2_ADDRESS,
            data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "approve", args: [WORLD_USDC_ADDRESS, WORLD_BOOZTORY_ADDRESS, discountedPrice, 0] }),
          },
          {
            to: WORLD_BOOZTORY_ADDRESS,
            data: encodeFunctionData({ abi: WORLD_BOOZTORY_ABI, functionName: "mintSlotWithDiscount", args: SLOT_ARGS(slotData) }),
          },
        ],
        chainId: WORLD_CHAIN.id,
      })

      const userOpHash = extractUserOpHash(result)
      await waitForWorldOp(userOpHash)
      queryClient.invalidateQueries({ queryKey: ["readContract"] })

      toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 1,000 $BOOZ and 15 points.", variant: "success" })
      fireConfetti()
      resetState()
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  }, [isProcessing, toast, resetState, queryClient])

  // ── mintSlotWithTokens (burn 10,000 BOOZ, free) ───────────────────────────────
  const mintSlotWithTokens = useCallback(async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
    if (isProcessing) return { success: false, error: "Payment already in progress" }
    setIsProcessing(true)
    try {
      const result = await MiniKit.sendTransaction({
        transactions: [
          {
            to: WORLD_BOOZTORY_ADDRESS,
            data: encodeFunctionData({ abi: WORLD_BOOZTORY_ABI, functionName: "mintSlotWithTokens", args: SLOT_ARGS(slotData) }),
          },
        ],
        chainId: WORLD_CHAIN.id,
      })

      const userOpHash = extractUserOpHash(result)
      await waitForWorldOp(userOpHash)
      queryClient.invalidateQueries({ queryKey: ["readContract"] })

      toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 15 points.", variant: "success" })
      fireConfetti()
      resetState()
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  }, [isProcessing, toast, resetState, queryClient])

  // ── mintSlotWithWLD (oracle-priced WLD, Permit2) ─────────────────────────────
  const mintSlotWithWLD = useCallback(async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
    if (isProcessing) return { success: false, error: "Payment already in progress" }
    const wldAmount = slotPriceInWLDRef.current
    if (wldAmount === 0n) return { success: false, error: "WLD oracle price unavailable" }
    // Approve 2% above the frontend oracle read — the contract re-reads the oracle on-chain,
    // so if the price moved slightly between our static call and block inclusion the allowance
    // still covers it. The contract only pulls the exact on-chain amount.
    const wldApprove = wldAmount + wldAmount / 50n
    setIsProcessing(true)
    try {
      const result = await MiniKit.sendTransaction({
        transactions: [
          {
            to: WORLD_WLD_ADDRESS,
            data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [PERMIT2_ADDRESS, wldApprove] }),
          },
          {
            to: PERMIT2_ADDRESS,
            data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "approve", args: [WORLD_WLD_ADDRESS, WORLD_BOOZTORY_ADDRESS, wldApprove, 0] }),
          },
          {
            to: WORLD_BOOZTORY_ADDRESS,
            data: encodeFunctionData({ abi: WORLD_BOOZTORY_ABI, functionName: "mintSlotWithWLD", args: SLOT_ARGS(slotData) }),
          },
        ],
        chainId: WORLD_CHAIN.id,
      })

      const userOpHash = extractUserOpHash(result)
      await waitForWorldOp(userOpHash)
      queryClient.invalidateQueries({ queryKey: ["readContract"] })

      toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 1,000 $BOOZ and 15 points.", variant: "success" })
      fireConfetti()
      resetState()
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  }, [isProcessing, toast, resetState, queryClient])

  // ── mintSlotWithWLDDiscount (burn BOOZ + oracle-priced WLD) ──────────────────
  const mintSlotWithWLDDiscount = useCallback(async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
    if (isProcessing) return { success: false, error: "Payment already in progress" }
    const wldAmount = slotPriceInWLDRef.current
    if (wldAmount === 0n) return { success: false, error: "WLD oracle price unavailable" }
    // Approve full (non-discounted) WLD price + 2% buffer. The contract computes the
    // discounted amount on-chain at oracle rate and pulls only that. Over-approving is safe.
    const wldApprove = wldAmount + wldAmount / 50n
    setIsProcessing(true)
    try {
      const result = await MiniKit.sendTransaction({
        transactions: [
          {
            to: WORLD_WLD_ADDRESS,
            data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [PERMIT2_ADDRESS, wldApprove] }),
          },
          {
            to: PERMIT2_ADDRESS,
            data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "approve", args: [WORLD_WLD_ADDRESS, WORLD_BOOZTORY_ADDRESS, wldApprove, 0] }),
          },
          {
            to: WORLD_BOOZTORY_ADDRESS,
            data: encodeFunctionData({ abi: WORLD_BOOZTORY_ABI, functionName: "mintSlotWithWLDDiscount", args: SLOT_ARGS(slotData) }),
          },
        ],
        chainId: WORLD_CHAIN.id,
      })

      const userOpHash = extractUserOpHash(result)
      await waitForWorldOp(userOpHash)
      queryClient.invalidateQueries({ queryKey: ["readContract"] })

      toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 1,000 $BOOZ and 15 points.", variant: "success" })
      fireConfetti()
      resetState()
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  }, [isProcessing, toast, resetState, queryClient])

  return {
    mintSlot,
    mintSlotWithDiscount,
    mintSlotWithTokens,
    mintSlotWithWLD,
    mintSlotWithWLDDiscount,
    isProcessing,
    isBatchedTx: true, // MiniKit always batches in one user op — single-step UI
    paymentStep: 1 as const,
    resetPaymentState: resetState,
    slotPrice,
    discountBurnCost,
    freeSlotCost,
    discountAmount,
    slotPriceInWLD,
  }
}
