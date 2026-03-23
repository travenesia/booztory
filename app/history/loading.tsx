import { Skeleton } from "@/components/ui/skeleton"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function Loading() {
  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="History" />
      <section className="py-6 px-6 h-[calc(100vh-96px)] overflow-y-auto max-w-[650px] mx-auto w-full space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-0 rounded-lg  overflow-hidden border border-border">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-[#eef0f3]">
              <Skeleton className="h-4 w-1/2 bg-gray-200" />
              <Skeleton className="h-6 w-6 rounded-full bg-gray-200" />
            </div>
            <div className="flex p-3">
              <div className="relative w-1/3 mr-3">
                <Skeleton className="aspect-video w-full rounded-md bg-elegance-ethereal-ivory" />
              </div>
              <div className="w-2/3 space-y-2">
                <Skeleton className="h-4 w-full bg-elegance-ethereal-ivory" />
                <Skeleton className="h-4 w-3/4 bg-elegance-ethereal-ivory" />
              </div>
            </div>
            <div className="p-3 border-t border-border bg-gray-0">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-1/4 bg-elegance-ethereal-ivory" />
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-5 w-10 bg-elegance-ethereal-ivory" />
                  <Skeleton className="h-5 w-10 bg-elegance-ethereal-ivory" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
      <Navbar />
    </main>
  )
}
