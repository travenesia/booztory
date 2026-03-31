"use client"

import dynamic from "next/dynamic"

export const ContentSubmissionDrawer = dynamic(
  () => import("@/components/modals/submitContent").then((m) => ({ default: m.ContentSubmissionDrawer })),
  { ssr: false },
)

export const SponsorAdSidebar = dynamic(
  () => import("@/components/ads/sponsorAd").then((m) => ({ default: m.SponsorAdSidebar })),
  { ssr: false },
)

export const LivePill = dynamic(
  () => import("@/components/layout/livePill").then((m) => ({ default: m.LivePill })),
  { ssr: false },
)
