"use client"

import { useState, useEffect, useCallback } from "react"
import { useReadContract } from "wagmi"
import { readContract } from "wagmi/actions"
import { BOOZTORY_ADDRESS, BOOZTORY_ABI, USDC_ADDRESS, ERC20_ABI, parseSlot, getPlaceholderContent, type ContentItem, type OnChainSlot } from "@/lib/contract"
import { WORLD_BOOZTORY_ADDRESS, WORLD_BOOZTORY_ABI, WORLD_USDC_ADDRESS } from "@/lib/contractWorld"
import { APP_CHAIN, WORLD_CHAIN, wagmiConfig } from "@/lib/wagmi"
import { isWorldApp } from "@/lib/miniapp-flag"

export function useCurrentSlot() {
  const inWorldApp = isWorldApp()
  const contractAddress = inWorldApp ? WORLD_BOOZTORY_ADDRESS : BOOZTORY_ADDRESS
  const contractAbi    = inWorldApp ? WORLD_BOOZTORY_ABI     : BOOZTORY_ABI
  const usdcAddress    = inWorldApp ? WORLD_USDC_ADDRESS     : USDC_ADDRESS
  const chainId        = inWorldApp ? WORLD_CHAIN.id         : APP_CHAIN.id

  const { data, isLoading, refetch } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "getCurrentSlot",
    chainId,
    query: { refetchInterval: 30_000, refetchOnWindowFocus: false },
  })

  const { data: usdcBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [contractAddress],
    chainId,
    query: { refetchInterval: 60_000, refetchOnWindowFocus: false },
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
  const inWorldApp = isWorldApp()
  const { data, isLoading, refetch } = useReadContract({
    address: inWorldApp ? WORLD_BOOZTORY_ADDRESS : BOOZTORY_ADDRESS,
    abi: inWorldApp ? WORLD_BOOZTORY_ABI : BOOZTORY_ABI,
    functionName: "getUpcomingSlots",
    chainId: inWorldApp ? WORLD_CHAIN.id : APP_CHAIN.id,
    query: { refetchInterval: 60_000, refetchOnWindowFocus: false },
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

  const inWorldApp = isWorldApp()
  // Fetch the first page via hook (benefits from wagmi cache)
  const { data, isLoading } = useReadContract({
    address: inWorldApp ? WORLD_BOOZTORY_ADDRESS : BOOZTORY_ADDRESS,
    abi: inWorldApp ? WORLD_BOOZTORY_ABI : BOOZTORY_ABI,
    functionName: "getPastSlots",
    args: [0n, PAGE_SIZE],
    chainId: inWorldApp ? WORLD_CHAIN.id : APP_CHAIN.id,
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
        address: inWorldApp ? WORLD_BOOZTORY_ADDRESS : BOOZTORY_ADDRESS,
        abi: inWorldApp ? WORLD_BOOZTORY_ABI : BOOZTORY_ABI,
        functionName: "getPastSlots",
        args: [nextOffset, PAGE_SIZE],
        chainId: inWorldApp ? WORLD_CHAIN.id : APP_CHAIN.id,
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
