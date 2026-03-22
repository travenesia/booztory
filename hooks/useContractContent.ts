"use client"

import { useState, useEffect, useCallback } from "react"
import { useReadContract } from "wagmi"
import { readContract } from "wagmi/actions"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI, USDC_ADDRESS, ERC20_ABI, parseSlot, getPlaceholderContent, type ContentItem, type OnChainSlot } from "@/lib/contract"
import { APP_CHAIN, wagmiConfig } from "@/lib/wagmi"

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
    query: { refetchInterval: 60_000 },
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
    query: { refetchInterval: 60_000 },
  })

  const items: ContentItem[] = data
    ? (data[0] as bigint[]).map((id, i) => parseSlot(id, data[1][i] as OnChainSlot))
    : []

  return { items, isLoading, refetch }
}

const PAGE_SIZE = 50n

export function useAllPastSlots() {
  const [allItems, setAllItems] = useState<ContentItem[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState(PAGE_SIZE)
  const [isFetchingMore, setIsFetchingMore] = useState(false)

  // Fetch the first page via hook (benefits from wagmi cache)
  const { data, isLoading } = useReadContract({
    address: BOOZTORY_ADDRESS,
    abi: BOOZTORY_ABI,
    functionName: "getPastSlots",
    args: [0n, PAGE_SIZE],
    chainId: APP_CHAIN.id,
  })

  useEffect(() => {
    if (!data) return
    const parsed = (data[0] as bigint[]).map((id, i) =>
      parseSlot(id, (data[1] as OnChainSlot[])[i])
    )
    setAllItems(parsed)
    setTotal(Number(data[2]))
    setNextOffset(PAGE_SIZE)
  }, [data])

  const hasMore = nextOffset < BigInt(total)

  const fetchMore = useCallback(async () => {
    if (isFetchingMore || !hasMore) return
    setIsFetchingMore(true)
    try {
      const result = await readContract(wagmiConfig, {
        address: BOOZTORY_ADDRESS,
        abi: BOOZTORY_ABI,
        functionName: "getPastSlots",
        args: [nextOffset, PAGE_SIZE],
        chainId: APP_CHAIN.id,
      })
      const parsed = (result[0] as bigint[]).map((id, i) =>
        parseSlot(id, (result[1] as OnChainSlot[])[i])
      )
      setAllItems(prev => [...prev, ...parsed])
      setNextOffset(prev => prev + PAGE_SIZE)
    } catch {
      // silently ignore — user can scroll again to retry
    } finally {
      setIsFetchingMore(false)
    }
  }, [isFetchingMore, hasMore, nextOffset])

  return { items: allItems, total, isLoading, isFetchingMore, fetchMore, hasMore }
}
