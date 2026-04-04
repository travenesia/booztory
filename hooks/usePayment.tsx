"use client"

import { useState, useCallback, useRef } from "react"
import { useReadContract, useWriteContract, useSwitchChain, useChainId } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { parseUnits } from "viem"
import { wagmiConfig, APP_CHAIN, DATA_SUFFIX_PARAM } from "@/lib/wagmi"
import { useToast } from "@/hooks/use-toast"
import confetti from "canvas-confetti"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI, USDC_ADDRESS, ERC20_ABI } from "@/lib/contract"

export interface SlotData {
  contentUrl: string
  contentType: string
  aspectRatio: string
  title: string
  authorName: string
  imageUrl: string
}

const FALLBACK_SLOT_PRICE = parseUnits("1", 6)
const FALLBACK_DISCOUNT_BURN = parseUnits("1000", 18)
const FALLBACK_FREE_SLOT_COST = parseUnits("10000", 18)
const FALLBACK_DISCOUNT_AMOUNT = parseUnits("0.1", 6)

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
  return msg.includes("user rejected") || msg.includes("rejected the request") || msg.includes("user denied")
}

export function usePayment() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStep, setPaymentStep] = useState<1 | 2>(1)
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  // ── On-chain reads ────────────────────────────────────────────────────────────
  const { data: onChainSlotPrice } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "slotPrice",
    chainId: APP_CHAIN.id,
  })
  const { data: onChainDiscountBurnCost } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "discountBurnCost",
    chainId: APP_CHAIN.id,
  })
  const { data: onChainFreeSlotCost } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "freeSlotCost",
    chainId: APP_CHAIN.id,
  })
  const { data: onChainDiscountAmount } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "discountAmount",
    chainId: APP_CHAIN.id,
  })

  const slotPrice = (onChainSlotPrice as bigint | undefined) ?? FALLBACK_SLOT_PRICE
  const discountBurnCost = (onChainDiscountBurnCost as bigint | undefined) ?? FALLBACK_DISCOUNT_BURN
  const freeSlotCost = (onChainFreeSlotCost as bigint | undefined) ?? FALLBACK_FREE_SLOT_COST
  const discountAmount = (onChainDiscountAmount as bigint | undefined) ?? FALLBACK_DISCOUNT_AMOUNT

  // Keep refs in sync so callbacks always use latest values
  const slotPriceRef = useRef(slotPrice)
  slotPriceRef.current = slotPrice
  const discountBurnCostRef = useRef(discountBurnCost)
  discountBurnCostRef.current = discountBurnCost
  const freeSlotCostRef = useRef(freeSlotCost)
  freeSlotCostRef.current = freeSlotCost
  const discountAmountRef = useRef(discountAmount)
  discountAmountRef.current = discountAmount

  const resetPaymentState = useCallback(() => {
    setIsProcessing(false)
    setPaymentStep(1)
  }, [])

  // ── Shared setup ──────────────────────────────────────────────────────────────
  async function ensureChain() {
    if (chainId !== APP_CHAIN.id) await switchChainAsync({ chainId: APP_CHAIN.id })
  }

  function handleError(error: unknown): { success: false; error: string } {
    resetPaymentState()
    if (parseReject(error)) return { success: false, error: "Payment was cancelled" }
    const msg = error instanceof Error ? error.message : "Transaction failed"
    toast({ title: "Transaction Failed", description: msg, variant: "destructive" })
    return { success: false, error: msg }
  }

  const SLOT_ARGS = (s: SlotData): [string, string, string, string, string, string] =>
    [s.contentUrl, s.contentType, s.aspectRatio, s.title, s.authorName, s.imageUrl]

  const NFT_SLOT_ARGS = (nftContract: `0x${string}`, nftTokenId: bigint, s: SlotData):
    [`0x${string}`, bigint, string, string, string, string, string, string] =>
    [nftContract, nftTokenId, s.contentUrl, s.contentType, s.aspectRatio, s.title, s.authorName, s.imageUrl]

  // ── mintSlot (standard — 1 USDC) ─────────────────────────────────────────────
  const mintSlot = useCallback(
    async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
      if (isProcessing) return { success: false, error: "Payment already in progress" }
      setIsProcessing(true)
      setPaymentStep(1)
      try {
        await ensureChain()

        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [BOOZTORY_ADDRESS, slotPriceRef.current],
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx })
        setPaymentStep(2)

        const mintTx = await writeContractAsync({
          address: BOOZTORY_ADDRESS,
          abi: BOOZTORY_ABI,
          functionName: "mintSlot",
          args: SLOT_ARGS(slotData),
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: mintTx })

        toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 1,000 $BOOZ and 15 points.", variant: "success" })
        fireConfetti()
        resetPaymentState()
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    },
    [toast, isProcessing, writeContractAsync, resetPaymentState, chainId, switchChainAsync],
  )

  // ── mintSlotWithDiscount (0.9 USDC + burn 1,000 BOOZ) ────────────────────────
  const mintSlotWithDiscount = useCallback(
    async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
      if (isProcessing) return { success: false, error: "Payment already in progress" }
      setIsProcessing(true)
      setPaymentStep(1)
      try {
        await ensureChain()

        // Approve discounted USDC amount (no BOOZ approve needed — burnFrom bypasses allowance)
        const discountedPrice = slotPriceRef.current - discountAmountRef.current
        const approveUSDCTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [BOOZTORY_ADDRESS, discountedPrice],
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveUSDCTx })
        setPaymentStep(2)

        // Step 3: Mint with discount
        const mintTx = await writeContractAsync({
          address: BOOZTORY_ADDRESS,
          abi: BOOZTORY_ABI,
          functionName: "mintSlotWithDiscount",
          args: SLOT_ARGS(slotData),
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: mintTx })

        toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 1,000 $BOOZ and 15 points.", variant: "success" })
        fireConfetti()
        resetPaymentState()
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    },
    [toast, isProcessing, writeContractAsync, resetPaymentState, chainId, switchChainAsync],
  )

  // ── mintSlotWithTokens (free — burn 10,000 BOOZ) ──────────────────────────────
  const mintSlotWithTokens = useCallback(
    async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
      if (isProcessing) return { success: false, error: "Payment already in progress" }
      setIsProcessing(true)
      try {
        await ensureChain()

        // No BOOZ approve needed — burnFrom bypasses allowance
        // Mint free slot (no USDC needed)
        const mintTx = await writeContractAsync({
          address: BOOZTORY_ADDRESS,
          abi: BOOZTORY_ABI,
          functionName: "mintSlotWithTokens",
          args: SLOT_ARGS(slotData),
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: mintTx })

        toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 15 points.", variant: "success" })
        fireConfetti()
        resetPaymentState()
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    },
    [toast, isProcessing, writeContractAsync, resetPaymentState, chainId, switchChainAsync],
  )

  // ── mintSlotWithNFTDiscount (0.5 USDC, no BOOZ, 1 raffle ticket) ─────────────
  const mintSlotWithNFTDiscount = useCallback(
    async (slotData: SlotData, nftContract: `0x${string}`, nftTokenId: bigint): Promise<{ success: boolean; error?: string }> => {
      if (isProcessing) return { success: false, error: "Payment already in progress" }
      setIsProcessing(true)
      setPaymentStep(1)
      try {
        await ensureChain()

        const discountedPrice = slotPriceRef.current / 2n
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [BOOZTORY_ADDRESS, discountedPrice],
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx })
        setPaymentStep(2)

        const mintTx = await writeContractAsync({
          address: BOOZTORY_ADDRESS,
          abi: BOOZTORY_ABI,
          functionName: "mintSlotWithNFTDiscount",
          args: NFT_SLOT_ARGS(nftContract, nftTokenId, slotData),
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: mintTx })

        toast({ title: "Slot Minted!", description: "Your content has been scheduled. You earned 1 raffle ticket.", variant: "success" })
        fireConfetti()
        resetPaymentState()
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    },
    [toast, isProcessing, writeContractAsync, resetPaymentState, chainId, switchChainAsync],
  )

  // ── mintSlotFreeWithNFT (free, no BOOZ, 1 raffle ticket) ──────────────────────
  const mintSlotFreeWithNFT = useCallback(
    async (slotData: SlotData, nftContract: `0x${string}`, nftTokenId: bigint): Promise<{ success: boolean; error?: string }> => {
      if (isProcessing) return { success: false, error: "Payment already in progress" }
      setIsProcessing(true)
      try {
        await ensureChain()

        const mintTx = await writeContractAsync({
          address: BOOZTORY_ADDRESS,
          abi: BOOZTORY_ABI,
          functionName: "mintSlotFreeWithNFT",
          args: NFT_SLOT_ARGS(nftContract, nftTokenId, slotData),
          ...DATA_SUFFIX_PARAM,
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: mintTx })

        toast({ title: "Free Slot Minted!", description: "Your content has been scheduled. You earned 1 raffle ticket.", variant: "success" })
        fireConfetti()
        resetPaymentState()
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    },
    [toast, isProcessing, writeContractAsync, resetPaymentState, chainId, switchChainAsync],
  )

  return {
    mintSlot,
    mintSlotWithDiscount,
    mintSlotWithTokens,
    mintSlotWithNFTDiscount,
    mintSlotFreeWithNFT,
    isProcessing,
    paymentStep,
    resetPaymentState,
    slotPrice,
    discountBurnCost,
    freeSlotCost,
    discountAmount,
  }
}
