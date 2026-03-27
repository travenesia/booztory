"use client"

import React, { useState, useEffect } from "react"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { Skeleton } from "@/components/ui/skeleton"

// ── Types ──────────────────────────────────────────────────────────────────────
interface StatsData {
  totalSlotsMinted: number
  totalContentHours: number
  totalUniqueCreators: number
  totalUsers: number
  totalGMClaims: number
  totalUSDCDonated: number
  totalBOOZEarned: number
  totalPointsEarned: number
  totalTicketsIssued: number
  totalPrizePoolPaid: number
  totalUniqueWinners: number
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <Skeleton className="h-8 w-24 rounded bg-gray-200 mb-1" />
      <Skeleton className="h-3 w-32 rounded bg-gray-200" />
    </div>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6">
      {title}
    </h2>
  )
}

// ── Loading Skeletons ─────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <>
      <div className="mb-2">
        <Skeleton className="h-7 w-32 rounded-lg bg-gray-200" />
        <Skeleton className="h-4 w-56 rounded-lg bg-gray-200 mt-2" />
      </div>

      <Skeleton className="h-4 w-24 rounded bg-gray-200 mt-6 mb-3" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
      </div>

      <Skeleton className="h-4 w-24 rounded bg-gray-200 mt-6 mb-3" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
      </div>

      <Skeleton className="h-4 w-32 rounded bg-gray-200 mt-6 mb-3" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <main className="min-h-screen pt-12 pb-20">
      <PageTopbar title="Stats" />
      <Navbar />

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
            {/* Page heading */}
            <div className="mb-2">
              <h1 className="text-xl font-bold text-gray-900">Platform Stats</h1>
              <p className="text-sm text-gray-500 mt-1">Live activity across the Booztory platform</p>
            </div>

            {/* Section 1 — Content */}
            <SectionHeader title="Content" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                value={stats.totalSlotsMinted.toLocaleString()}
                label="Total Slots Minted"
              />
              <StatCard
                value={`${stats.totalContentHours.toFixed(1)} hrs`}
                label="Content Hours Featured"
              />
              <StatCard
                value={stats.totalUniqueCreators.toLocaleString()}
                label="Unique Creators"
              />
            </div>

            {/* Section 2 — Community */}
            <SectionHeader title="Community" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                value={stats.totalUsers.toLocaleString()}
                label="Total Users"
              />
              <StatCard
                value={stats.totalGMClaims.toLocaleString()}
                label="Total GM Claims"
              />
              <StatCard
                value={`$${stats.totalUSDCDonated.toFixed(2)}`}
                label="USDC Donated to Creators"
              />
            </div>

            {/* Section 3 — Rewards & Raffle */}
            <SectionHeader title="Rewards & Raffle" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                value={stats.totalBOOZEarned.toLocaleString()}
                label="BOOZ Earned via GM"
              />
              <StatCard
                value={stats.totalPointsEarned.toLocaleString()}
                label="Total Points Earned"
              />
              <StatCard
                value={stats.totalTicketsIssued.toLocaleString()}
                label="Tickets Issued"
              />
              <StatCard
                value={`$${stats.totalPrizePoolPaid.toFixed(2)}`}
                label="Prize Pool Paid Out"
              />
              <StatCard
                value={stats.totalUniqueWinners.toLocaleString()}
                label="Unique Winners"
              />
            </div>

            <p className="text-xs text-gray-400 text-center py-4">Updated every 30 minutes</p>
          </>
        )}

      </section>
    </main>
  )
}
