import { Skeleton } from "@/components/ui/skeleton"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function Loading() {
  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="Sponsor" />
      <section className="py-6 px-6 max-w-[650px] mx-auto w-full space-y-4">

        {/* Hero card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <Skeleton className="h-6 w-48 mb-2 bg-gray-100" />
          <Skeleton className="h-4 w-full mb-1.5 bg-gray-100" />
          <Skeleton className="h-4 w-4/5 mb-4 bg-gray-100" />
          <Skeleton className="h-9 w-32 rounded-lg bg-gray-200" />
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <Skeleton className="flex-1 h-9 rounded-lg bg-white shadow-sm" />
          <Skeleton className="flex-1 h-9 rounded-lg bg-gray-200" />
          <Skeleton className="flex-1 h-9 rounded-lg bg-gray-200" />
        </div>

        {/* Ad schedule cards */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Row 1: status + prize */}
            <div className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-5 w-20 rounded-full bg-gray-100" />
              <Skeleton className="h-4 w-24 bg-gray-100" />
            </div>
            <div className="border-t border-gray-100" />
            {/* Row 2: name + date */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <Skeleton className="h-4 w-32 bg-gray-100" />
              <Skeleton className="h-4 w-28 bg-gray-100" />
            </div>
            {/* Row 3: ad type + social icons */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <Skeleton className="h-4 w-24 bg-gray-100" />
              <div className="flex gap-2">
                <Skeleton className="w-6 h-6 rounded bg-gray-100" />
                <Skeleton className="w-6 h-6 rounded bg-gray-100" />
              </div>
            </div>
          </div>
        ))}

      </section>
      <Navbar />
    </main>
  )
}
