"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { formatUnits, parseUnits } from "viem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { useAccount, useReadContract } from "wagmi"
import { useDonation } from "@/hooks/useDonation"
import { useDonationWorld } from "@/hooks/useDonationWorld"
import { useIdentity } from "@/hooks/useIdentity"
import { isWorldApp } from "@/lib/miniapp-flag"
import { USDC_ADDRESS, ERC20_ABI } from "@/lib/contract"
import { WORLD_USDC_ADDRESS, WORLD_WLD_ADDRESS } from "@/lib/contractWorld"
import { APP_CHAIN, WORLD_CHAIN } from "@/lib/wagmi"

interface DonationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  creatorAddress: `0x${string}`
  tokenId?: bigint // undefined = no active slot, donate directly to contract
}

export function DonationModal({ open, onOpenChange, username, creatorAddress, tokenId }: DonationModalProps) {
  const { data: session } = useSession()
  const { address: wagmiAddress } = useAccount()
  // In World App there is no injected wagmi provider, so fall back to the session wallet address
  const address = wagmiAddress ?? (session?.user?.walletAddress as `0x${string}` | undefined)
  const [amount, setAmount] = useState<number>(1)
  const [currency, setCurrency] = useState<"usdc" | "wld">("usdc")
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

  const inWorldApp = isWorldApp()
  const usdcAddress = inWorldApp ? WORLD_USDC_ADDRESS : USDC_ADDRESS
  const usdcChainId = inWorldApp ? WORLD_CHAIN.id : APP_CHAIN.id
  const { data: usdcBalanceRaw } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: usdcChainId,
    query: { enabled: !!address && open },
  })
  const usdcBalance = usdcBalanceRaw !== undefined ? Number(usdcBalanceRaw as bigint) : undefined
  const hasEnoughUsdc = usdcBalance === undefined || usdcBalance >= amount * 1_000_000

  const isDirect = tokenId === undefined // no active slot — donate straight to contract

  const baseDonation  = useDonation()
  const worldDonation = useDonationWorld()
  const { processDonation, processDonationDirect: processDonationDirectBase, isDonating, isBatchedTx, donationStep, resetDonationState } = inWorldApp
    ? { ...worldDonation, donationStep: 1 as const, resetDonationState: () => {} }
    : baseDonation
  // WLD-specific — only used in World App on active slots
  const { processDonationWithWLD, processDonationDirectWLD, processDonationDirect: processDonationDirectWorld, slotPriceInWLD } = worldDonation
  const processDonationDirect = inWorldApp ? processDonationDirectWorld : processDonationDirectBase

  // WLD balance (World App only)
  const { data: wldBalanceRaw } = useReadContract({
    address: WORLD_WLD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: WORLD_CHAIN.id,
    query: { enabled: inWorldApp && !!address && open },
  })
  const wldBalance = wldBalanceRaw !== undefined ? (wldBalanceRaw as bigint) : undefined

  // When currency === "wld", amount is directly in WLD (e.g. 1 = 1 WLD, 5 = 5 WLD)
  const wldAmountForDonation = currency === "wld" && amount > 0
    ? parseUnits(amount.toString(), 18)
    : 0n
  const wldAmountDisplay = amount > 0 ? amount.toFixed(3) : "0.000"

  const hasEnoughWld = currency === "wld"
    ? (wldBalance !== undefined && wldAmountForDonation > 0n && wldBalance >= wldAmountForDonation)
    : true
  const wldOracleReady = inWorldApp && slotPriceInWLD > 0n

  useEffect(() => {
    if (!open) {
      setAmount(1)
      setCurrency("usdc")
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

    const result = isDirect
      ? currency === "wld" && inWorldApp
        ? await processDonationDirectWLD(wldAmountForDonation)
        : await processDonationDirect(amount)
      : currency === "wld" && inWorldApp
        ? await processDonationWithWLD(wldAmountForDonation, tokenId!)
        : await processDonation(amount, tokenId!)

    if (result.success) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("donationCompleted"))
      }

      onOpenChange(false)
      setAmount(1)

      const currencyLabel = currency === "wld" ? `${wldAmountDisplay} WLD` : `$${amount} USDC`
      toast({
        title: "Donation Successful!",
        variant: "success",
        description: isDirect
          ? `Thank you for supporting @Booztory with ${currencyLabel}!`
          : result.earnedReward
            ? `Thank you for donating ${currencyLabel} to @${displayCreatorName}! You earned 1,000 $BOOZ and 5 points.`
            : `Thank you for donating ${currencyLabel} to @${displayCreatorName}!`,
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
            {/* Icon toggle — World App active slot: click to switch currency */}
            {wldOracleReady ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button type="button" onClick={() => setCurrency("usdc")} disabled={isDonating} className="p-0 leading-none">
                  <img src="/usdc.svg" alt="USDC" width={32} height={32} className={`block transition-all duration-200 ${currency !== "usdc" ? "grayscale opacity-40" : ""}`} />
                </button>
                <button type="button" onClick={() => setCurrency("wld")} disabled={isDonating} className="p-0 leading-none">
                  <img src="/world.svg" alt="WLD" width={32} height={32} className={`block transition-all duration-200 ${currency !== "wld" ? "grayscale opacity-40" : ""}`} />
                </button>
              </div>
            ) : (
              <img
                src={currency === "wld" ? "/world.svg" : "/usdc.svg"}
                alt={currency === "wld" ? "WLD" : "USDC"}
                width={32}
                height={32}
              />
            )}

            {predefinedAmounts.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                disabled={isDonating}
                className={`rounded-full w-12 h-12 flex flex-col items-center justify-center font-base border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  amount === value
                    ? "bg-main text-main-foreground border-transparent shadow-custom-sm [--tw-shadow-color:#D6D9DD] hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
                    : "bg-secondary-background text-foreground border-gray-300 shadow-custom-sm [--tw-shadow-color:#D6D9DD] hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
                }`}
              >
                <span className="text-sm">{value}</span>
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
              placeholder={currency === "wld" ? "WLD" : ""}
              className="w-20 h-12 rounded-full shadow-custom-sm [--tw-shadow-color:#D6D9DD] bg-secondary-background text-foreground border border-gray-300 focus:translate-x-boxShadowX focus:translate-y-boxShadowY focus:shadow-none transition-all focus:ring-0 focus-visible:ring-0 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          {currency === "usdc" && !hasEnoughUsdc && amount > 0 && !isDonating && (
            <p className="text-xs text-red-500 text-center">
              Insufficient USDC. Your balance: {usdcBalance !== undefined ? (usdcBalance / 1_000_000).toFixed(2) : "0.00"} USDC.
            </p>
          )}
          {currency === "wld" && !hasEnoughWld && amount > 0 && !isDonating && (
            <p className="text-xs text-red-500 text-center">
              Insufficient WLD. Your balance: {wldBalance !== undefined ? Number(formatUnits(wldBalance, 18)).toFixed(3) : "0.000"} WLD.
            </p>
          )}
          <Button
              onClick={handleDonate}
              disabled={isDonating || amount <= 0 || !session?.user?.id || (currency === "usdc" ? !hasEnoughUsdc : !hasEnoughWld)}
              className="w-full elegance-button h-10"
              style={{ boxShadow: '6.4px 6.4px 0px 0px #D6D9DD' }}
            >
              {isDonating ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : currency === "wld" ? (
                isDirect ? `Support @Booztory with ${wldAmountDisplay} WLD` : `Donate ${amount} WLD`
              ) : isDirect ? (
                `Support @Booztory with $${amount} USDC`
              ) : (
                `Donate ${amount} USDC`
              )}
            </Button>
        </div>
        <p className="text-[11px] text-center text-gray-400">
          Earn 1,000 $BOOZ + 5 points on your first donation per day
        </p>
      </DialogContent>
    </Dialog>
    </>
  )
}
