"use client"

import React, { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { cn } from "@/lib/utils"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { useWalletName } from "@/hooks/useWalletName"
import { HiCube, HiFire, HiBolt, HiStar, HiHeart, HiTrophy } from "react-icons/hi2"

// ── Types ──────────────────────────────────────────────────────────────────────
type Period = "30d" | "all"
type CategoryId = "minters" | "streakers" | "points" | "creators" | "donors" | "winners"

interface LeaderEntry {
  address: string
  value: number
  wins?: number  // winners tab: win count (value = USDC total)
}

// ── Categories ─────────────────────────────────────────────────────────────────
const CATEGORIES: { id: CategoryId; label: string; activeLabel: string; icon: React.ElementType; gradient: string }[] = [
  { id: "minters",   label: "Top Minters",   activeLabel: "Mint",     icon: HiCube,    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
  { id: "streakers", label: "Top Streakers", activeLabel: "Streak",   icon: HiFire,    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
  { id: "points",    label: "Top Points",    activeLabel: "Points",   icon: HiBolt,    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
  { id: "creators",  label: "Top Creators",  activeLabel: "Creators", icon: HiStar,    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
  { id: "donors",    label: "Top Donors",    activeLabel: "Donors",   icon: HiHeart,   gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
  { id: "winners",   label: "Top Winners",   activeLabel: "Winners",  icon: HiTrophy,  gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
]

// ── Value formatting ───────────────────────────────────────────────────────────
function formatValue(value: number, category: CategoryId): string {
  switch (category) {
    case "minters":   return `${value} slot${value !== 1 ? "s" : ""}`
    case "streakers": return `${value} day${value !== 1 ? "s" : ""}`
    case "points":    return `${value.toLocaleString()} pts`
    case "creators":  return `$${value.toFixed(2)}`
    case "donors":    return `$${value.toFixed(2)}`
    case "winners":   return `$${value.toFixed(2)}`
  }
}

// ── Gradient identicon ─────────────────────────────────────────────────────────
function addressGradient(address: string): string {
  let hash = 0
  for (let i = 2; i < address.length; i++) {
    hash = (address.charCodeAt(i) + ((hash << 5) - hash)) | 0
  }
  const h1 = Math.abs(hash) % 360
  const h2 = (h1 + 137) % 360
  return `linear-gradient(135deg, hsl(${h1},65%,58%), hsl(${h2},65%,44%))`
}

function Identicon({ address }: { address: string }) {
  const letters = address.length >= 6 ? address.slice(2, 4).toUpperCase() : "??"
  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
      style={{ background: addressGradient(address) }}
    >
      {letters}
    </div>
  )
}

// ── Row background ─────────────────────────────────────────────────────────────
function rowBorderClass(rank: number, isYou?: boolean) {
  if (isYou) return "border-indigo-200 bg-indigo-50"
  if (rank === 1) return "border-amber-200"
  if (rank === 2) return "border-blue-200"
  if (rank === 3) return "border-pink-200"
  return "bg-white border-gray-200"
}

function rowGradient(rank: number, isYou?: boolean): React.CSSProperties | undefined {
  if (isYou) return undefined
  if (rank === 1) return { background: "linear-gradient(to left, #ffffff 0%, #fffef0 60%, #fefce8 100%)" }
  if (rank === 2) return { background: "linear-gradient(to left, #ffffff 0%, #f0f9ff 60%, #e0f2fe 100%)" }
  if (rank === 3) return { background: "linear-gradient(to left, #ffffff 0%, #fff0f7 60%, #fce7f3 100%)" }
  return undefined
}

// ── Rank display ───────────────────────────────────────────────────────────────
function RankDisplay({ rank, isYou }: { rank: number | null; isYou?: boolean }) {
  if (isYou && rank === null) {
    return <span className="text-xs font-bold text-indigo-400 w-8 text-center flex-shrink-0">#99+</span>
  }
  if (rank === 1) return <span className="text-xl w-8 text-center flex-shrink-0">👑</span>
  if (rank === 2) return <span className="text-lg w-8 text-center flex-shrink-0">🥈</span>
  if (rank === 3) return <span className="text-lg w-8 text-center flex-shrink-0">🥉</span>
  return (
    <span className={cn(
      "text-sm font-bold w-8 text-center flex-shrink-0",
      isYou ? "text-indigo-400" : "text-gray-400"
    )}>
      #{rank}
    </span>
  )
}

// ── LeaderRow — separate component so useWalletName hook is called per row ─────
function LeaderRow({
  entry, rank, category, isYou,
}: {
  entry: LeaderEntry
  rank: number
  category: CategoryId
  isYou: boolean
}) {
  const name = useWalletName(entry.address)
  const display = name || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`

  return (
    <div
      className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border", rowBorderClass(rank, isYou))}
      style={rowGradient(rank, isYou)}
    >
      <RankDisplay rank={rank} isYou={isYou} />
      <Identicon address={entry.address} />
      <div className="flex-1 min-w-0">
        <span className={cn(
          "text-sm font-semibold truncate block",
          isYou ? "text-indigo-700" :
          rank === 1 ? "text-amber-700" :
          rank === 2 ? "text-sky-700" :
          rank === 3 ? "text-pink-700" :
          "text-gray-900"
        )}>
          {display}
          {isYou && <span className="text-xs font-normal text-indigo-400 ml-1">(you)</span>}
        </span>
      </div>
      <div className="flex flex-col items-end flex-shrink-0 tabular-nums">
        <span className={cn(
          "text-sm font-bold",
          rank === 1 ? "text-amber-600" :
          rank === 2 ? "text-sky-600" :
          rank === 3 ? "text-pink-600" :
          isYou ? "text-indigo-600" :
          "text-gray-700"
        )}>
          {formatValue(entry.value, category)}
        </span>
        {category === "winners" && entry.wins !== undefined && (
          <span className="text-[10px] text-gray-400 font-medium">
            {entry.wins} win{entry.wins !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  )
}

// ── YourRow — sticky bottom row when you're outside top 10 ────────────────────
function YourRow({ address, category }: { address: string; category: CategoryId }) {
  const name = useWalletName(address)
  const display = name || `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-indigo-50 border-indigo-200">
      <RankDisplay rank={null} isYou />
      <Identicon address={address} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold truncate block text-indigo-700">
          {display}
          <span className="text-xs font-normal text-indigo-400 ml-1">(you)</span>
        </span>
      </div>
      <span className="text-sm font-bold flex-shrink-0 text-indigo-400">
        {formatValue(0, category)}
      </span>
    </div>
  )
}

// ── Mock data ──────────────────────────────────────────────────────────────────
// TODO: replace with /api/leaderboard (The Graph subgraph, 30 min cache)
const MOCK_DATA: Record<Period, Record<CategoryId, LeaderEntry[]>> = {
  "30d": {
    minters: [
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 18 },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 14 },
      { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 11 },
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 9  },
      { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", value: 7  },
      { address: "0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f", value: 6  },
      { address: "0x996d0a71DC0B02ed56B6A99B03ed8b8d62dCbFEE", value: 5  },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 4  },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 3  },
      { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", value: 2  },
    ],
    streakers: [
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 30 },
      { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 27 },
      { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", value: 24 },
      { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", value: 21 },
      { address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", value: 18 },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 15 },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 12 },
      { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", value: 10 },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 8  },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 6  },
    ],
    points: [
      { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 4200 },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 3850 },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 3100 },
      { address: "0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f", value: 2750 },
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 2400 },
      { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", value: 1900 },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 1500 },
      { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 1200 },
      { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", value: 900  },
      { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", value: 650  },
    ],
    creators: [
      { address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", value: 48.50 },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 32.00 },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 28.75 },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 21.00 },
      { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 15.50 },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 12.25 },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 9.00  },
      { address: "0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f", value: 7.50  },
      { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 5.00  },
      { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", value: 2.50  },
    ],
    donors: [
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 52.00 },
      { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", value: 38.50 },
      { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", value: 29.00 },
      { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", value: 21.00 },
      { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", value: 17.50 },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 14.00 },
      { address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", value: 10.50 },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 8.00  },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 5.50  },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 3.00  },
    ],
    winners: [
      { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 150.00, wins: 3 },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 90.00,  wins: 2 },
      { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", value: 60.00,  wins: 2 },
      { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 50.00,  wins: 1 },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 50.00,  wins: 1 },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 30.00,  wins: 1 },
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 30.00,  wins: 1 },
      { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", value: 20.00,  wins: 1 },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 20.00,  wins: 1 },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 10.00,  wins: 1 },
    ],
  },
  all: {
    minters: [
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 87 },
      { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 64 },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 51 },
      { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", value: 43 },
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 38 },
      { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", value: 29 },
      { address: "0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f", value: 24 },
      { address: "0x996d0a71DC0B02ed56B6A99B03ed8b8d62dCbFEE", value: 18 },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 12 },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 7  },
    ],
    streakers: [
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 90 },
      { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", value: 74 },
      { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 62 },
      { address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", value: 55 },
      { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", value: 48 },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 41 },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 33 },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 27 },
      { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", value: 20 },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 14 },
    ],
    points: [
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 18500 },
      { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 14200 },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 11800 },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 9400  },
      { address: "0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f", value: 7600  },
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 5900  },
      { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", value: 4300  },
      { address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", value: 3100  },
      { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 2200  },
      { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", value: 1400  },
    ],
    creators: [
      { address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", value: 184.50 },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 142.75 },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 98.00  },
      { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 76.25  },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 54.50  },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 38.00  },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 27.75  },
      { address: "0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f", value: 19.00  },
      { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 12.50  },
      { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", value: 7.25   },
    ],
    donors: [
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 210.00 },
      { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", value: 165.50 },
      { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", value: 128.00 },
      { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", value: 94.75  },
      { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", value: 72.00  },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 53.50  },
      { address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", value: 38.00  },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 24.75  },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 15.50  },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 8.00   },
    ],
    winners: [
      { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 350.00, wins: 7 },
      { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", value: 250.00, wins: 5 },
      { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", value: 200.00, wins: 4 },
      { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 150.00, wins: 3 },
      { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 150.00, wins: 3 },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 100.00, wins: 2 },
      { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 100.00, wins: 2 },
      { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", value: 100.00, wins: 2 },
      { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", value: 50.00,  wins: 1 },
      { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", value: 50.00,  wins: 1 },
    ],
  },
}

// ── API response shape ─────────────────────────────────────────────────────────
interface LeaderboardData {
  allTime: Record<CategoryId, LeaderEntry[]>
  "30d": Record<CategoryId, LeaderEntry[]>
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [category, setCategory] = useState<CategoryId>("minters")
  const [period, setPeriod] = useState<Period>("30d")
  const { address: connectedAddress } = useAccount()

  // Live data — falls back to MOCK_DATA while loading or if subgraph not configured
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch("/api/leaderboard")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((json: LeaderboardData) => { if (!cancelled) { setData(json); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const liveOrMock = data ?? { allTime: MOCK_DATA.all, "30d": MOCK_DATA["30d"] }
  const entries = period === "30d" ? liveOrMock["30d"][category] : liveOrMock.allTime[category]
  const yourIndex = connectedAddress
    ? entries.findIndex(e => e.address.toLowerCase() === connectedAddress.toLowerCase())
    : -1
  const yourInTop10 = yourIndex >= 0

  return (
    <div className="h-screen md:h-auto md:min-h-screen flex flex-col">
      <PageTopbar title="Leaderboard" />
      <Navbar />

      {/* Mobile: fixed viewport height with inner scroll. Desktop: natural page scroll */}
      <div className="flex flex-col pt-14 pb-[72px] md:pb-6 h-full md:h-auto overflow-hidden md:overflow-visible">

        {/* Period toggle + category tabs — non-scrolling header */}
        <div className="flex-shrink-0 px-4 pt-4 space-y-6">
          <div className="flex justify-center">
            <div className="flex items-center rounded-full p-1 gap-0" style={{ background: "#f1f5f9" }}>
              {(["30d", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-7 py-2 rounded-full text-sm font-semibold transition-all",
                    period === p
                      ? "text-white shadow-sm"
                      : "text-gray-700 hover:text-gray-900"
                  )}
                  style={period === p ? { background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", boxShadow: "0 0 0 1.5px rgba(255,255,255,0.25)" } : undefined}
                >
                  {p === "30d" ? "30 Days" : "All Time"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 md:overflow-x-visible md:mx-0 md:px-0">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon
              const isActive = category === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "flex-shrink-0 w-16 md:flex-1 md:w-auto flex flex-col items-center gap-1 py-2 rounded-[5px] text-xs font-semibold transition-all",
                    isActive ? "text-white" : "bg-white text-gray-500 border border-gray-200 hover:text-gray-700"
                  )}
                  style={isActive ? { background: cat.gradient, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.activeLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Your wallet row — fixed below tabs, above list */}
        {connectedAddress && !yourInTop10 && (
          <div className="flex-shrink-0 px-4 pt-3">
            <YourRow address={connectedAddress} category={category} />
          </div>
        )}

        {/* Scrollable list */}
        <div className={cn("flex-1 overflow-y-auto md:overflow-visible md:flex-none px-4 py-3 space-y-1.5 transition-opacity duration-200", loading && "opacity-50")}>
          {entries.map((entry, i) => (
            <LeaderRow
              key={entry.address}
              entry={entry}
              rank={i + 1}
              category={category}
              isYou={entry.address.toLowerCase() === (connectedAddress?.toLowerCase() ?? "")}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
