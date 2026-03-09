"use client"

import { useReadContract } from "wagmi"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI, parseSlot, getPlaceholderContent, type ContentItem, type OnChainSlot } from "@/lib/contract"

export function useCurrentSlot() {
  const { data, isLoading, refetch } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getCurrentSlot",
    query: { refetchInterval: 30_000 },
  })

  const content: ContentItem = data
    ? data[2]
      ? parseSlot(data[0] as bigint, data[1] as OnChainSlot)
      : getPlaceholderContent()
    : getPlaceholderContent()

  const isPlaceholder = !data || !data[2]

  return { content, isPlaceholder, isLoading, refetch }
}

export function useUpcomingSlots() {
  const { data, isLoading, refetch } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getUpcomingSlots",
    query: { refetchInterval: 30_000 },
  })

  const items: ContentItem[] = data
    ? (data[0] as bigint[]).map((id, i) => parseSlot(id, data[1][i] as OnChainSlot))
    : []

  return { items, isLoading, refetch }
}

const PAGE_SIZE = 50n

export function useAllPastSlots() {
  const { data, isLoading, refetch } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getPastSlots",
    args: [0n, PAGE_SIZE],
  })

  const items: ContentItem[] = data
    ? (data[0] as bigint[]).map((id, i) => parseSlot(id, data[1][i] as OnChainSlot))
    : []

  const total = data ? Number(data[2]) : 0

  return { items, total, isLoading, refetch }
}
