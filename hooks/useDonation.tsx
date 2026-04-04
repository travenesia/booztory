"use client"

import { useState, useCallback } from "react"
import { useWriteContract, useSwitchChain, useChainId, useAccount } from "wagmi"
import { readContract, waitForTransactionReceipt } from "wagmi/actions"
import { parseUnits } from "viem"
import { wagmiConfig, APP_CHAIN, DATA_SUFFIX_PARAM, sendBatchWithAttribution } from "@/lib/wagmi"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI, USDC_ADDRESS, ERC20_ABI } from "@/lib/contract"
import { canUsePaymaster, waitForPaymasterCalls } from "@/lib/miniapp-flag"
import confetti from "canvas-confetti"

const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL

export function useDonation() {
  const [isDonating, setIsDonating] = useState(false)
  const [donationStep, setDonationStep] = useState<1 | 2>(1)
  const { writeContractAsync } = useWriteContract()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { address } = useAccount()

  /**
   * Donate to a slot creator.
   * Flow: approve contract for `amount` → donate(tokenId, amount)
   * Contract splits: 95% to creator, 5% fee held in contract.
   */
  const processDonation = useCallback(
    async (
      amount: number,
      tokenId: bigint,
    ): Promise<{ success: boolean; earnedReward?: boolean; error?: string }> => {
      if (amount <= 0) return { success: false, error: "Amount must be greater than 0" }

      setIsDonating(true)
      setDonationStep(1)

      try {
        // Ensure wallet is on the correct chain before transacting
        if (chainId !== APP_CHAIN.id) {
          await switchChainAsync({ chainId: APP_CHAIN.id })
        }

        // Check if donor will earn rewards (cooldown must have elapsed)
        let earnedReward = false
        if (address) {
          const cooldown = await readContract(wagmiConfig, {
            address: BOOZTORY_ADDRESS,
            abi: BOOZTORY_ABI,
            functionName: "donateCooldown",
            args: [address],
            chainId: APP_CHAIN.id,
          })
          earnedReward = Date.now() / 1000 >= Number(cooldown) + 86400
        }

        const tokenAmount = parseUnits(amount.toString(), 6)

        let ranPaymaster = false
        if (await canUsePaymaster(PAYMASTER_URL)) {
          try {
            // Batch approve + donate in one user op (gas-free for Smart Wallet users)
            const callsId = await sendBatchWithAttribution([
              { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [BOOZTORY_ADDRESS, tokenAmount] },
              { address: BOOZTORY_ADDRESS, abi: BOOZTORY_ABI, functionName: "donate", args: [tokenId, tokenAmount] },
            ], PAYMASTER_URL!)
            await waitForPaymasterCalls(callsId)
            ranPaymaster = true
          } catch {
            // Any paymaster failure — fall through to EOA path
          }
        }
        if (!ranPaymaster) {
          // Step 1: Approve Booztory contract to pull the donation amount
          const approveTx = await writeContractAsync({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BOOZTORY_ADDRESS, tokenAmount],
            ...DATA_SUFFIX_PARAM,
          })
          await waitForTransactionReceipt(wagmiConfig, { hash: approveTx })
          setDonationStep(2)

          // Step 2: Donate — contract sends 95% to creator, keeps 5% as fee
          const donateTx = await writeContractAsync({
            address: BOOZTORY_ADDRESS,
            abi: BOOZTORY_ABI,
            functionName: "donate",
            args: [tokenId, tokenAmount],
            ...DATA_SUFFIX_PARAM,
          })
          await waitForTransactionReceipt(wagmiConfig, { hash: donateTx })
        }

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

        setIsDonating(false)
        return { success: true, earnedReward }
      } catch (error) {
        setIsDonating(false)
        const errorMessage = error instanceof Error ? error.message : "Donation failed"

        const isRejected =
          errorMessage.toLowerCase().includes("user rejected") ||
          errorMessage.toLowerCase().includes("rejected the request") ||
          errorMessage.toLowerCase().includes("user denied")

        if (isRejected) return { success: false, error: "Donation was cancelled" }
        return { success: false, error: errorMessage }
      }
    },
    [writeContractAsync, chainId, switchChainAsync],
  )

  const resetDonationState = useCallback(() => {
    setIsDonating(false)
    setDonationStep(1)
  }, [])

  return { processDonation, isDonating, donationStep, resetDonationState }
}
