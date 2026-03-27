import { Skeleton } from "@/components/ui/skeleton"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function Loading() {
  return (
    <main className="min-h-screen pt-12 pb-20">
      <PageTopbar title="Stats" />
      <Navbar />

      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full">
        {/* Hero skeleton */}
        <Skeleton className="h-[140px] w-full rounded-2xl bg-gray-200 mb-4" />
        {/* Tabs skeleton */}
        <Skeleton className="h-11 w-full rounded-xl bg-gray-200 mb-6" />
        {/* Section 1 */}
        <Skeleton className="h-4 w-24 rounded bg-gray-200 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4">
              <Skeleton className="h-8 w-20 rounded bg-gray-200 mb-1" />
              <Skeleton className="h-3 w-28 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        {/* Section 2 */}
        <Skeleton className="h-4 w-24 rounded bg-gray-200 mt-6 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4">
              <Skeleton className="h-8 w-20 rounded bg-gray-200 mb-1" />
              <Skeleton className="h-3 w-28 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        {/* Section 3 */}
        <Skeleton className="h-4 w-32 rounded bg-gray-200 mt-6 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4">
              <Skeleton className="h-8 w-20 rounded bg-gray-200 mb-1" />
              <Skeleton className="h-3 w-28 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
