"use client"

import { Clock, Gift, DollarCircle } from "iconoir-react"
import { formatStatNumber } from "@/components/tweet/utils"

interface ContentStatsProps {
  timeLeft: number // in minutes
  donations: number
  username: string
  isPlaceholder?: boolean
  onDonationClick: () => void
  isConnected: boolean
}

export function ContentStats({
  timeLeft,
  donations,
  username,
  isPlaceholder = false,
  onDonationClick,
  isConnected,
}: ContentStatsProps) {
  const formatTime = (minutes: number) => {
    if (isPlaceholder && username === "Booztory") return "--:--"
    const mins = Math.floor(minutes)
    const secs = Math.floor((minutes - mins) * 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (isPlaceholder && username === "Booztory") {
    return (
      <div className="h-8 w-full bg-[#cc0000] flex items-center rounded-b-[5px]">
        <button
          className={`p-0 rounded-none rounded-bl-[5px] bg-red-700 hover:bg-red-800 active:bg-red-900 transition-colors h-8 w-8 flex items-center justify-center mr-2 flex-shrink-0 ${
            !isConnected ? "opacity-50 cursor-not-allowed !bg-gray-500" : ""
          }`}
          onClick={onDonationClick}
          aria-label="Support this App"
          disabled={!isConnected}
        >
          <Gift width={16} height={16} className="text-white" />
        </button>

        <div className="flex items-center" title="USDC Donated">
          <DollarCircle width={16} height={16} className="text-white flex-shrink-0 mr-1" />
          <span className="block min-w-[3.5rem] sm:min-w-[4rem] text-xs font-medium text-white text-left tabular-nums">
            {formatStatNumber(donations)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-8 w-full bg-[#cc0000] flex items-center rounded-b-[5px]">
      <button
        className={`p-0 rounded-none rounded-bl-[5px] bg-red-700 hover:bg-red-800 active:bg-red-900 transition-colors h-8 w-8 flex items-center justify-center mr-2 flex-shrink-0 ${
          !isConnected ? "opacity-50 cursor-not-allowed !bg-gray-500" : ""
        }`}
        onClick={onDonationClick}
        aria-label={`Support @${username}`}
        disabled={!isConnected}
      >
        <Gift width={16} height={16} className="text-white" />
      </button>

      <div className="flex items-center" title={`Submitted by ${username}`}>
        <span className="block max-w-[6rem] text-xs font-medium text-white truncate">
          {username}
        </span>
      </div>

      <div className="flex items-center h-full ml-auto space-x-3 sm:space-x-4 pr-1 sm:pr-2">
        <div className="flex items-center" title="Time Left">
          <Clock width={16} height={16} className="text-white flex-shrink-0 mr-1" />
          <span className="block min-w-[3rem] text-xs font-medium text-white text-left tabular-nums">
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="flex items-center" title="USDC Donated">
          <DollarCircle width={16} height={16} className="text-white flex-shrink-0 mr-1" />
          <span className="block min-w-[3.5rem] sm:min-w-[4rem] text-xs font-medium text-white text-left tabular-nums">
            {formatStatNumber(donations)}
          </span>
        </div>
      </div>
    </div>
  )
}
