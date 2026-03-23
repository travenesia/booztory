import { Skeleton } from "@/components/ui/skeleton"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function Loading() {
  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="FAQ" />
      <section className="py-6 px-6 h-[calc(100vh-96px)] overflow-y-auto max-w-[650px] mx-auto w-full">
        <div className="space-y-6">
          {/* Hero Section Skeleton */}
          <div className="text-center mb-4">
            <Skeleton className="h-6 w-48 mx-auto mb-3 bg-gray-100" />
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
              <Skeleton className="h-4 w-full mb-2 bg-gray-100" />
              <Skeleton className="h-4 w-5/6 mb-2 bg-gray-100" />
              <Skeleton className="h-4 w-4/5 bg-gray-100" />
            </div>
          </div>

          {/* FAQ Accordion Skeletons */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-0 rounded-lg border border-gray-300 ">
              <div className="py-4 px-4">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-6 w-6 bg-gray-100" />
                  <Skeleton className="h-5 w-64 bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <Navbar />
    </main>
  )
}
