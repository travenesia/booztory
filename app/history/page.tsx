"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Navbar } from "@/components/layout/navbar"
import { HistoryCard } from "@/components/content/historyCard"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllPastSlots } from "@/hooks/useContractContent"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { ScrollToTopButton } from "@/components/layout/scrollToTopButton"
import { ScrollReveal } from "@/components/layout/scrollReveal"
import { useAccount } from "wagmi"
import { useSession } from "next-auth/react"
import { MiniKit } from "@worldcoin/minikit-js"
import { isWorldApp } from "@/lib/miniapp-flag"
import { HiAdjustmentsHorizontal } from "react-icons/hi2"
import {
  DEFAULT_HISTORY_FILTERS,
  isNonDefault,
  applySlotFilters,
  DesktopFilterPanel,
  MobileFilterDrawer,
  type SlotFilterState,
} from "@/components/filters/slotFilters"

const ITEMS_PER_PAGE = 5

function HistoryPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { items: allItems, isLoading, isFetchingMore, fetchMore, hasMore } = useAllPastSlots()
  const { address: wagmiAddress } = useAccount()
  const { data: session } = useSession()
  const inWorldApp = isWorldApp()
  const address = wagmiAddress
    ?? (session?.user?.walletAddress as `0x${string}` | undefined)
    ?? (inWorldApp ? (MiniKit.user?.walletAddress as `0x${string}` | undefined) : undefined)

  const [appliedFilters, setAppliedFilters] = useState<SlotFilterState>(DEFAULT_HISTORY_FILTERS)
  const [draftFilters, setDraftFilters] = useState<SlotFilterState>(DEFAULT_HISTORY_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filteredItems = applySlotFilters(allItems, appliedFilters, address, "history")

  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const displayedContent = filteredItems.slice(0, visibleCount)
  const showLoadMoreTrigger = visibleCount < filteredItems.length || hasMore

  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE) }, [appliedFilters])

  const loadMoreItems = useCallback(async () => {
    if (isLoadingMore || isFetchingMore) return
    setIsLoadingMore(true)
    if (visibleCount < filteredItems.length) {
      setTimeout(() => {
        setVisibleCount(c => Math.min(c + ITEMS_PER_PAGE, filteredItems.length))
        setIsLoadingMore(false)
      }, 300)
    } else if (hasMore) {
      await fetchMore()
      setVisibleCount(c => c + ITEMS_PER_PAGE)
      setIsLoadingMore(false)
    } else {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, isFetchingMore, visibleCount, filteredItems.length, hasMore, fetchMore])

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !isFetchingMore && showLoadMoreTrigger) {
          loadMoreItems()
        }
      },
      { threshold: 0.8 }
    )
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)
    return () => { if (observerRef.current) observerRef.current.disconnect() }
  }, [isLoadingMore, isFetchingMore, loadMoreItems, showLoadMoreTrigger])

  const handleOpenDrawer = () => {
    setDraftFilters(appliedFilters)
    setDrawerOpen(true)
  }
  const handleApply = () => {
    setAppliedFilters(draftFilters)
    setDrawerOpen(false)
  }
  const handleReset = () => setDraftFilters(DEFAULT_HISTORY_FILTERS)

  const filterIcon = allItems.length > 0 ? (
    <button onClick={handleOpenDrawer} className="relative p-0 flex items-center justify-center w-8 h-8 text-gray-600">
      <HiAdjustmentsHorizontal size={20} />
      {isNonDefault(appliedFilters, DEFAULT_HISTORY_FILTERS) && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </button>
  ) : undefined

  const skeletonContent = (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="History" />
      <section className="py-6 px-6 max-w-[650px] mx-auto w-full space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-0 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-[#eef0f3]">
              <Skeleton className="h-4 w-1/2 bg-gray-200" />
              <Skeleton className="h-4 w-4 rounded-full bg-gray-200" />
            </div>
            <div className="flex p-3">
              <div className="relative w-1/3 mr-3">
                <Skeleton className="aspect-video w-full rounded-md bg-gray-100" />
              </div>
              <div className="w-2/3 space-y-2">
                <Skeleton className="h-4 w-full bg-gray-100" />
                <Skeleton className="h-4 w-3/4 bg-gray-100" />
              </div>
            </div>
          </div>
        ))}
      </section>
      <Navbar />
    </main>
  )

  if (!mounted || (isLoading && allItems.length === 0)) return skeletonContent

  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="History" rightExtra={filterIcon} />

      {allItems.length > 0 && (
        <DesktopFilterPanel
          filters={appliedFilters}
          onChange={setAppliedFilters}
          showYou={!!address}
        />
      )}

      <MobileFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        draft={draftFilters}
        onDraftChange={setDraftFilters}
        onApply={handleApply}
        onReset={handleReset}
        showYou={!!address}
      />

      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full">
        {filteredItems.length === 0 && !isLoadingMore && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <span className="text-4xl mb-4">🗂️</span>
            <p className="text-base font-bold text-gray-800 mb-1">
              {allItems.length === 0 ? "No history yet" : "No results"}
            </p>
            <p className="text-sm text-gray-500">
              {allItems.length === 0
                ? "Past featured content will show up here once spots have ended."
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedContent.map((content, index) => (
              <ScrollReveal key={content.id + "-" + index} delay={Math.min(index * 0.05, 0.25)}>
                <HistoryCard
                  content={content}
                  isOwn={!!address && content.submittedBy.toLowerCase() === address.toLowerCase()}
                />
              </ScrollReveal>
            ))}
          </div>
        )}

        {(isLoadingMore || isFetchingMore) && (
          <div className="space-y-4 mt-4">
            {[...Array(2)].map((_, i) => (
              <div key={`skeleton-history-${i}`} className="bg-gray-0 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-[#eef0f3]">
                  <Skeleton className="h-4 w-1/2 bg-gray-200" />
                  <Skeleton className="h-4 w-4 rounded-full bg-gray-200" />
                </div>
                <div className="flex p-3">
                  <div className="relative w-1/3 mr-3">
                    <Skeleton className="aspect-video w-full rounded-md bg-gray-100" />
                  </div>
                  <div className="w-2/3 space-y-2">
                    <Skeleton className="h-4 w-full bg-gray-100" />
                    <Skeleton className="h-4 w-3/4 bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showLoadMoreTrigger && !isLoadingMore && !isFetchingMore && (
          <div ref={loadMoreRef} style={{ height: "20px", margin: "10px 0" }} />
        )}
        {displayedContent.length > 0 && !showLoadMoreTrigger && !isLoadingMore && !isFetchingMore && (
          <div className="text-center py-4 text-gray-500 text-sm">All history content loaded.</div>
        )}
      </section>

      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 h-20 pointer-events-none z-40">
        <div className="relative h-full">
          <ProgressiveBlur height="100%" position="bottom" />
        </div>
      </div>
      <ScrollToTopButton />
      <Navbar />
    </main>
  )
}

export default HistoryPage
