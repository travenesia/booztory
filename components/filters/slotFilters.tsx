"use client"

import { useState } from "react"
import { Drawer } from "vaul"
import { HiXMark, HiCheck, HiChevronDown } from "react-icons/hi2"
import { cn } from "@/lib/utils"
import type { ContentItem } from "@/lib/contract"

// ── Types ─────────────────────────────────────────────────────────────────────

// "all" removed — empty array means all
export type ContentTypeFilter = "youtube" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch" | "text"
export type DurationFilter = "1d" | "7d" | "30d" | "all"
export type SortFilter = "latest" | "earliest"

export interface SlotFilterState {
  contentType: ContentTypeFilter[]   // empty = all
  duration: DurationFilter
  sort: SortFilter
  you: boolean
}

export const DEFAULT_HISTORY_FILTERS: SlotFilterState = {
  contentType: [],
  duration: "1d",
  sort: "latest",
  you: false,
}

export const DEFAULT_UPCOMING_FILTERS: SlotFilterState = {
  contentType: [],
  duration: "1d",
  sort: "earliest",
  you: false,
}

export function isNonDefault(filters: SlotFilterState, defaults: SlotFilterState): boolean {
  return (
    filters.contentType.length !== defaults.contentType.length ||
    filters.duration !== defaults.duration ||
    filters.sort !== defaults.sort ||
    filters.you !== defaults.you
  )
}

// ── Filter logic ──────────────────────────────────────────────────────────────

// contentType stored on-chain: "youtube" | "youtubeshorts" | "tiktok" | "twitter" | "vimeo" | "spotify" | "twitch" | "text"
function normalizeContentType(ct: string): ContentTypeFilter | null {
  if (ct === "youtube" || ct === "youtubeshorts") return "youtube"
  if (ct === "tiktok") return "tiktok"
  if (ct === "twitter") return "twitter"
  if (ct === "vimeo") return "vimeo"
  if (ct === "spotify") return "spotify"
  if (ct === "twitch") return "twitch"
  if (ct === "text") return "text"
  return null
}

// scheduledTime and endTime are in milliseconds (parseSlot converts seconds → ms)
export function applySlotFilters(
  items: ContentItem[],
  filters: SlotFilterState,
  address: string | undefined,
  pageType: "history" | "upcoming"
): ContentItem[] {
  let result = [...items]

  if (filters.contentType.length > 0) {
    result = result.filter(i => {
      const norm = normalizeContentType(i.contentType)
      return norm !== null && filters.contentType.includes(norm)
    })
  }

  if (filters.duration !== "all") {
    const now = Date.now()
    const ms = filters.duration === "1d" ? 86_400_000 : filters.duration === "7d" ? 604_800_000 : 2_592_000_000
    if (pageType === "history") {
      result = result.filter(i => i.endTime >= now - ms)
    } else {
      result = result.filter(i => i.scheduledTime <= now + ms)
    }
  }

  if (filters.you && address) {
    result = result.filter(i => i.submittedBy.toLowerCase() === address.toLowerCase())
  }

  if (pageType === "history") {
    result.sort((a, b) => filters.sort === "latest" ? b.endTime - a.endTime : a.endTime - b.endTime)
  } else {
    result.sort((a, b) => filters.sort === "earliest" ? a.scheduledTime - b.scheduledTime : b.scheduledTime - a.scheduledTime)
  }

  return result
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTENT_TYPES: { value: ContentTypeFilter; label: string }[] = [
  { value: "youtube", label: "YouTube"     },
  { value: "tiktok",  label: "TikTok"      },
  { value: "twitter", label: "X / Twitter" },
  { value: "vimeo",   label: "Vimeo"       },
  { value: "spotify", label: "Spotify"     },
  { value: "twitch",  label: "Twitch"      },
  { value: "text",    label: "Text"        },
]

const DURATIONS: { value: DurationFilter; label: string }[] = [
  { value: "1d",  label: "1D"  },
  { value: "7d",  label: "7D"  },
  { value: "30d", label: "30D" },
  { value: "all", label: "All" },
]

// ── Filter panel content (shared between desktop + mobile) ────────────────────

interface FilterPanelContentProps {
  filters: SlotFilterState
  onChange: (f: SlotFilterState) => void
  showYou: boolean
  isMobile?: boolean
  onApply?: () => void
  onReset?: () => void
}

function FilterPanelContent({ filters, onChange, showYou, isMobile, onApply, onReset }: FilterPanelContentProps) {
  const [typeOpen, setTypeOpen] = useState(false)

  const set = <K extends keyof SlotFilterState>(key: K, value: SlotFilterState[K]) =>
    onChange({ ...filters, [key]: value })

  const toggleType = (value: ContentTypeFilter) => {
    const current = filters.contentType
    set("contentType", current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    )
  }

  const typeLabel =
    filters.contentType.length === 0 ? "All"
    : filters.contentType.length === 1 ? CONTENT_TYPES.find(ct => ct.value === filters.contentType[0])?.label ?? "1 selected"
    : `${filters.contentType.length} selected`

  return (
    <div className="flex flex-col gap-5">

      {/* Content Type — dropdown trigger + checklist */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Content Type</p>
        <button
          onClick={() => setTypeOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 rounded-xl text-sm font-semibold transition-colors hover:bg-gray-200"
        >
          <span className={filters.contentType.length === 0 ? "text-gray-400" : "text-gray-900"}>
            {typeLabel}
          </span>
          <HiChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-150", typeOpen && "rotate-180")} />
        </button>

        {typeOpen && (
          <div className="bg-gray-100 rounded-xl p-1 flex flex-col gap-0.5 mt-1">
            {CONTENT_TYPES.map(ct => {
              const checked = filters.contentType.includes(ct.value)
              return (
                <button
                  key={ct.value}
                  onClick={() => toggleType(ct.value)}
                  className={cn(
                    "flex items-center justify-between text-sm px-3 py-2 rounded-lg font-semibold transition-all",
                    checked ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {ct.label}
                  {checked && <HiCheck className="w-4 h-4 text-gray-900 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Duration — leaderboard period style */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Duration</p>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0">
          {DURATIONS.map(d => (
            <button
              key={d.value}
              onClick={() => set("duration", d.value)}
              className={cn(
                "flex-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                filters.duration === d.value
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort — leaderboard period style */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Sort</p>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0">
          {(["latest", "earliest"] as SortFilter[]).map(s => (
            <button
              key={s}
              onClick={() => set("sort", s)}
              className={cn(
                "flex-1 px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all",
                filters.sort === s
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* You Only */}
      {showYou && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Your content only</p>
          <button
            onClick={() => set("you", !filters.you)}
            className={cn(
              "relative w-10 h-6 rounded-full transition-colors p-0 overflow-hidden shrink-0",
              filters.you ? "bg-blue-500" : "bg-gray-200"
            )}
          >
            <span className={cn(
              "absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
              filters.you ? "translate-x-4" : "translate-x-0"
            )} />
          </button>
        </div>
      )}

      {/* Mobile Apply / Reset */}
      {isMobile && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={onReset}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onApply}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

// ── Desktop floating panel ────────────────────────────────────────────────────

interface DesktopFilterPanelProps {
  filters: SlotFilterState
  onChange: (f: SlotFilterState) => void
  showYou: boolean
}

export function DesktopFilterPanel({ filters, onChange, showYou }: DesktopFilterPanelProps) {
  return (
    <div
      className="hidden xl:block fixed z-30 w-[250px] top-[72px]"
      style={{ right: "calc(50% + 325px)" }}
    >
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-bold text-gray-900 mb-4">Filters</p>
        <FilterPanelContent filters={filters} onChange={onChange} showYou={showYou} />
      </div>
    </div>
  )
}

// ── Mobile Vaul drawer ────────────────────────────────────────────────────────

interface MobileFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: SlotFilterState
  onDraftChange: (f: SlotFilterState) => void
  onApply: () => void
  onReset: () => void
  showYou: boolean
}

export function MobileFilterDrawer({
  open, onOpenChange, draft, onDraftChange, onApply, onReset, showYou,
}: MobileFilterDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
            <Drawer.Title className="text-base font-bold text-gray-900">Filters</Drawer.Title>
            <button onClick={() => onOpenChange(false)} className="p-0 text-gray-400 hover:text-gray-700">
              <HiXMark size={20} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-5 py-4">
            <FilterPanelContent
              filters={draft}
              onChange={onDraftChange}
              showYou={showYou}
              isMobile
              onApply={onApply}
              onReset={onReset}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
