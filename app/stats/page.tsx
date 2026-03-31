"use client"

import React, { useState, useEffect, Fragment } from "react"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { cn } from "@/lib/utils"
import { HiChartBar } from "react-icons/hi2"

// ── Types ──────────────────────────────────────────────────────────────────────
interface StatsData {
  totalSlotsMinted: number
  totalContentHours: number
  totalUniqueCreators: number
  totalUsers: number
  totalStandardMints: number
  totalDiscountMints: number
  totalFreeMints: number
  totalGMClaims: number
  totalUSDCDonated: number
  totalDonationCount: number
  totalBOOZEarned: number
  totalPointsEarned: number
  totalPointsBurned: number
  totalTicketsIssued: number
  totalRaffleEntries: number
  totalRafflesDrawn: number
  totalPrizePoolPaid: number
  totalUniqueWinners: number
}

type Tab = "all" | "content" | "community" | "rewards"
type Theme = "blue" | "teal" | "purple"

const TABS: { id: Tab; label: string }[] = [
  { id: "all",       label: "All"       },
  { id: "content",   label: "Content"   },
  { id: "community", label: "Community" },
  { id: "rewards",   label: "Rewards"   },
]

// ── Themed stat card ───────────────────────────────────────────────────────────
const THEME_STYLES: Record<Theme, { card: string; value: string; label: string }> = {
  blue:   { card: "bg-blue-50 border-blue-100",     value: "text-blue-900",   label: "text-blue-500"   },
  teal:   { card: "bg-teal-50 border-teal-100",     value: "text-teal-900",   label: "text-teal-600"   },
  purple: { card: "bg-purple-50 border-purple-100", value: "text-purple-900", label: "text-purple-500" },
}

function StatCard({ value, label, theme }: { value: string; label: string; theme: Theme }) {
  const t = THEME_STYLES[theme]
  return (
    <div className={cn("rounded-xl p-4 border", t.card)}>
      <div className={cn("text-2xl font-bold", t.value)}>{value}</div>
      <div className={cn("text-xs mt-1 font-medium", t.label)}>{label}</div>
    </div>
  )
}

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <Skeleton className="h-8 w-24 rounded bg-gray-200 mb-1" />
      <Skeleton className="h-3 w-32 rounded bg-gray-200" />
    </div>
  )
}


// ── Loading state ──────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <>
      {/* Hero skeleton */}
      <Skeleton className="h-32 w-full rounded-2xl bg-gray-200 mb-4" />
      {/* Tabs skeleton */}
      <Skeleton className="h-11 w-full rounded-xl bg-gray-200 mb-6" />
      {/* Cards */}
      <Skeleton className="h-4 w-24 rounded bg-gray-200 mb-3" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <Skeleton className="h-4 w-24 rounded bg-gray-200 mt-6 mb-3" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <Skeleton className="h-4 w-32 rounded bg-gray-200 mt-6 mb-3" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("all")

  const fetchStats = () => {
    setLoading(true)
    setError(null)
    fetch("/api/stats")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch stats (${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setStats(data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Something went wrong")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const GRID = "grid grid-cols-2 md:grid-cols-3 gap-3"

  return (
    <main className="min-h-screen pt-12 pb-20">
      <PageTopbar title="Stats" />

      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full">

        {loading && <LoadingState />}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p className="text-sm text-gray-500">{error}</p>
            <button
              onClick={fetchStats}
              className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && stats && (
          <>
            {/* ── Hero card ── */}
            <div
              className="relative rounded-2xl overflow-hidden text-white mb-4"
              style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)" }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(255,255,255,0.12) 0%, transparent 60%)" }}
              />
              <div className="relative px-6 pt-6 pb-5">
                <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest text-blue-100 uppercase">Live Platform Data</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="text-2xl font-black leading-tight">
                      <span className="text-yellow-300">Platform</span>{" "}
                      <span className="text-white">Stats</span>
                    </h1>
                    <p className="text-sm text-white/60 mt-1">Activity across the Booztory platform</p>
                  </div>
                  <HiChartBar size={40} className="text-white/15 flex-shrink-0 mb-1" />
                </div>
              </div>

              {/* Quick highlights row */}
              <div className="grid grid-cols-3 gap-px bg-white/10 border-t border-white/10">
                <div className="bg-white/5 px-4 py-3 text-center">
                  <p className="text-lg font-black text-white">{stats.totalSlotsMinted.toLocaleString()}</p>
                  <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wide">Content</p>
                </div>
                <div className="bg-white/5 px-4 py-3 text-center">
                  <p className="text-lg font-black text-white">{stats.totalUsers.toLocaleString()}</p>
                  <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wide">Users</p>
                </div>
                <div className="bg-white/5 px-4 py-3 text-center">
                  <p className="text-lg font-black text-white">${stats.totalPrizePoolPaid.toFixed(0)}</p>
                  <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wide">Paid Out</p>
                </div>
              </div>
            </div>

            {/* ── Tab switcher ── */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              {TABS.map((t, i) => (
                <Fragment key={t.id}>
                  {i > 0 && tab !== t.id && tab !== TABS[i - 1].id && (
                    <div className="w-px my-1.5 bg-gray-300 flex-shrink-0" />
                  )}
                  <button
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                      tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {t.label}
                  </button>
                </Fragment>
              ))}
            </div>

            {/* ── All: one merged grid, no gaps ── */}
            {tab === "all" && (
              <div className={GRID}>
                <StatCard value={stats.totalSlotsMinted.toLocaleString()}          label="Total Content Minted"      theme="blue"   />
                <StatCard value={`${stats.totalContentHours.toFixed(1)} hrs`}      label="Content Hours Featured"    theme="blue"   />
                <StatCard value={stats.totalUniqueCreators.toLocaleString()}       label="Unique Creators"           theme="blue"   />
                <StatCard value={stats.totalStandardMints.toLocaleString()}        label="Standard Mints"            theme="blue"   />
                <StatCard value={stats.totalDiscountMints.toLocaleString()}        label="Discount Mints"            theme="blue"   />
                <StatCard value={stats.totalFreeMints.toLocaleString()}            label="Free Mints"                theme="blue"   />
                <StatCard value={stats.totalUsers.toLocaleString()}                label="Total Users"               theme="teal"   />
                <StatCard value={stats.totalGMClaims.toLocaleString()}             label="Total GM Claims"           theme="teal"   />
                <StatCard value={`$${stats.totalUSDCDonated.toFixed(2)}`}          label="USDC Donated to Creators"  theme="teal"   />
                <StatCard value={stats.totalDonationCount.toLocaleString()}        label="Total Donations Made"      theme="teal"   />
                <StatCard value={stats.totalBOOZEarned.toLocaleString()}           label="BOOZ Earned via GM"        theme="purple" />
                <StatCard value={stats.totalPointsEarned.toLocaleString()}         label="Total Points Earned"       theme="purple" />
                <StatCard value={stats.totalPointsBurned.toLocaleString()}         label="Points Burned for Tickets" theme="purple" />
                <StatCard value={stats.totalTicketsIssued.toLocaleString()}        label="Tickets Issued"            theme="purple" />
                <StatCard value={stats.totalRaffleEntries.toLocaleString()}        label="Total Raffle Entries"      theme="purple" />
                <StatCard value={stats.totalRafflesDrawn.toLocaleString()}         label="Raffles Completed"         theme="purple" />
                <StatCard value={`$${stats.totalPrizePoolPaid.toFixed(2)}`}        label="Prize Pool Paid Out"       theme="purple" />
                <StatCard value={stats.totalUniqueWinners.toLocaleString()}        label="Unique Winners"            theme="purple" />
              </div>
            )}

            {/* ── Content tab ── */}
            {tab === "content" && (
              <div className={GRID}>
                <StatCard value={stats.totalSlotsMinted.toLocaleString()}          label="Total Content Minted"      theme="blue" />
                <StatCard value={`${stats.totalContentHours.toFixed(1)} hrs`}      label="Content Hours Featured"    theme="blue" />
                <StatCard value={stats.totalUniqueCreators.toLocaleString()}       label="Unique Creators"           theme="blue" />
                <StatCard value={stats.totalStandardMints.toLocaleString()}        label="Standard Mints"            theme="blue" />
                <StatCard value={stats.totalDiscountMints.toLocaleString()}        label="Discount Mints"            theme="blue" />
                <StatCard value={stats.totalFreeMints.toLocaleString()}            label="Free Mints"                theme="blue" />
              </div>
            )}

            {/* ── Community tab ── */}
            {tab === "community" && (
              <div className={GRID}>
                <StatCard value={stats.totalUsers.toLocaleString()}                label="Total Users"               theme="teal" />
                <StatCard value={stats.totalGMClaims.toLocaleString()}             label="Total GM Claims"           theme="teal" />
                <StatCard value={`$${stats.totalUSDCDonated.toFixed(2)}`}          label="USDC Donated to Creators"  theme="teal" />
                <StatCard value={stats.totalDonationCount.toLocaleString()}        label="Total Donations Made"      theme="teal" />
              </div>
            )}

            {/* ── Rewards tab ── */}
            {tab === "rewards" && (
              <div className={GRID}>
                <StatCard value={stats.totalBOOZEarned.toLocaleString()}           label="BOOZ Earned via GM"        theme="purple" />
                <StatCard value={stats.totalPointsEarned.toLocaleString()}         label="Total Points Earned"       theme="purple" />
                <StatCard value={stats.totalPointsBurned.toLocaleString()}         label="Points Burned for Tickets" theme="purple" />
                <StatCard value={stats.totalTicketsIssued.toLocaleString()}        label="Tickets Issued"            theme="purple" />
                <StatCard value={stats.totalRaffleEntries.toLocaleString()}        label="Total Raffle Entries"      theme="purple" />
                <StatCard value={stats.totalRafflesDrawn.toLocaleString()}         label="Raffles Completed"         theme="purple" />
                <StatCard value={`$${stats.totalPrizePoolPaid.toFixed(2)}`}        label="Prize Pool Paid Out"       theme="purple" />
                <StatCard value={stats.totalUniqueWinners.toLocaleString()}        label="Unique Winners"            theme="purple" />
              </div>
            )}

            <p className="text-xs text-gray-400 text-center py-6">Updated every 30 minutes</p>
          </>
        )}

      </section>

      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 h-20 pointer-events-none z-40">
        <div className="relative h-full">
          <ProgressiveBlur height="100%" position="bottom" />
        </div>
      </div>
      <Navbar />
    </main>
  )
}
