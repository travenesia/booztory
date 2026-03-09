"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Navbar } from "@/components/layout/navbar"
import { HistoryCard } from "@/components/content/historyCard"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllPastSlots } from "@/hooks/useContractContent"

const ITEMS_PER_PAGE = 5

function HistoryPage() {
  const { items: allItems, isLoading } = useAllPastSlots()
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const displayedContent = allItems.slice(0, visibleCount)

  const loadMoreItems = useCallback(() => {
    if (visibleCount >= allItems.length) return
    setIsLoadingMore(true)
    setTimeout(() => {
      setVisibleCount((c) => Math.min(c + ITEMS_PER_PAGE, allItems.length))
      setIsLoadingMore(false)
    }, 500)
  }, [visibleCount, allItems.length])

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && visibleCount < allItems.length) {
          loadMoreItems()
        }
      },
      { threshold: 0.8 },
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => {
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [isLoadingMore, loadMoreItems, visibleCount, allItems.length])

  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="History" />
      <section className="py-6 px-6 h-[calc(100vh-96px)] overflow-y-auto max-w-[650px] mx-auto w-full">
        {allItems.length === 0 && !isLoadingMore && !isLoading ? (
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
                <HistoryCard content={content} />
              </div>
            ))}
          </div>
        )}
        {isLoadingMore && (
          <div className="space-y-4 mt-4">
            {[...Array(2)].map((_, i) => (
              <div
                key={`skeleton-history-${i}`}
                className="bg-gray-0 rounded-lg shadow-custom-md overflow-hidden border border-border"
              >
                <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-[#eef0f3]">
                  <Skeleton className="h-4 w-1/2 bg-gray-200" />
                  <Skeleton className="h-6 w-6 rounded-full bg-gray-200" />
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
        {visibleCount < allItems.length && !isLoadingMore && (
          <div ref={loadMoreRef} style={{ height: "20px", margin: "10px 0" }} />
        )}
        {displayedContent.length > 0 && visibleCount >= allItems.length && !isLoadingMore && (
          <div className="text-center py-4 text-gray-500 text-sm">All history content loaded.</div>
        )}
      </section>
      <Navbar />
    </main>
  )
}

export default HistoryPage
