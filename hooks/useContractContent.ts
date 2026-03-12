"use client"

import { useReadContract } from "wagmi"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI, USDC_ADDRESS, ERC20_ABI, parseSlot, getPlaceholderContent, type ContentItem, type OnChainSlot } from "@/lib/contract"
import { APP_CHAIN } from "@/lib/wagmi"

export function useCurrentSlot() {
  const { data, isLoading, refetch } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getCurrentSlot",
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 30_000 },
  })

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [BOOZTORY_ADDRESS],
    chainId: APP_CHAIN.id,
    query: { refetchInterval: 30_000 },
  })

  const content: ContentItem = data
    ? data[2]
      ? parseSlot(data[0] as bigint, data[1] as OnChainSlot)
      : getPlaceholderContent()
    : getPlaceholderContent()

  const isPlaceholder = !data || !data[2]
  const contractUsdcBalance = usdcBalance ? Number(usdcBalance as bigint) / 1_000_000 : 0

  return { content, isPlaceholder, isLoading, refetch, contractUsdcBalance }
}

export function useUpcomingSlots() {
  const { data, isLoading, refetch } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getUpcomingSlots",
    chainId: APP_CHAIN.id,
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
    chainId: APP_CHAIN.id,
  })

  const items: ContentItem[] = data
    ? (data[0] as bigint[]).map((id, i) => parseSlot(id, data[1][i] as OnChainSlot))
    : []

  const total = data ? Number(data[2]) : 0

  return { items, total, isLoading, refetch }
}
