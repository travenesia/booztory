import { Skeleton } from "@/components/ui/skeleton"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function Loading() {
  return (
    <main className="min-h-screen pt-12 pb-20">
      <PageTopbar title="Stats" />
      <Navbar />

      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full">
        {/* Header skeleton */}
        <div className="mb-2">
          <Skeleton className="h-7 w-32 rounded-lg bg-gray-200" />
          <Skeleton className="h-4 w-56 rounded-lg bg-gray-200 mt-2" />
        </div>

        {/* Section 1 */}
        <Skeleton className="h-4 w-24 rounded bg-gray-200 mt-6 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4">
              <Skeleton className="h-16 w-full rounded bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Section 2 */}
        <Skeleton className="h-4 w-24 rounded bg-gray-200 mt-6 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4">
              <Skeleton className="h-16 w-full rounded bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Section 3 */}
        <Skeleton className="h-4 w-32 rounded bg-gray-200 mt-6 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4">
              <Skeleton className="h-16 w-full rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
