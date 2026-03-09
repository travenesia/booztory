export const truncate = (str: string | null, length: number) => {
  if (!str || str.length <= length) return str
  return `${str.slice(0, length - 3)}...`
}

export function nFormatter(num?: number, digits?: number) {
  if (!num) return "0"
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "K" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "G" },
    { value: 1e12, symbol: "T" },
    { value: 1e15, symbol: "P" },
    { value: 1e18, symbol: "E" },
  ]
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/
  var item = lookup
    .slice()
    .reverse()
    .find((item) => num >= item.value)
  return item ? (num / item.value).toFixed(digits || 1).replace(rx, "$1") + item.symbol : "0"
}

export const truncateWords = (str: string | null, limit: number): string => {
  if (!str) return ""
  const words = str.split(/\s+/).filter(Boolean) // Split by any whitespace and remove empty strings
  if (words.length <= limit) {
    return str
  }
  return words.slice(0, limit).join(" ") + "..."
}

// New function for formatting stat numbers
export function formatStatNumber(num: number): string {
  if (num < 1000) {
    return num.toString()
  } else if (num < 1000000) {
    const thousands = num / 1000
    // Round to one decimal place. If it's a whole number (e.g., 5.0K), display as 5K.
    const formatted = thousands.toFixed(1)
    return Number.parseFloat(formatted) % 1 === 0 ? `${Math.floor(thousands)}K` : `${formatted}K`
  } else {
    const millions = num / 1000000
    // Round to one decimal place. If it's a whole number (e.g., 2.0M), display as 2M.
    const formatted = millions.toFixed(1)
    return Number.parseFloat(formatted) % 1 === 0 ? `${Math.floor(millions)}M` : `${formatted}M`
  }
}
