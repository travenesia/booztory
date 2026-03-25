"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Navbar } from "@/components/layout/navbar"
import { HistoryCard } from "@/components/content/historyCard"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllPastSlots } from "@/hooks/useContractContent"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { useAccount } from "wagmi"

const ITEMS_PER_PAGE = 5

function HistoryPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { items: allItems, isLoading, isFetchingMore, fetchMore, hasMore } = useAllPastSlots()
  const { address } = useAccount()
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  const sortedItems = address
    ? [...allItems].sort((a, b) => {
        const aOwn = a.submittedBy.toLowerCase() === address.toLowerCase() ? -1 : 0
        const bOwn = b.submittedBy.toLowerCase() === address.toLowerCase() ? 1 : 0
        return aOwn + bOwn
      })
    : allItems

  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const displayedContent = sortedItems.slice(0, visibleCount)

  const loadMoreItems = useCallback(async () => {
    if (isLoadingMore || isFetchingMore) return
    setIsLoadingMore(true)

    if (visibleCount < sortedItems.length) {
      // More client-side items available — just reveal them
      setTimeout(() => {
        setVisibleCount((c) => Math.min(c + ITEMS_PER_PAGE, sortedItems.length))
        setIsLoadingMore(false)
      }, 300)
    } else if (hasMore) {
      // All client items shown — fetch next page from contract
      await fetchMore()
      setVisibleCount((c) => c + ITEMS_PER_PAGE)
      setIsLoadingMore(false)
    } else {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, isFetchingMore, visibleCount, sortedItems.length, hasMore, fetchMore])

  const showLoadMoreTrigger = visibleCount < sortedItems.length || hasMore

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !isFetchingMore && showLoadMoreTrigger) {
          loadMoreItems()
        }
      },
      { threshold: 0.8 },
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => {
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [isLoadingMore, isFetchingMore, loadMoreItems, showLoadMoreTrigger])

  if (!mounted || (isLoading && sortedItems.length === 0)) {
    return (
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
  }

  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="History" />
      <section className="pt-6 pb-[136px] md:pb-[88px] px-6 max-w-[650px] mx-auto w-full">
        {sortedItems.length === 0 && !isLoadingMore && !isLoading ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-2">No content history available</div>
            <p className="text-gray-400 text-sm">Featured content will appear here after it expires</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedContent.map((content, index) => (
              <div
                key={content.id + "-" + index}
                className="animate-fadeIn"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <HistoryCard content={content} isOwn={!!address && content.submittedBy.toLowerCase() === address.toLowerCase()} />
              </div>
            ))}
          </div>
        )}
        {(isLoadingMore || isFetchingMore) && (
          <div className="space-y-4 mt-4">
            {[...Array(2)].map((_, i) => (
              <div
                key={`skeleton-history-${i}`}
                className="bg-gray-0 rounded-lg overflow-hidden"
              >
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
      {/* Progressive blur fixed above navbar */}
      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 h-20 pointer-events-none z-40">
        <div className="relative h-full">
          <ProgressiveBlur height="100%" position="bottom" />
        </div>
      </div>
      <Navbar />
    </main>
  )
}

export default HistoryPage
