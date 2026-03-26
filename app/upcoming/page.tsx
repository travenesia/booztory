"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Navbar } from "@/components/layout/navbar"
import { UpcomingCard } from "@/components/content/upcomingCard"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Skeleton } from "@/components/ui/skeleton"
import { useUpcomingSlots } from "@/hooks/useContractContent"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { useAccount } from "wagmi"

const ITEMS_PER_PAGE = 5

export default function UpcomingPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { items: allItems, isLoading } = useUpcomingSlots()
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

  const loadMoreItems = useCallback(() => {
    setIsLoadingMore(true)
    setTimeout(() => {
      setVisibleCount((c) => Math.min(c + ITEMS_PER_PAGE, sortedItems.length))
      setIsLoadingMore(false)
    }, 500)
  }, [sortedItems.length])

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && visibleCount < sortedItems.length) {
          loadMoreItems()
        }
      },
      { threshold: 0.8 },
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => {
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [isLoadingMore, loadMoreItems, visibleCount, sortedItems.length])

  if (!mounted || (isLoading && sortedItems.length === 0)) {
    return (
      <main className="min-h-screen pt-12 pb-12">
        <PageTopbar title="Upcoming" />
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
      <PageTopbar title="Upcoming" />
      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full">
        {sortedItems.length === 0 && !isLoadingMore && !isLoading ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-2">No upcoming content scheduled</div>
            <p className="text-gray-400 text-sm">Content will appear here when users submit new posts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedContent.map((content, index) => (
              <div
                key={content.id + "-" + index}
                className="animate-fadeIn"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <UpcomingCard content={content} isOwn={!!address && content.submittedBy.toLowerCase() === address.toLowerCase()} />
              </div>
            ))}
          </div>
        )}
        {isLoadingMore && (
          <div className="space-y-4 mt-4">
            {[...Array(2)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
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
        {visibleCount < sortedItems.length && !isLoadingMore && (
          <div ref={loadMoreRef} style={{ height: "20px", margin: "10px 0" }} />
        )}
        {displayedContent.length > 0 && visibleCount >= sortedItems.length && !isLoadingMore && (
          <div className="text-center py-4 text-gray-500 text-sm">All upcoming content loaded.</div>
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
