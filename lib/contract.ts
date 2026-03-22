// ─── Deployed contract address ───────────────────────────────────────────────
// Set NEXT_PUBLIC_BOOZTORY_ADDRESS in .env.local after deployment
export const BOOZTORY_ADDRESS = (process.env.NEXT_PUBLIC_BOOZTORY_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`

// Payment token address — override via NEXT_PUBLIC_USDC_ADDRESS for testnet
// Base mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
// Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`

// BOOZ reward token address — set via NEXT_PUBLIC_TOKEN_ADDRESS after deployment
export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`

// BooztoryRaffle contract address — set via NEXT_PUBLIC_RAFFLE_ADDRESS after deployment
export const RAFFLE_ADDRESS = (process.env.NEXT_PUBLIC_RAFFLE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`

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
  { inputs: [], name: "QueueFull", type: "error" },

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
  { inputs: [], name: "maxQueueSize", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getQueueSize", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "slots", outputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }, { internalType: "uint256", name: "scheduledTime", type: "uint256" }, { internalType: "uint256", name: "endTime", type: "uint256" }, { internalType: "address", name: "creator", type: "address" }, { internalType: "uint256", name: "donations", type: "uint256" }], stateMutability: "view", type: "function" },

  // Core write functions
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlot", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlotWithDiscount", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlotWithTokens", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "donate", outputs: [], stateMutability: "payable", type: "function" },

  // Burn-path config reads
  { inputs: [], name: "discountBurnCost", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "freeSlotCost", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "discountAmount", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "rewardToken", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },

  // Read functions
  { inputs: [], name: "getCurrentSlot", outputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }, { components: SLOT_COMPONENTS, internalType: "struct Booztory.Slot", name: "slot", type: "tuple" }, { internalType: "bool", name: "found", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "offset", type: "uint256" }, { internalType: "uint256", name: "limit", type: "uint256" }], name: "getPastSlots", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct Booztory.Slot[]", name: "slotData", type: "tuple[]" }, { internalType: "uint256", name: "total", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }], name: "getSlotStatus", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "creator", type: "address" }], name: "getSlotsByCreator", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct Booztory.Slot[]", name: "slotData", type: "tuple[]" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getUpcomingSlots", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct Booztory.Slot[]", name: "slotData", type: "tuple[]" }], stateMutability: "view", type: "function" },

  // GM Streak
  { inputs: [{ internalType: "address", name: "account", type: "address" }], name: "gmStreaks", outputs: [{ internalType: "uint256", name: "lastClaimDay", type: "uint256" }, { internalType: "uint16", name: "streakCount", type: "uint16" }, { internalType: "uint8", name: "claimedMilestones", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "index", type: "uint256" }], name: "gmDayRewards", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "gmFlatDailyReward", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "index", type: "uint256" }], name: "gmMilestoneDays", outputs: [{ internalType: "uint16", name: "", type: "uint16" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "index", type: "uint256" }], name: "gmMilestoneRewards", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "claimDailyGM", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256[5]", name: "_rewards", type: "uint256[5]" }], name: "setGMMilestoneRewards", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }], name: "setGMFlatDailyReward", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Admin (owner only)
  { inputs: [{ internalType: "uint256", name: "_price", type: "uint256" }], name: "setSlotPrice", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_duration", type: "uint256" }], name: "setSlotDuration", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_token", type: "address" }, { internalType: "uint256", name: "_price", type: "uint256" }], name: "setPaymentToken", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_bps", type: "uint256" }], name: "setDonationFeeBps", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "withdraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "token", type: "address" }], name: "withdrawToken", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "withdrawETH", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_size", type: "uint256" }], name: "setMaxQueueSize", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_token", type: "address" }], name: "setRewardToken", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_raffle", type: "address" }], name: "setRaffle", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }], name: "setSlotMintReward", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_cost", type: "uint256" }], name: "setFreeSlotCost", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_cost", type: "uint256" }], name: "setDiscountBurnCost", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }], name: "setDiscountAmount", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256[7]", name: "_rewards", type: "uint256[7]" }], name: "setGMDayRewards", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }], name: "setMintPointReward", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }], name: "setDonatePointReward", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }], name: "setPointsPerTicket", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount", type: "uint256" }], name: "setDonateBoozReward", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "string", name: "_contentType", type: "string" }, { internalType: "string", name: "_imageUrl", type: "string" }], name: "setContentTypeImage", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Additional state vars
  { inputs: [], name: "slotMintReward", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "mintPointReward", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "donatePointReward", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "donateBoozReward", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "pointsPerTicket", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "raffle", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "points", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "highestStreak", outputs: [{ internalType: "uint16", name: "", type: "uint16" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "donateCooldown", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "string", name: "", type: "string" }], name: "contentTypeImage", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },

  // Points → tickets
  { inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }], name: "convertToTickets", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Additional events
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "user", type: "address" }, { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }, { indexed: false, internalType: "string", name: "reason", type: "string" }], name: "PointsEarned", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "user", type: "address" }, { indexed: false, internalType: "uint256", name: "pointsBurned", type: "uint256" }, { indexed: false, internalType: "uint256", name: "ticketsMinted", type: "uint256" }], name: "TicketsConverted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "user", type: "address" }, { indexed: false, internalType: "uint16", name: "day", type: "uint16" }, { indexed: false, internalType: "uint256", name: "bonus", type: "uint256" }], name: "GMMilestoneReached", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "newRaffle", type: "address" }], name: "RaffleChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newSize", type: "uint256" }], name: "MaxQueueSizeChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "string", name: "contentType", type: "string" }, { indexed: false, internalType: "string", name: "imageUrl", type: "string" }], name: "ContentTypeImageChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "newToken", type: "address" }], name: "RewardTokenChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newAmount", type: "uint256" }], name: "SlotMintRewardChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newCost", type: "uint256" }], name: "FreeSlotCostChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" }, { indexed: true, internalType: "address", name: "creator", type: "address" }, { indexed: false, internalType: "uint256", name: "tokensBurned", type: "uint256" }], name: "FreeSlotMinted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" }, { indexed: true, internalType: "address", name: "creator", type: "address" }, { indexed: false, internalType: "uint256", name: "tokensBurned", type: "uint256" }, { indexed: false, internalType: "uint256", name: "discountApplied", type: "uint256" }], name: "DiscountSlotMinted", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newCost", type: "uint256" }], name: "DiscountBurnCostChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newAmount", type: "uint256" }], name: "DiscountAmountChanged", type: "event" },
  { anonymous: false, inputs: [{ internalType: "uint256[7]", name: "newRewards", type: "uint256[7]" }], name: "GMDayRewardsChanged", type: "event" },
  { anonymous: false, inputs: [{ internalType: "uint256[5]", name: "newRewards", type: "uint256[5]" }], name: "GMMilestoneRewardsChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newAmount", type: "uint256" }], name: "GMFlatDailyRewardChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "newAmount", type: "uint256" }], name: "DonateBoozRewardChanged", type: "event" },
] as const

// ─── Raffle ABI ───────────────────────────────────────────────────────────────
export const RAFFLE_ABI = [
  // Events
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "user", type: "address" }, { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }], name: "TicketsCredited", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }, { indexed: true, internalType: "address", name: "user", type: "address" }, { indexed: false, internalType: "uint256", name: "ticketAmount", type: "uint256" }, { indexed: false, internalType: "uint256", name: "totalUserTickets", type: "uint256" }], name: "RaffleEntered", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }, { indexed: false, internalType: "uint256", name: "startTime", type: "uint256" }, { indexed: false, internalType: "uint256", name: "endTime", type: "uint256" }, { indexed: false, internalType: "uint256", name: "winnerCount", type: "uint256" }], name: "RaffleCreated", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }, { indexed: false, internalType: "uint256", name: "requestId", type: "uint256" }], name: "DrawRequested", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }, { indexed: false, internalType: "address[]", name: "winners", type: "address[]" }], name: "DrawCompleted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }], name: "RaffleCancelled", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }], name: "DrawReset", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }, { indexed: true, internalType: "address", name: "sponsor", type: "address" }, { indexed: false, internalType: "string", name: "adType", type: "string" }, { indexed: false, internalType: "string", name: "adContent", type: "string" }, { indexed: false, internalType: "string", name: "adLink", type: "string" }, { indexed: false, internalType: "uint256", name: "duration", type: "uint256" }, { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" }], name: "SponsorApplicationSubmitted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }, { indexed: true, internalType: "address", name: "sponsor", type: "address" }], name: "ApplicationAccepted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }, { indexed: true, internalType: "address", name: "sponsor", type: "address" }], name: "ApplicationRejected", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }, { indexed: true, internalType: "address", name: "sponsor", type: "address" }], name: "ApplicationRefunded", type: "event" },
  { anonymous: false, inputs: [{ indexed: false, internalType: "uint256", name: "duration", type: "uint256" }, { indexed: false, internalType: "uint256", name: "minPrize", type: "uint256" }, { indexed: false, internalType: "uint256", name: "fee", type: "uint256" }], name: "PriceTierSet", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "newBooztory", type: "address" }], name: "BooztoryChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "token", type: "address" }, { indexed: true, internalType: "address", name: "to", type: "address" }, { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }], name: "Withdrawn", type: "event" },

  // State vars (public getters)
  { inputs: [], name: "booztory", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "boozToken", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "usdc", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nextRaffleId", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nextApplicationId", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nextAdStartTime", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "defaultDrawThreshold", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "defaultMinUniqueEntrants", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "refundTimeout", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "owner", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "tickets", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }, { internalType: "address", name: "", type: "address" }], name: "raffleTickets", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }, { internalType: "address", name: "", type: "address" }], name: "hasEntered", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "raffleTotalTickets", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "raffleDrawBlock", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "applications", outputs: [{ internalType: "address", name: "sponsor", type: "address" }, { internalType: "string", name: "adType", type: "string" }, { internalType: "string", name: "adContent", type: "string" }, { internalType: "string", name: "adLink", type: "string" }, { internalType: "uint256", name: "duration", type: "uint256" }, { internalType: "uint256", name: "prizePaid", type: "uint256" }, { internalType: "uint256", name: "feePaid", type: "uint256" }, { internalType: "uint256", name: "submittedAt", type: "uint256" }, { internalType: "uint256", name: "acceptedAt", type: "uint256" }, { internalType: "uint8", name: "status", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "priceTiers", outputs: [{ internalType: "uint256", name: "minPrize", type: "uint256" }, { internalType: "uint256", name: "fee", type: "uint256" }], stateMutability: "view", type: "function" },

  // Views
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "getRaffle", outputs: [{ internalType: "address[]", name: "prizeTokens", type: "address[]" }, { internalType: "uint256", name: "winnerCount", type: "uint256" }, { internalType: "uint256", name: "startTime", type: "uint256" }, { internalType: "uint256", name: "endTime", type: "uint256" }, { internalType: "uint8", name: "status", type: "uint8" }, { internalType: "uint256", name: "drawThreshold", type: "uint256" }, { internalType: "uint256", name: "minUniqueEntrants", type: "uint256" }, { internalType: "bool", name: "drawRequested", type: "bool" }, { internalType: "uint256", name: "totalTickets", type: "uint256" }, { internalType: "uint256", name: "uniqueEntrants", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "getRafflePrizeAmounts", outputs: [{ internalType: "uint256[][]", name: "", type: "uint256[][]" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "getRaffleWinners", outputs: [{ internalType: "address[]", name: "", type: "address[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "getRaffleEntrants", outputs: [{ internalType: "address[]", name: "", type: "address[]" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getActiveRaffles", outputs: [{ internalType: "uint256[]", name: "ids", type: "uint256[]" }], stateMutability: "view", type: "function" },

  // Writes — user
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }, { internalType: "uint256", name: "ticketAmount", type: "uint256" }], name: "enterRaffle", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "token", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "depositPrize", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "string", name: "adType", type: "string" }, { internalType: "string", name: "adContent", type: "string" }, { internalType: "string", name: "adLink", type: "string" }, { internalType: "uint256", name: "duration", type: "uint256" }], name: "submitApplication", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "appId", type: "uint256" }], name: "claimRefund", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Writes — admin
  { inputs: [{ internalType: "address[]", name: "prizeTokens", type: "address[]" }, { internalType: "uint256[][]", name: "prizeAmounts", type: "uint256[][]" }, { internalType: "uint256", name: "winnerCount", type: "uint256" }, { internalType: "uint256", name: "duration", type: "uint256" }], name: "createRaffle", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "triggerDraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "cancelRaffle", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "appId", type: "uint256" }], name: "acceptApplication", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "appId", type: "uint256" }], name: "rejectApplication", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "resetDraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "token", type: "address" }], name: "withdraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_booztory", type: "address" }], name: "setBooztory", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "duration", type: "uint256" }, { internalType: "uint256", name: "minPrize", type: "uint256" }, { internalType: "uint256", name: "fee", type: "uint256" }], name: "setPriceTier", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_threshold", type: "uint256" }], name: "setDefaultDrawThreshold", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_min", type: "uint256" }], name: "setDefaultMinUniqueEntrants", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }, { internalType: "uint256", name: "_threshold", type: "uint256" }, { internalType: "uint256", name: "_minUnique", type: "uint256" }], name: "setRaffleThresholds", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_timeout", type: "uint256" }], name: "setRefundTimeout", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_subscriptionId", type: "uint256" }, { internalType: "bytes32", name: "_keyHash", type: "bytes32" }, { internalType: "uint32", name: "_callbackGasLimit", type: "uint32" }, { internalType: "uint16", name: "_requestConfirmations", type: "uint16" }], name: "setVrfConfig", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "renounceOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "newOwner", type: "address" }], name: "transferOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const

// ERC-20 minimal ABI (approve + transfer)
export const ERC20_ABI = [
  { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { name: "transfer", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { name: "allowance", type: "function", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const

// ─── BooztoryToken ABI ────────────────────────────────────────────────────────
export const TOKEN_ABI = [
  // Errors
  { inputs: [], name: "TransferWhileSoulbound", type: "error" },
  { inputs: [], name: "NotAuthorized", type: "error" },
  { inputs: [], name: "OnlySuperchainBridge", type: "error" },
  { inputs: [], name: "ZeroAddress", type: "error" },
  { inputs: [], name: "TreasuryAlreadyMinted", type: "error" },
  { inputs: [], name: "ExceedsTreasuryCap", type: "error" },
  { inputs: [{ internalType: "address", name: "owner", type: "address" }], name: "OwnableInvalidOwner", type: "error" },
  { inputs: [{ internalType: "address", name: "account", type: "address" }], name: "OwnableUnauthorizedAccount", type: "error" },

  // Events
  { anonymous: false, inputs: [{ indexed: false, internalType: "bool", name: "newValue", type: "bool" }], name: "SoulboundChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "minter", type: "address" }, { indexed: false, internalType: "bool", name: "authorized", type: "bool" }], name: "AuthorizedMinterChanged", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "to", type: "address" }, { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }], name: "TreasuryMinted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "from", type: "address" }, { indexed: true, internalType: "address", name: "to", type: "address" }, { indexed: false, internalType: "uint256", name: "value", type: "uint256" }], name: "Transfer", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "owner", type: "address" }, { indexed: true, internalType: "address", name: "spender", type: "address" }, { indexed: false, internalType: "uint256", name: "value", type: "uint256" }], name: "Approval", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "previousOwner", type: "address" }, { indexed: true, internalType: "address", name: "newOwner", type: "address" }], name: "OwnershipTransferred", type: "event" },

  // State vars
  { inputs: [], name: "soulbound", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "authorizedMinters", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "treasuryMinted", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "TREASURY_CAP", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "SUPERCHAIN_BRIDGE", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },

  // ERC-20 standard
  { inputs: [], name: "name", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ internalType: "uint8", name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "account", type: "address" }], name: "balanceOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "owner", type: "address" }, { internalType: "address", name: "spender", type: "address" }], name: "allowance", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "spender", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "approve", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "transfer", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "from", type: "address" }, { internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "transferFrom", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },

  // Ownable
  { inputs: [], name: "owner", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "renounceOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "newOwner", type: "address" }], name: "transferOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Token-specific
  { inputs: [{ internalType: "bool", name: "_soulbound", type: "bool" }], name: "setSoulbound", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_minter", type: "address" }, { internalType: "bool", name: "_authorized", type: "bool" }], name: "setAuthorizedMinter", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "mintTreasury", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "mintReward", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "from", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "burnFrom", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }], name: "burn", outputs: [], stateMutability: "nonpayable", type: "function" },
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
