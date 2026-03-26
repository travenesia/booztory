import { Skeleton } from "@/components/ui/skeleton"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function Loading() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Backgrounds */}
      <div className="block md:hidden fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/nightsky.webp')" }} />
      <div className="hidden md:block fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/nightskyxl.jpg')" }} />

      <PageTopbar title="Leaderboard" mobileTransparent />
      <Navbar />

      <div className="flex flex-col pt-14 pb-[72px] md:pb-6 flex-1 min-h-0">

        {/* Podium skeleton */}
        <div className="mx-4 md:mx-6">
          <div className="flex items-end justify-center px-4 pt-4 pb-5 gap-3 md:gap-4">
            {/* 2nd place */}
            <div className="flex-1 flex flex-col items-center" style={{ maxWidth: 114 }}>
              <div className="h-8" />
              <div className="w-full rounded-[9999px_9999px_40px_40px] pb-8" style={{ paddingTop: "calc(100% + 14px)", background: "rgba(15,23,42,0.5)" }} />
            </div>
            {/* 1st place */}
            <div className="flex-1 flex flex-col items-center" style={{ maxWidth: 140 }}>
              <Skeleton className="h-7 w-7 rounded-full mx-auto mb-1.5 bg-white/20" />
              <div className="w-full rounded-[9999px_9999px_40px_40px] pb-14" style={{ paddingTop: "calc(100% + 14px)", background: "rgba(15,23,42,0.5)" }} />
            </div>
            {/* 3rd place */}
            <div className="flex-1 flex flex-col items-center" style={{ maxWidth: 114 }}>
              <div className="h-8" />
              <div className="w-full rounded-[9999px_9999px_40px_40px] pb-8" style={{ paddingTop: "calc(100% + 14px)", background: "rgba(15,23,42,0.5)" }} />
            </div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="px-4 overflow-hidden">
          <div className="flex gap-1.5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex-1 h-10 rounded-[5px]"
                style={{ background: "rgba(15,23,42,0.5)" }}
              />
            ))}
          </div>
        </div>

        {/* Rows skeleton */}
        <div className="flex-1 overflow-hidden mt-0">
          <div className="px-4 pb-[80px] md:pb-[56px] mt-4 space-y-1.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/10">
                <Skeleton className="w-9 h-5 rounded bg-white/20" />
                <Skeleton className="w-8 h-8 rounded-full bg-white/20" />
                <Skeleton className="flex-1 h-4 rounded bg-white/20" />
                <Skeleton className="w-16 h-4 rounded bg-white/20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
