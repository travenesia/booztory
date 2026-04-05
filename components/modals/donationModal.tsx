"use client"

import { DialogFooter } from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { useAccount } from "wagmi"
import { useDonation } from "@/hooks/useDonation"
import { useIdentity } from "@/hooks/useIdentity"

interface DonationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  creatorAddress: `0x${string}`
  tokenId: bigint
}

export function DonationModal({ open, onOpenChange, username, creatorAddress, tokenId }: DonationModalProps) {
  const { data: session } = useSession()
  const { address } = useAccount()
  const [amount, setAmount] = useState<number>(1)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const { toast } = useToast()

  const creatorIdentity = useIdentity(creatorAddress)
  const donorIdentity = useIdentity(address)
  const displayCreatorName = username.startsWith("@") ? username.slice(1) : (creatorIdentity.displayName || username)
  const donorUsername = donorIdentity.displayName || "Anonymous"

  useEffect(() => {
    if (!open) {
      setKeyboardOffset(0)
      return
    }
    if (typeof window === "undefined" || !window.visualViewport) return

    const update = () => {
      const vv = window.visualViewport!
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardOffset(offset)
    }

    window.visualViewport.addEventListener("resize", update)
    window.visualViewport.addEventListener("scroll", update)
    return () => {
      window.visualViewport!.removeEventListener("resize", update)
      window.visualViewport!.removeEventListener("scroll", update)
    }
  }, [open])

  const { processDonation, isDonating, isBatchedTx, donationStep, resetDonationState } = useDonation()

  useEffect(() => {
    if (!open) {
      setAmount(1)
      resetDonationState()
    }
  }, [open, resetDonationState])

  const handleDonate = async () => {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid donation amount.",
        variant: "warning",
      })
      return
    }

    if (!session?.user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be signed in to make a donation.",
        variant: "warning",
      })
      return
    }

    const result = await processDonation(amount, tokenId)

    if (result.success) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("donationCompleted"))
      }

      onOpenChange(false)
      setAmount(1)

      toast({
        title: "Donation Successful!",
        variant: "success",
        description: result.earnedReward
          ? `Thank you for donating $${amount} USDC to @${displayCreatorName}! You earned 1,000 $BOOZ and 5 points.`
          : `Thank you for donating $${amount} USDC to @${displayCreatorName}!`,
      })
    } else {
      if (result.error === "Donation was cancelled") {
        toast({ title: "Donation Cancelled", description: "Your donation was cancelled.", variant: "destructive" })
      } else {
        toast({
          title: "Donation Failed",
          description: result.error || "Failed to process donation. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const predefinedAmounts = [1, 5, 10]

  return (
    <>
    {isDonating && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl px-8 py-7 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4">
          <Loader2 className="animate-spin text-indigo-600" size={28} />
          <p className="text-sm font-semibold text-gray-900 text-center">Processing donation…</p>
          {isBatchedTx ? (
            <>
              <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                Confirm the transaction in your wallet. Gas is sponsored.
              </p>
            </>
          ) : (
            <>
              <div className="w-full flex flex-col gap-2">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: donationStep === 1 ? "50%" : "100%" }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span className={donationStep >= 1 ? "text-indigo-600 font-medium" : ""}>
                    {donationStep > 1 ? "✓ " : "⏳ "}Approving USDC
                  </span>
                  <span className={donationStep >= 2 ? "text-indigo-600 font-medium" : ""}>
                    {donationStep === 2 ? "⏳ " : ""}Donating
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                Please keep this page open and confirm both transactions in your wallet.
              </p>
            </>
          )}
        </div>
      </div>,
      document.body
    )}
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px] rounded-xl bg-gray-0 text-elegance-timeless-noir [&>button]:hidden"
        style={keyboardOffset > 0 ? { top: `calc(50% - ${keyboardOffset / 2}px)`, transition: "top 0.3s ease" } : { transition: "top 0.3s ease" }}
      >
        <DialogHeader>
          <DialogTitle asChild>
            <div className="px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-sm font-normal text-elegance-timeless-noir leading-relaxed">
              Hi <span className="font-semibold">@{session ? donorUsername : "you"}</span>
              <span className="text-gray-500">, consider supporting </span>
              <span className="font-semibold text-[#E63946]">@{displayCreatorName}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-3">
          <div className="flex items-center justify-between w-full">
            <Image src="/usdc.svg" alt="USDC" width={48} height={48} />

            {predefinedAmounts.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                disabled={isDonating}
                className={`rounded-full w-12 h-12 flex items-center justify-center font-base text-sm border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  amount === value
                    ? "bg-main text-main-foreground border-transparent shadow-custom-sm [--tw-shadow-color:#D6D9DD] hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
                    : "bg-secondary-background text-foreground border-gray-300 shadow-custom-sm [--tw-shadow-color:#D6D9DD] hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
                }`}
              >
                {value}
              </button>
            ))}
            <Input
              id="custom-amount"
              type="number"
              min="0.1"
              step="0.1"
              value={amount}
              onChange={(e) => setAmount(Number.parseFloat(e.target.value) || 0)}
              disabled={isDonating}
              className="w-20 h-12 rounded-full shadow-custom-sm [--tw-shadow-color:#D6D9DD] bg-secondary-background text-foreground border border-gray-300 focus:translate-x-boxShadowX focus:translate-y-boxShadowY focus:shadow-none transition-all focus:ring-0 focus-visible:ring-0 disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 flex-col gap-2">
          <Button
            onClick={handleDonate}
            disabled={isDonating || amount <= 0 || !session?.user?.id}
            className="w-full elegance-button h-10"
            style={{ boxShadow: '6.4px 6.4px 0px 0px #D6D9DD' }}
          >
            {isDonating ? (
              <div className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </div>
            ) : (
              `Donate ${amount} USDC`
            )}
          </Button>
        </DialogFooter>
        <p className="text-[11px] text-center text-gray-400">
          Earn 1,000 $BOOZ + 5 points on your first donation per day
        </p>
      </DialogContent>
    </Dialog>
    </>
  )
}
