"use client"

import { useAccount, useDisconnect } from "wagmi"
import { useReadContract } from "wagmi"
import { useSession, signOut } from "next-auth/react"
import { useState } from "react"
import { Copy, Check, LogOut } from "lucide-react"
import { HiBolt } from "react-icons/hi2"
import { useWalletName } from "@/hooks/useWalletName"
import { ERC20_ABI, USDC_ADDRESS, TOKEN_ADDRESS } from "@/lib/contract"
import { cache } from "@/lib/cache"

// ── Gradient avatar from address ─────────────────────────────────────────────
function addressToGradient(addr: string): string {
  if (!addr) return "linear-gradient(135deg, #6366f1, #8b5cf6)"
  const h1 = parseInt(addr.slice(2, 8), 16) % 360
  const h2 = (h1 + 130) % 360
  return `linear-gradient(135deg, hsl(${h1},65%,55%), hsl(${h2},65%,55%))`
}

// ── Balance formatting helpers ────────────────────────────────────────────────
function formatUsdc(raw: bigint | undefined): string {
  if (raw === undefined) return "—"
  const val = Number(raw) / 1_000_000
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatBooz(raw: bigint | undefined): string {
  if (raw === undefined) return "—"
  const val = Number(raw) / 1e18
  return val.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

// ─────────────────────────────────────────────────────────────────────────────

export function WalletDropdownContent({ onClose }: { onClose?: () => void }) {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)

  const resolvedName = useWalletName(address)
  const displayName = resolvedName || session?.user?.username || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "")
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: boozBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000" },
  })

  const handleCopy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDisconnect = async () => {
    cache.clear("user_profile")
    await signOut({ redirect: false })
    disconnect()
    onClose?.()
  }

  if (!address) return null

  return (
    <div className="flex flex-col w-full">
      {/* ── Profile ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="w-10 h-10 rounded-full flex-shrink-0"
          style={{ background: addressToGradient(address) }}
        />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-gray-900 truncate">{displayName}</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-gray-500 font-mono">{shortAddress}</span>
            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded"
              aria-label="Copy address"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-4 border-t border-gray-200" />

      {/* ── Balances ── */}
      <div className="grid grid-cols-2 gap-2 px-4 py-3">
        {/* USDC */}
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
          <img src="/usdc.svg" alt="USDC" width={32} height={32} className="flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-black text-blue-900 leading-tight">{formatUsdc(usdcBalance as bigint | undefined)}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">USDC</span>
          </div>
        </div>
        {/* BOOZ */}
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <HiBolt size={32} className="text-red-400 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-black text-red-900 leading-tight">{formatBooz(boozBalance as bigint | undefined)}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">BOOZ</span>
          </div>
        </div>
      </div>

      <div className="mx-4 border-t border-gray-200" />

      {/* ── Disconnect ── */}
      <div className="px-4 py-3">
        <button
          onClick={handleDisconnect}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </button>
      </div>
    </div>
  )
}
