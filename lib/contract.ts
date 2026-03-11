// ─── Deployed contract address ───────────────────────────────────────────────
// Set NEXT_PUBLIC_BOOZTORY_ADDRESS in .env.local after deployment
export const BOOZTORY_ADDRESS = (process.env.NEXT_PUBLIC_BOOZTORY_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`

// Payment token address — override via NEXT_PUBLIC_USDC_ADDRESS for testnet
// Base mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
// Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`

// ─── Slot struct components (reused across multiple ABI entries) ──────────────
const SLOT_COMPONENTS = [
  { internalType: "string",  name: "contentUrl",    type: "string"  },
  { internalType: "string",  name: "contentType",   type: "string"  },
  { internalType: "string",  name: "aspectRatio",   type: "string"  },
  { internalType: "string",  name: "title",         type: "string"  },
  { internalType: "string",  name: "authorName",    type: "string"  },
  { internalType: "string",  name: "imageUrl",      type: "string"  },
  { internalType: "uint256", name: "scheduledTime", type: "uint256" },
  { internalType: "uint256", name: "endTime",       type: "uint256" },
  { internalType: "address", name: "creator",       type: "address" },
  { internalType: "uint256", name: "donations",     type: "uint256" },
] as const

// ─── ABI ─────────────────────────────────────────────────────────────────────
export const BOOZTORY_ABI = [
  // Constructor
  { inputs: [{ internalType: "address", name: "_paymentToken", type: "address" }], stateMutability: "nonpayable", type: "constructor" },

  // Errors (OZ v5)
  { inputs: [{ internalType: "address", name: "sender", type: "address" }, { internalType: "uint256", name: "tokenId", type: "uint256" }, { internalType: "address", name: "owner", type: "address" }], name: "ERC721IncorrectOwner", type: "error" },
  { inputs: [{ internalType: "address", name: "operator", type: "address" }, { internalType: "uint256", name: "tokenId", type: "uint256" }], name: "ERC721InsufficientApproval", type: "error" },
  { inputs: [{ internalType: "address", name: "approver", type: "address" }], name: "ERC721InvalidApprover", type: "error" },
  { inputs: [{ internalType: "address", name: "operator", type: "address" }], name: "ERC721InvalidOperator", type: "error" },
  { inputs: [{ internalType: "address", name: "owner", type: "address" }], name: "ERC721InvalidOwner", type: "error" },
  { inputs: [{ internalType: "address", name: "receiver", type: "address" }], name: "ERC721InvalidReceiver", type: "error" },
  { inputs: [{ internalType: "address", name: "sender", type: "address" }], name: "ERC721InvalidSender", type: "error" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }], name: "ERC721NonexistentToken", type: "error" },
  { inputs: [{ internalType: "address", name: "owner", type: "address" }], name: "OwnableInvalidOwner", type: "error" },
  { inputs: [{ internalType: "address", name: "account", type: "address" }], name: "OwnableUnauthorizedAccount", type: "error" },
  { inputs: [], name: "ReentrancyGuardReentrantCall", type: "error" },

  // Events
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "owner", type: "address" }, { indexed: true, internalType: "address", name: "approved", type: "address" }, { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" }], name: "Approval", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "owner", type: "address" }, { indexed: true, internalType: "address", name: "operator", type: "address" }, { indexed: false, internalType: "bool", name: "approved", type: "bool" }], name: "ApprovalForAll", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" }, { indexed: true, internalType: "address", name: "donor", type: "address" }, { indexed: false, internalType: "uint256", name: "creatorAmount", type: "uint256" }, { indexed: false, internalType: "uint256", name: "feeAmount", type: "uint256" }], name: "DonationReceived", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newBps", type: "uint256" }], name: "DonationFeeBpsChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "previousOwner", type: "address" }, { indexed: true, internalType: "address", name: "newOwner", type: "address" }], name: "OwnershipTransferred", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "newToken", type: "address" }, { indexed: false, internalType: "uint256", name: "newPrice", type: "uint256" }], name: "PaymentTokenChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newDuration", type: "uint256" }], name: "SlotDurationChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" }, { indexed: true, internalType: "address", name: "creator", type: "address" }, { indexed: false, internalType: "uint256", name: "scheduledTime", type: "uint256" }, { indexed: false, internalType: "uint256", name: "endTime", type: "uint256" }], name: "SlotMinted", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newPrice", type: "uint256" }], name: "SlotPriceChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "from", type: "address" }, { indexed: true, internalType: "address", name: "to", type: "address" }, { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" }], name: "Transfer", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "token", type: "address" }, { indexed: true, internalType: "address", name: "to", type: "address" }, { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }], name: "Withdrawn", type: "event" },

  // ERC-721 standard
  { inputs: [{ internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "tokenId", type: "uint256" }], name: "approve", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "owner", type: "address" }], name: "balanceOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }], name: "getApproved", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "owner", type: "address" }, { internalType: "address", name: "operator", type: "address" }], name: "isApprovedForAll", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "name", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }], name: "ownerOf", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "from", type: "address" }, { internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "tokenId", type: "uint256" }], name: "safeTransferFrom", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "from", type: "address" }, { internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "tokenId", type: "uint256" }, { internalType: "bytes", name: "data", type: "bytes" }], name: "safeTransferFrom", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "operator", type: "address" }, { internalType: "bool", name: "approved", type: "bool" }], name: "setApprovalForAll", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }], name: "supportsInterface", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }], name: "tokenURI", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "from", type: "address" }, { internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "tokenId", type: "uint256" }], name: "transferFrom", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Ownable
  { inputs: [], name: "owner", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "renounceOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "newOwner", type: "address" }], name: "transferOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },

  // State variables
  { inputs: [], name: "paymentToken", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "slotPrice", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "slotDuration", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "donationFeeBps", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nextTokenId", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "queueEndTime", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "slots", outputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }, { internalType: "uint256", name: "scheduledTime", type: "uint256" }, { internalType: "uint256", name: "endTime", type: "uint256" }, { internalType: "address", name: "creator", type: "address" }, { internalType: "uint256", name: "donations", type: "uint256" }], stateMutability: "view", type: "function" },

  // Core write functions
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlot", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "donate", outputs: [], stateMutability: "payable", type: "function" },

  // Read functions
  { inputs: [], name: "getCurrentSlot", outputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }, { components: SLOT_COMPONENTS, internalType: "struct Booztory.Slot", name: "slot", type: "tuple" }, { internalType: "bool", name: "found", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "offset", type: "uint256" }, { internalType: "uint256", name: "limit", type: "uint256" }], name: "getPastSlots", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct Booztory.Slot[]", name: "slotData", type: "tuple[]" }, { internalType: "uint256", name: "total", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }], name: "getSlotStatus", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "creator", type: "address" }], name: "getSlotsByCreator", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct Booztory.Slot[]", name: "slotData", type: "tuple[]" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getUpcomingSlots", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct Booztory.Slot[]", name: "slotData", type: "tuple[]" }], stateMutability: "view", type: "function" },

  // Admin (owner only)
  { inputs: [{ internalType: "uint256", name: "_price", type: "uint256" }], name: "setSlotPrice", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_duration", type: "uint256" }], name: "setSlotDuration", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_token", type: "address" }, { internalType: "uint256", name: "_price", type: "uint256" }], name: "setPaymentToken", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_bps", type: "uint256" }], name: "setDonationFeeBps", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "withdraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "token", type: "address" }], name: "withdrawToken", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const

// ERC-20 minimal ABI (approve + transfer)
export const ERC20_ABI = [
  { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { name: "transfer", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { name: "allowance", type: "function", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnChainSlot = {
  contentUrl: string
  contentType: string
  aspectRatio: string
  title: string
  authorName: string
  imageUrl: string
  scheduledTime: bigint
  endTime: bigint
  creator: `0x${string}`
  donations: bigint
}

export type ContentItem = {
  id: string
  username: string
  submittedBy: string
  contentType: "youtube" | "tiktok" | "twitter" | "vimeo" | "spotify"
  contentUrl: string
  imageUrl: string
  scheduledTime: number
  endTime: number
  donations: number
  aspectRatio: "16:9" | "9:16"
  status: "queue" | "live" | "done"
  title?: string
  authorName?: string
  isPlaceholder?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derives the slot status from current time vs on-chain timestamps.
 * Matches the Solidity logic exactly.
 */
function deriveStatus(scheduledTime: number, endTime: number): "queue" | "live" | "done" {
  const now = Math.floor(Date.now() / 1000)
  if (now < scheduledTime) return "queue"
  if (now <= endTime) return "live"
  return "done"
}

/**
 * Convert a raw on-chain Slot tuple + tokenId to the ContentItem shape
 * used by all components.
 */
export function parseSlot(tokenId: bigint, slot: OnChainSlot): ContentItem {
  const scheduledTime = Number(slot.scheduledTime)
  const endTime = Number(slot.endTime)
  const addr = slot.creator.toLowerCase()
  const displayName = `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return {
    id: tokenId.toString(),
    username: displayName,
    submittedBy: slot.creator,
    contentType: slot.contentType as ContentItem["contentType"],
    contentUrl: slot.contentUrl,
    imageUrl: slot.imageUrl,
    scheduledTime: scheduledTime * 1000,  // convert to ms for frontend consistency
    endTime: endTime * 1000,
    donations: Number(slot.donations) / 1_000_000,  // convert from 6-decimal to USDC
    aspectRatio: (slot.aspectRatio as "16:9" | "9:16") || "16:9",
    status: deriveStatus(scheduledTime, endTime),
    title: slot.title || undefined,
    authorName: slot.authorName || undefined,
    isPlaceholder: false,
  }
}

/** Returns fresh placeholder content shown when no slot is live */
export function getPlaceholderContent(): ContentItem {
  const now = Date.now()
  return {
    id: "placeholder",
    username: "@Booztory",
    submittedBy: BOOZTORY_ADDRESS,
    contentType: "youtube",
    contentUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    imageUrl: "/placeholder.svg?height=180&width=320&text=No+Content",
    scheduledTime: now,
    endTime: now + 15 * 60 * 1000,
    donations: 0,
    aspectRatio: "16:9",
    status: "live",
    title: "Submit your content to be featured!",
    authorName: "@Booztory",
    isPlaceholder: true,
  }
}
