import { Skeleton } from "@/components/ui/skeleton"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function Loading() {
  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="Rewards" />
      <section className="py-6 px-6 max-w-[650px] mx-auto w-full space-y-4">

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <Skeleton className="flex-1 h-9 rounded-lg bg-white shadow-sm" />
          <Skeleton className="flex-1 h-9 rounded-lg bg-gray-200 ml-1" />
        </div>

        {/* Raffle card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Prize pool header */}
          <div className="p-6 text-center border-b border-gray-100">
            <Skeleton className="h-4 w-24 mx-auto mb-3 bg-gray-100" />
            <Skeleton className="h-10 w-32 mx-auto mb-2 bg-gray-100" />
            <Skeleton className="h-4 w-28 mx-auto mb-4 bg-gray-100" />
            <div className="flex justify-center gap-2">
              <Skeleton className="w-6 h-6 rounded bg-gray-100" />
              <Skeleton className="w-6 h-6 rounded bg-gray-100" />
            </div>
          </div>
          {/* Requirements row */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <Skeleton className="h-4 w-32 bg-gray-100" />
            <Skeleton className="h-4 w-20 bg-gray-100" />
          </div>
          {/* Winner rows */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-2.5 border-b border-gray-50 flex items-center gap-3">
              <Skeleton className="w-6 h-4 rounded bg-gray-100" />
              <Skeleton className="flex-1 h-4 rounded bg-gray-100" />
              <Skeleton className="w-20 h-6 rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>

        {/* Convert points section */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-5 h-5 rounded bg-indigo-200" />
            <Skeleton className="h-4 w-36 bg-indigo-200" />
          </div>
          {/* Inline stats */}
          <div className="flex items-center bg-indigo-100/60 rounded-full px-3 py-1.5 mb-3 gap-3">
            <Skeleton className="flex-1 h-3 rounded bg-indigo-200" />
            <div className="w-px h-4 bg-indigo-200" />
            <Skeleton className="flex-1 h-3 rounded bg-indigo-200" />
            <div className="w-px h-4 bg-indigo-200" />
            <Skeleton className="flex-1 h-3 rounded bg-indigo-200" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="flex-1 h-9 rounded-lg bg-indigo-200" />
            <Skeleton className="w-24 h-9 rounded-lg bg-indigo-300" />
          </div>
        </div>

      </section>
      <Navbar />
    </main>
  )
}
