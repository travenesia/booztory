import { Skeleton } from "@/components/ui/skeleton"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function Loading() {
  return (
    <main className="min-h-screen pt-12">
      <PageTopbar title="Profile" />

      <section className="pt-4 pb-[80px] md:pb-[56px] px-4 max-w-[650px] mx-auto w-full">

        {/* Profile hero card skeleton */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          {/* Header gradient strip */}
          <div className="h-16 w-full bg-gradient-to-r from-blue-50 to-pink-50" />

          {/* Avatar + info */}
          <div className="px-4 pb-4 -mt-8">
            <div className="mb-3">
              <Skeleton className="w-16 h-16 rounded-full border-4 border-white bg-gray-200" />
            </div>
            <Skeleton className="h-5 w-32 mb-1.5 bg-gray-100" />
            <Skeleton className="h-3.5 w-24 bg-gray-100" />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 border-t border-gray-100">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex flex-col items-center py-3 ${i < 3 ? "border-r border-gray-100" : ""}`}>
                <Skeleton className="h-5 w-10 mb-1 bg-gray-100" />
                <Skeleton className="h-3 w-12 bg-gray-100" />
              </div>
            ))}
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="bg-gray-100 rounded-xl p-1 flex gap-1 mb-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`flex-1 py-2 rounded-lg ${i === 0 ? "bg-white shadow-sm" : ""}`}>
              <Skeleton className="h-4 w-16 mx-auto bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Tx list skeleton */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24 bg-gray-100" />
                  <Skeleton className="h-3 w-36 bg-gray-100" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-4 w-16 bg-gray-100" />
                  <Skeleton className="h-3 w-10 bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Navbar />
    </main>
  )
}
