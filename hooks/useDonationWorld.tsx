"use client"

import { useState, useCallback, useRef } from "react"
import { useReadContract } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { MiniKit } from "@worldcoin/minikit-js"
import { parseUnits, encodeFunctionData } from "viem"
import { WORLD_CHAIN } from "@/lib/wagmi"
import { WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI, WORLD_USDC_ADDRESS, WORLD_WLD_ADDRESS, PERMIT2_ADDRESS, PERMIT2_ABI, ERC20_APPROVE_ABI } from "@/lib/contractWorld"
import { ERC20_ABI } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { waitForWorldOp } from "@/lib/miniapp-flag"

/**
 * World Chain donation hook — uses MiniKit v2 sendTransaction API.
 * Bundles token approve + donate into a single World App user operation.
 *
 * USDC path: processDonation(usdAmount, tokenId)
 * WLD path:  processDonationWithWLD(usdAmount, tokenId)
 *   — usdAmount is always in USD; WLD equivalent is computed from the oracle rate.
 *   — wldAmount = slotPriceInWLD * usdAmountMicro / slotPrice
 *   — We approve the computed WLD amount; contract pulls exactly that via Permit2.
 */
export function useDonationWorld() {
  const [isDonating, setIsDonating] = useState(false)
  const [isBatchedTx] = useState(true) // always single user op via MiniKit
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Oracle rate reads — needed to convert USD → WLD for WLD donation path
  const { data: onChainSlotPrice } = useReadContract({
    address: WORLD_BOOZTORY_ADDRESS,
    abi: WORLD_BOOZTORY_ABI,
    functionName: "slotPrice",
    chainId: WORLD_CHAIN.id,
  })
  const { data: onChainSlotPriceInWLD } = useReadContract({
    address: WORLD_BOOZTORY_ADDRESS,
    abi: WORLD_BOOZTORY_ABI,
    functionName: "getSlotPriceInWLD",
    chainId: WORLD_CHAIN.id,
    query: { refetchInterval: 30_000 },
  })

  const slotPrice      = (onChainSlotPrice      as bigint | undefined) ?? parseUnits("1", 6)
  const slotPriceInWLD = (onChainSlotPriceInWLD as bigint | undefined) ?? 0n

  // Refs so callbacks always read the latest oracle value without re-creating
  const slotPriceRef      = useRef(slotPrice);      slotPriceRef.current      = slotPrice
  const slotPriceInWLDRef = useRef(slotPriceInWLD); slotPriceInWLDRef.current = slotPriceInWLD

  // ── processDonation (USDC) ────────────────────────────────────────────────────
  const processDonation = useCallback(
    async (amount: number, tokenId: bigint): Promise<{ success: boolean; error?: string; earnedReward?: boolean }> => {
      if (isDonating) return { success: false, error: "Donation already in progress" }
      setIsDonating(true)

      try {
        const amountBig = parseUnits(amount.toString(), 6)

        const result = await MiniKit.sendTransaction({
          transactions: [
            {
              to: PERMIT2_ADDRESS,
              data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "approve", args: [WORLD_USDC_ADDRESS, WORLD_BOOZTORY_ADDRESS, amountBig, 0] }),
            },
            {
              to: WORLD_BOOZTORY_ADDRESS,
              data: encodeFunctionData({ abi: WORLD_BOOZTORY_ABI, functionName: "donate", args: [tokenId, amountBig] }),
            },
          ],
          chainId: WORLD_CHAIN.id,
        })

        if (!result?.data?.userOpHash) throw new Error("No userOpHash")

        await waitForWorldOp(result.data.userOpHash)
        queryClient.invalidateQueries({ queryKey: ["readContract"] })

        toast({ title: "Donation sent!", description: `${amount} USDC sent to the creator.`, variant: "success" })
        return { success: true }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Donation failed"
        const cancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("user_rejected")
        if (!cancelled) toast({ title: "Donation Failed", description: msg, variant: "destructive" })
        return { success: false, error: msg }
      } finally {
        setIsDonating(false)
      }
    },
    [isDonating, toast, queryClient]
  )

  // ── processDonationWithWLD ────────────────────────────────────────────────────
  // wldAmount is in 18-decimal WLD (e.g. parseUnits("1", 18) = 1 WLD).
  const processDonationWithWLD = useCallback(
    async (wldAmount: bigint, tokenId: bigint): Promise<{ success: boolean; error?: string }> => {
      if (isDonating) return { success: false, error: "Donation already in progress" }
      if (wldAmount === 0n) return { success: false, error: "Invalid WLD amount" }

      setIsDonating(true)
      try {
        const result = await MiniKit.sendTransaction({
          transactions: [
            {
              to: WORLD_WLD_ADDRESS,
              data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [PERMIT2_ADDRESS, wldAmount] }),
            },
            {
              to: PERMIT2_ADDRESS,
              data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "approve", args: [WORLD_WLD_ADDRESS, WORLD_BOOZTORY_ADDRESS, wldAmount, 0] }),
            },
            {
              to: WORLD_BOOZTORY_ADDRESS,
              data: encodeFunctionData({ abi: WORLD_BOOZTORY_ABI, functionName: "donateWithWLD", args: [tokenId, wldAmount] }),
            },
          ],
          chainId: WORLD_CHAIN.id,
        })

        if (!result?.data?.userOpHash) throw new Error("No userOpHash")

        await waitForWorldOp(result.data.userOpHash)
        queryClient.invalidateQueries({ queryKey: ["readContract"] })

        toast({ title: "Donation sent!", description: `WLD sent to the creator.`, variant: "success" })
        return { success: true }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Donation failed"
        const cancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("user_rejected")
        if (!cancelled) toast({ title: "Donation Failed", description: msg, variant: "destructive" })
        return { success: false, error: msg }
      } finally {
        setIsDonating(false)
      }
    },
    [isDonating, toast, queryClient]
  )

  // Direct USDC transfer to World BooztoryWorld contract — used for placeholder donate.
  // Single USDC.transfer call, no Permit2 needed (direct transfer, not transferFrom).
  const processDonationDirect = useCallback(
    async (amount: number): Promise<{ success: boolean; error?: string }> => {
      if (isDonating) return { success: false, error: "Donation already in progress" }
      setIsDonating(true)
      try {
        const amountBig = parseUnits(amount.toString(), 6)
        const result = await MiniKit.sendTransaction({
          transactions: [
            {
              to: WORLD_USDC_ADDRESS,
              data: encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [WORLD_BOOZTORY_ADDRESS, amountBig] }),
            },
          ],
          chainId: WORLD_CHAIN.id,
        })
        if (!result?.data?.userOpHash) throw new Error("No userOpHash")
        await waitForWorldOp(result.data.userOpHash)
        queryClient.invalidateQueries({ queryKey: ["readContract"] })
        return { success: true }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Donation failed"
        const cancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("user_rejected")
        if (!cancelled) toast({ title: "Donation Failed", description: msg, variant: "destructive" })
        return { success: false, error: msg }
      } finally {
        setIsDonating(false)
      }
    },
    [isDonating, toast, queryClient]
  )

  // Direct WLD transfer to World BooztoryWorld contract — used for placeholder donate with WLD.
  // Single WLD.transfer call; owner recovers via withdraw(WLD_ADDRESS).
  const processDonationDirectWLD = useCallback(
    async (wldAmount: bigint): Promise<{ success: boolean; error?: string }> => {
      if (isDonating) return { success: false, error: "Donation already in progress" }
      if (wldAmount === 0n) return { success: false, error: "Invalid WLD amount" }
      setIsDonating(true)
      try {
        const result = await MiniKit.sendTransaction({
          transactions: [
            {
              to: WORLD_WLD_ADDRESS,
              data: encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [WORLD_BOOZTORY_ADDRESS, wldAmount] }),
            },
          ],
          chainId: WORLD_CHAIN.id,
        })
        if (!result?.data?.userOpHash) throw new Error("No userOpHash")
        await waitForWorldOp(result.data.userOpHash)
        queryClient.invalidateQueries({ queryKey: ["readContract"] })
        return { success: true }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Donation failed"
        const cancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("user_rejected")
        if (!cancelled) toast({ title: "Donation Failed", description: msg, variant: "destructive" })
        return { success: false, error: msg }
      } finally {
        setIsDonating(false)
      }
    },
    [isDonating, toast, queryClient]
  )

  return { processDonation, processDonationWithWLD, processDonationDirect, processDonationDirectWLD, isDonating, isBatchedTx, slotPriceInWLD, slotPrice }
}
