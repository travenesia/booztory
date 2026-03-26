"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Navbar } from "@/components/layout/navbar"
import { HistoryCard } from "@/components/content/historyCard"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllPastSlots } from "@/hooks/useContractContent"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { ScrollToTopButton } from "@/components/layout/scrollToTopButton"
import { useAccount } from "wagmi"

const ITEMS_PER_PAGE = 5

function HistoryPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { items: allItems, isLoading, isFetchingMore, fetchMore, hasMore } = useAllPastSlots()
  const { address } = useAccount()
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [slideIndex, setSlideIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const isPausedRef = useRef(false)

  const ownItems = address
    ? allItems.filter(i => i.submittedBy.toLowerCase() === address.toLowerCase())
    : []
  const otherItems = address
    ? allItems.filter(i => i.submittedBy.toLowerCase() !== address.toLowerCase())
    : allItems

  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const displayedContent = otherItems.slice(0, visibleCount)

  const scrollToSlide = useCallback((i: number) => {
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: i * carouselRef.current.clientWidth, behavior: "smooth" })
    }
    setSlideIndex(i)
  }, [])

  const handleCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return
    const { scrollLeft, clientWidth } = carouselRef.current
    setSlideIndex(Math.round(scrollLeft / clientWidth))
  }, [])

  useEffect(() => {
    if (ownItems.length <= 1) return
    const interval = setInterval(() => {
      if (isPausedRef.current) return
      setSlideIndex(prev => {
        const next = (prev + 1) % ownItems.length
        if (carouselRef.current) {
          carouselRef.current.scrollTo({ left: next * carouselRef.current.clientWidth, behavior: "smooth" })
        }
        return next
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [ownItems.length])

  const loadMoreItems = useCallback(async () => {
    if (isLoadingMore || isFetchingMore) return
    setIsLoadingMore(true)

    if (visibleCount < otherItems.length) {
      setTimeout(() => {
        setVisibleCount((c) => Math.min(c + ITEMS_PER_PAGE, otherItems.length))
        setIsLoadingMore(false)
      }, 300)
    } else if (hasMore) {
      await fetchMore()
      setVisibleCount((c) => c + ITEMS_PER_PAGE)
      setIsLoadingMore(false)
    } else {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, isFetchingMore, visibleCount, otherItems.length, hasMore, fetchMore])

  const showLoadMoreTrigger = visibleCount < otherItems.length || hasMore

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

  if (!mounted || (isLoading && allItems.length === 0)) {
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
      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full">
        {allItems.length === 0 && !isLoadingMore && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <span className="text-4xl mb-4">🗂️</span>
            <p className="text-base font-bold text-gray-800 mb-1">No history yet</p>
            <p className="text-sm text-gray-500">Past featured content will show up here once slots have ended.</p>
          </div>
        ) : (
          <div className="space-y-0">

            {/* ── Own content carousel ── */}
            {ownItems.length > 0 && (
              <div
                className="relative"
                onMouseEnter={() => { isPausedRef.current = true }}
                onMouseLeave={() => { isPausedRef.current = false }}
                onTouchStart={() => { isPausedRef.current = true }}
                onTouchEnd={() => { isPausedRef.current = false }}
              >
                <div className="overflow-hidden rounded-lg">
                  <div
                    ref={carouselRef}
                    onScroll={handleCarouselScroll}
                    className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {ownItems.map((content, i) => (
                      <div
                        key={content.id}
                        ref={el => { slideRefs.current[i] = el }}
                        className="snap-start flex-shrink-0 w-full"
                      >
                        <HistoryCard content={content} isOwn />
                      </div>
                    ))}
                  </div>
                </div>
                {ownItems.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-2 mb-2">
                    {ownItems.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => scrollToSlide(i)}
                        className={`p-0 h-1 rounded-full transition-all cursor-pointer ${i === slideIndex ? "w-6 bg-gray-500" : "w-3 bg-gray-300"}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {ownItems.length > 0 && otherItems.length > 0 && (
              <div className="border-t border-gray-200 mt-2" />
            )}

            {/* ── Other users' content list ── */}
            {otherItems.length > 0 && (
              <div className="space-y-4 mt-2">
                {displayedContent.map((content, index) => (
                  <div
                    key={content.id + "-" + index}
                    className="animate-fadeIn"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <HistoryCard content={content} isOwn={false} />
                  </div>
                ))}
              </div>
            )}

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
