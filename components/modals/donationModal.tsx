"use client"

import { DialogFooter } from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { useDonation } from "@/hooks/useDonation"
import { useWalletName } from "@/hooks/useWalletName"

interface DonationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  creatorAddress: `0x${string}`
  tokenId: bigint
}

export function DonationModal({ open, onOpenChange, username, creatorAddress, tokenId }: DonationModalProps) {
  const { data: session } = useSession()
  const [amount, setAmount] = useState<number>(1)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const { toast } = useToast()

  const resolvedCreatorName = useWalletName(creatorAddress)
  const resolvedDonorName = useWalletName(session?.user?.id)
  const displayCreatorName = resolvedCreatorName || username
  const donorUsername = resolvedDonorName || session?.user?.username || "Anonymous"

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

  const { processDonation, isDonating, resetDonationState } = useDonation()

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
        variant: "destructive",
      })
      return
    }

    if (!session?.user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be signed in to make a donation.",
        variant: "destructive",
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
        description: `Thank you for donating $${amount} USDC to @${displayCreatorName}!`,
      })
    } else {
      if (result.error === "Donation was cancelled") {
        toast({ title: "Donation Cancelled", description: "Your donation was cancelled." })
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px] rounded-xl bg-gray-0 text-elegance-timeless-noir"
        style={keyboardOffset > 0 ? { top: `calc(50% - ${keyboardOffset / 2}px)`, transition: "top 0.3s ease" } : { transition: "top 0.3s ease" }}
      >
        <DialogHeader>
          <DialogTitle className="font-medium text-elegance-timeless-noir">Support @{displayCreatorName}</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {session ? `Donating as @${donorUsername}` : "Donate USDC to show your appreciation."}
          </DialogDescription>
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
                className={`rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200 shadow-[2px_2px_0px_0px_#1B1B1B] hover:shadow-[3px_3px_0px_0px_#1B1B1B] hover:transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  amount === value
                    ? "bg-[#0090de] text-white"
                    : "border border-elegance-sophisticated-sage bg-elegance-ethereal-ivory text-elegance-timeless-noir"
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
              className="w-20 h-12 rounded-full shadow-[2px_2px_0px_0px_#1B1B1B] focus:shadow-[3px_3px_0px_0px_#1B1B1B] focus:transform focus:-translate-y-0.5 transition-all duration-200 bg-elegance-ethereal-ivory text-elegance-timeless-noir border-elegance-sophisticated-sage focus:border-red-700 focus:ring-red-700 disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            onClick={handleDonate}
            disabled={isDonating || amount <= 0 || !session?.user?.id}
            className="w-full elegance-button h-10"
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
      </DialogContent>
    </Dialog>
  )
}
