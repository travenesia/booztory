"use client"

import { useState, useCallback } from "react"
import { useReadContract, useWriteContract, useSwitchChain, useChainId } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { parseUnits } from "viem"
import { wagmiConfig, APP_CHAIN } from "@/lib/wagmi"
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

const FALLBACK_SLOT_PRICE = parseUnits("1", 6) // fallback: 1 USDC (6 decimals)

export function usePayment() {
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  // Read current slot price live from the contract
  const { data: onChainSlotPrice } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "slotPrice",
  })
  const slotPrice = (onChainSlotPrice as bigint | undefined) ?? FALLBACK_SLOT_PRICE

  const resetPaymentState = useCallback(() => {
    setIsProcessing(false)
  }, [])

  const mintSlot = useCallback(
    async (slotData: SlotData): Promise<{ success: boolean; error?: string }> => {
      if (isProcessing) return { success: false, error: "Payment already in progress" }

      setIsProcessing(true)

      try {
        // Ensure wallet is on the correct chain before transacting
        if (chainId !== APP_CHAIN.id) {
          await switchChainAsync({ chainId: APP_CHAIN.id })
        }

        // Step 1: Approve USDC spend
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [BOOZTORY_ADDRESS, slotPrice],
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx })

        // Step 2: Mint the slot
        const mintTx = await writeContractAsync({
          address: BOOZTORY_ADDRESS,
          abi: BOOZTORY_ABI,
          functionName: "mintSlot",
          args: [
            slotData.contentUrl,
            slotData.contentType,
            slotData.aspectRatio,
            slotData.title,
            slotData.authorName,
            slotData.imageUrl,
          ],
        })
        await waitForTransactionReceipt(wagmiConfig, { hash: mintTx })

        toast({ title: "Slot Minted!", description: "Your content has been scheduled." })
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })

        resetPaymentState()
        return { success: true }
      } catch (error) {
        resetPaymentState()
        const errorMessage = error instanceof Error ? error.message : "Transaction failed"

        const isRejected =
          errorMessage.toLowerCase().includes("user rejected") ||
          errorMessage.toLowerCase().includes("rejected the request") ||
          errorMessage.toLowerCase().includes("user denied")

        if (isRejected) return { success: false, error: "Payment was cancelled" }

        toast({ title: "Transaction Failed", description: errorMessage, variant: "destructive" })
        return { success: false, error: errorMessage }
      }
    },
    [toast, isProcessing, writeContractAsync, resetPaymentState, chainId, switchChainAsync, slotPrice],
  )

  return { mintSlot, isProcessing, resetPaymentState, slotPrice }
}
