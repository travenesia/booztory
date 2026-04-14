"use client"

import { HiClock, HiGift, HiCurrencyDollar } from "react-icons/hi2"

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
  const formatDonations = (amount: number) =>
    amount === 0 ? "0.00" : amount.toFixed(2)

  const formatTime = (minutes: number) => {
    if (isPlaceholder && username === "@Booztory") return "--:--"
    const mins = Math.floor(minutes)
    const secs = Math.floor((minutes - mins) * 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (isPlaceholder && username === "@Booztory") {
    return (
      <div className="h-8 w-full bg-[#E63946] flex items-center justify-between rounded-b-[5px]">
        <button
          className={`p-0 rounded-none rounded-bl-[5px] bg-[#c02030] hover:bg-[#a81a28] active:bg-[#8f1522] transition-colors h-8 w-8 flex items-center justify-center flex-shrink-0 ${
            !isConnected ? "opacity-50 cursor-not-allowed !bg-gray-500" : ""
          }`}
          onClick={onDonationClick}
          aria-label="Support @Booztory"
          disabled={!isConnected}
        >
          <HiGift size={16} className="text-white" />
        </button>

        <div className="flex items-center pr-2" title="USDC Donated">
          <HiCurrencyDollar size={16} className="text-white flex-shrink-0 mr-1" />
          <span className="text-xs font-medium text-white tabular-nums">
            {formatDonations(donations)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-8 w-full bg-[#E63946] flex items-center justify-between rounded-b-[5px]">
      <div className="flex items-center">
        <button
          className={`p-0 rounded-none rounded-bl-[5px] bg-[#c02030] hover:bg-[#a81a28] active:bg-[#8f1522] transition-colors h-8 w-8 flex items-center justify-center flex-shrink-0 ${
            !isConnected ? "opacity-50 cursor-not-allowed !bg-gray-500" : ""
          }`}
          onClick={onDonationClick}
          aria-label={`Support @${username}`}
          disabled={!isConnected}
        >
          <HiGift size={16} className="text-white" />
        </button>

        <span className="block max-w-[6rem] text-xs font-medium text-white truncate ml-1" title={`Submitted by ${username}`}>
          {username}
        </span>
      </div>

      <div className="flex items-center gap-2 pr-2">
        <div className="flex items-center" title="Time Left">
          <HiClock size={16} className="text-white flex-shrink-0 mr-1" />
          <span className="text-xs font-medium text-white tabular-nums">
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="flex items-center" title="USDC Donated">
          <HiCurrencyDollar size={16} className="text-white flex-shrink-0 mr-1" />
          <span className="text-xs font-medium text-white tabular-nums">
            {formatDonations(donations)}
          </span>
        </div>
      </div>
    </div>
  )
}
