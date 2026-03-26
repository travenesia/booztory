"use client"

import React, { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { cn } from "@/lib/utils"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { Navbar } from "@/components/layout/navbar"
import { useWalletName } from "@/hooks/useWalletName"
import { HiCube, HiFire, HiBolt, HiStar, HiHeart, HiTrophy } from "react-icons/hi2"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SparklesText } from "@/components/ui/sparkles-text"

// ── Types ──────────────────────────────────────────────────────────────────────
type Period = "7d" | "30d" | "all"
type CategoryId = "minters" | "streakers" | "points" | "creators" | "donors" | "winners"

interface LeaderEntry {
  address: string
  value: number
  wins?: number  // winners tab: win count (value = USDC total)
}

// ── Period labels ──────────────────────────────────────────────────────────────
const PERIOD_LABELS: Record<Period, string> = {
  "all": "All",
  "30d": "30D",
  "7d":  "7D",
}

// ── Categories ─────────────────────────────────────────────────────────────────
const CATEGORIES: { id: CategoryId; label: string; activeLabel: string; icon: React.ElementType; gradient: string; iconColor: string }[] = [
  { id: "minters",   label: "Top Minters",   activeLabel: "Mint",     icon: HiCube,    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", iconColor: "text-blue-500"   },
  { id: "streakers", label: "Top Streakers", activeLabel: "Streak",   icon: HiFire,    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", iconColor: "text-orange-500" },
  { id: "points",    label: "Top Points",    activeLabel: "Points",   icon: HiBolt,    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", iconColor: "text-amber-400"  },
  { id: "creators",  label: "Top Creators",  activeLabel: "Creators", icon: HiStar,    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", iconColor: "text-purple-500" },
  { id: "donors",    label: "Top Donors",    activeLabel: "Donors",   icon: HiHeart,   gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", iconColor: "text-pink-500"   },
  { id: "winners",   label: "Top Winners",   activeLabel: "Winners",  icon: HiTrophy,  gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", iconColor: "text-yellow-500" },
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

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATARS = [
  ...Array.from({ length: 20 }, (_, i) => `/avatars/boy${i + 1}.webp`),
  ...Array.from({ length: 20 }, (_, i) => `/avatars/girl${i + 1}.webp`),
]

function addressAvatar(address: string): string {
  let hash = 0
  for (let i = 2; i < address.length; i++) {
    hash = (address.charCodeAt(i) + ((hash << 5) - hash)) | 0
  }
  return AVATARS[Math.abs(hash) % AVATARS.length]
}

function Identicon({ address }: { address: string }) {
  return (
    <img
      src={addressAvatar(address)}
      alt="avatar"
      className="w-9 h-9 rounded-full flex-shrink-0 object-cover shadow-sm"
    />
  )
}

// ── Podium top 3 ───────────────────────────────────────────────────────────────
// avatarSize is desktop max; on mobile the column shrinks and avatar fills it via w-full
const PODIUM_CONFIG: Record<1 | 2 | 3, { avatarSize: number; cardPb: string; badgeBg: string; sparkleColors: { first: string; second: string } }> = {
  1: { avatarSize: 130, cardPb: "pb-14", badgeBg: "#06b6d4", sparkleColors: { first: "#fbbf24", second: "#f59e0b" } },
  2: { avatarSize: 104, cardPb: "pb-8",  badgeBg: "#06b6d4", sparkleColors: { first: "#94a3b8", second: "#e2e8f0" } },
  3: { avatarSize: 104, cardPb: "pb-8",  badgeBg: "#06b6d4", sparkleColors: { first: "#cd7f32", second: "#d97706" } },
}

function PodiumCard({ entry, rank, category }: { entry: LeaderEntry; rank: number; category: CategoryId }) {
  const name = useWalletName(entry.address)
  const display = name || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`
  const isFirst = rank === 1
  const cfg = PODIUM_CONFIG[rank as 1 | 2 | 3]

  return (
    <div className="flex flex-col items-center w-full">
      {/* crown spacer */}
      {isFirst
        ? <span className="text-2xl leading-none mb-1.5">👑</span>
        : <div className="h-8" />
      }

      {/* avatar — w-full fills column; marginBottom -100% overlaps into card by one column-width */}
      <div className="relative z-10 w-full aspect-square" style={{ marginBottom: "-100%" }}>
        {/* outer ring matching card color */}
        <div
          className="rounded-full p-[5px] shadow-xl w-full h-full"
          style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.75) 0%, rgba(15,23,42,0.55) 100%)" }}
        >
          <img
            src={addressAvatar(entry.address)}
            alt="avatar"
            className="rounded-full w-full h-full object-cover"
          />
        </div>
        {/* rank badge */}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white shadow"
          style={{ background: cfg.badgeBg }}
        >
          {rank}
        </div>
      </div>

      {/* card — paddingTop: calc(100% + 14px) reserves space for the overlapping avatar */}
      <div
        className={cn("relative flex flex-col items-center w-full", cfg.cardPb)}
        style={{
          paddingTop: "calc(100% + 14px)",
          borderRadius: "9999px 9999px 40px 40px",
          background: "linear-gradient(180deg, rgba(15,23,42,0.75) 0%, rgba(15,23,42,0.55) 100%)",
        }}
      >
        <span className={cn("font-semibold text-white text-center w-full truncate px-2", isFirst ? "text-sm" : "text-xs")}>
          {display}
        </span>
        <div className="relative">
          <SparklesText
            className={cn("font-black text-white mt-1", isFirst ? "text-lg" : "text-sm")}
            colors={cfg.sparkleColors}
            sparklesCount={isFirst ? 8 : 5}
          >
            {formatValue(entry.value, category)}
          </SparklesText>
          {category === "winners" && entry.wins !== undefined && (
            <span className="absolute left-0 right-0 text-center text-[10px] text-white/60 font-medium" style={{ top: "calc(100% + 4px)" }}>
              {entry.wins} win{entry.wins !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function PodiumTop3({ entries, category }: { entries: LeaderEntry[]; category: CategoryId }) {
  if (entries.length === 0) return null

  const slots = [
    { entry: entries[1], rank: 2 as const },
    { entry: entries[0], rank: 1 as const },
    { entry: entries[2], rank: 3 as const },
  ]

  return (
    <div className="mx-4 md:mx-6 rounded-b-3xl">
      <div className="flex items-end justify-center px-4 pt-4 pb-5 gap-3 md:gap-4">
        {slots.map(({ entry, rank }) => {
          const cfg = PODIUM_CONFIG[rank]
          const maxW = cfg.avatarSize + 10
          return (
            <div key={rank} className="flex-1 flex flex-col items-center" style={{ maxWidth: maxW }}>
              {entry
                ? <PodiumCard entry={entry} rank={rank} category={category} />
                : (
                  <div className="flex flex-col items-center w-full">
                    <div className="h-8" />
                    <div
                      className={cn("w-full", cfg.cardPb)}
                      style={{
                        paddingTop: "calc(100% + 14px)",
                        borderRadius: "9999px 9999px 40px 40px",
                        background: "linear-gradient(180deg, rgba(15,23,42,0.75) 0%, rgba(15,23,42,0.55) 100%)",
                      }}
                    />
                  </div>
                )
              }
            </div>
          )
        })}
      </div>
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
    return <span className="text-base font-bold text-indigo-400 w-9 text-center flex-shrink-0">99+</span>
  }
  if (rank === 1) return <span className="text-xl w-9 text-center flex-shrink-0">👑</span>
  if (rank === 2) return <span className="text-lg w-9 text-center flex-shrink-0">🥈</span>
  if (rank === 3) return <span className="text-lg w-9 text-center flex-shrink-0">🥉</span>
  return (
    <span className={cn(
      "text-base font-bold w-9 text-center flex-shrink-0",
      isYou ? "text-indigo-400" : "text-gray-400"
    )}>
      {rank}
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
          "text-sm font-bold truncate block",
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
  "7d": {
    minters:  [{ address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", value: 5 }],
    streakers:[{ address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", value: 7 }],
    points:   [{ address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", value: 900 }],
    creators: [{ address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", value: 12.0 }],
    donors:   [{ address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", value: 10.0 }],
    winners:  [{ address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", value: 50.0, wins: 1 }],
  },
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
  "7d":  Record<CategoryId, LeaderEntry[]>
  "30d": Record<CategoryId, LeaderEntry[]>
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [category, setCategory] = useState<CategoryId>("minters")
  const [period, setPeriod] = useState<Period>("all")
  const [hoveredCat, setHoveredCat] = useState<CategoryId | null>(null)
  const [rowsScrolled, setRowsScrolled] = useState(false)
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

  const liveOrMock = data ?? { allTime: MOCK_DATA.all, "7d": MOCK_DATA["7d"], "30d": MOCK_DATA["30d"] }
  const entries = period === "all" ? liveOrMock.allTime[category] : liveOrMock[period][category]
  const yourIndex = connectedAddress
    ? entries.findIndex(e => e.address.toLowerCase() === connectedAddress.toLowerCase())
    : -1
  const yourInTop10 = yourIndex >= 0

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Mobile background — fixed full viewport including navbar/topbar */}
      <div
        className="block md:hidden fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/nightsky.webp')" }}
      />
      {/* Desktop background */}
      <div
        className="hidden md:block fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/nightskyxl.webp')" }}
      />
      <PageTopbar
        title="Leaderboard"
        mobileTransparent
        rightExtra={
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="h-7 w-16 text-xs font-bold bg-white/15 border-white/20 text-white rounded-full px-2 focus:ring-0 focus:ring-offset-0 [&>svg]:text-white [&>svg]:opacity-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="bg-slate-800 border-slate-600 min-w-[var(--radix-select-trigger-width)]">
              {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([val, label]) => (
                <SelectItem key={val} value={val} className="text-sm font-medium text-white focus:bg-slate-700 focus:text-white [&>span:last-child]:hidden pl-2">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <Navbar />

      <div className={cn("flex flex-col pt-14 pb-[72px] md:pb-6 flex-1 min-h-0 transition-opacity duration-200", loading && "opacity-50")}>

        {/* Static: podium + tabs */}
        <div>
          <PodiumTop3 entries={entries.slice(0, 3)} category={category} />

          {/* Category tabs — below podium */}
          <div className="px-4 overflow-hidden">
            <div className="flex items-center gap-2">
              {/* Period toggle — desktop only, before category tabs */}
              <div className="hidden md:flex flex-shrink-0 items-center rounded-lg p-0.5 gap-0" style={{ background: "rgba(15,23,42,0.75)" }}>
                {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([p, label]) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                      period === p ? "bg-blue-500 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 flex-1 overflow-x-auto md:overflow-x-visible [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                {CATEGORIES.map((cat, idx) => {
                  const Icon = cat.icon
                  const isActive = category === cat.id
                  const isHovered = hoveredCat === cat.id
                  const hoveredIdx = hoveredCat ? CATEGORIES.findIndex(c => c.id === hoveredCat) : -1
                  const isMintHoveredOrActive = hoveredIdx === 0 || (hoveredIdx === -1 && CATEGORIES.findIndex(c => c.id === category) === 0)
                  const shouldShrink = hoveredIdx >= 0 && !isActive && !isHovered && (
                    isMintHoveredOrActive ? idx === 1 : idx === hoveredIdx - 1
                  )
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      onMouseEnter={() => setHoveredCat(cat.id)}
                      onMouseLeave={() => setHoveredCat(null)}
                      className={cn(
                        "group flex-shrink-0 w-16 md:w-auto flex flex-col items-center justify-center gap-1 py-2 md:flex-row md:items-center md:justify-center md:gap-1.5 md:py-1.5 rounded-[5px] text-xs font-semibold transition-all duration-300 ease-in-out",
                        isActive
                          ? "text-white md:flex-[1_1_0%]"
                          : shouldShrink
                            ? "text-white/60 md:flex-[0.5_0.5_0%]"
                            : "text-white/60 hover:text-white/90 md:flex-[1_1_0%] md:hover:flex-[2_2_0%]"
                      )}
                      style={isActive ? { background: cat.gradient, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" } : { background: "rgba(15,23,42,0.75)" }}
                    >
                      <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", !isActive && cat.iconColor)} />
                      {/* Mobile: always visible */}
                      <span className="md:hidden">{cat.activeLabel}</span>
                      {/* Desktop: slides in on hover or when active */}
                      <span className={cn(
                        "hidden md:block whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out font-bold",
                        isActive || isHovered ? "max-w-[80px] opacity-100" : "max-w-0 opacity-0"
                      )}>
                        {cat.activeLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable: rows only */}
        <div
          className={cn("flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden transition-[margin] duration-200", rowsScrolled ? "mt-4" : "mt-0")}
          style={{ scrollbarWidth: "none" }}
          onScroll={e => setRowsScrolled((e.currentTarget as HTMLDivElement).scrollTop > 0)}
        >
          {/* Your wallet row */}
          {connectedAddress && !yourInTop10 && (
            <div className="px-4 pt-3">
              <YourRow address={connectedAddress} category={category} />
            </div>
          )}

          {entries.length > 3 && (
            <div className="px-4 pb-[80px] md:pb-[56px] mt-4 space-y-1.5">
              {entries.slice(3).map((entry, i) => (
                <LeaderRow
                  key={entry.address}
                  entry={entry}
                  rank={i + 4}
                  category={category}
                  isYou={entry.address.toLowerCase() === (connectedAddress?.toLowerCase() ?? "")}
                />
              ))}
            </div>
          )}
        </div>

      </div>
      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 h-20 pointer-events-none z-40">
        <div className="relative h-full">
          <ProgressiveBlur height="100%" position="bottom" />
        </div>
      </div>
    </div>
  )
}
