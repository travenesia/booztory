// ─── Permit2 (canonical across all EVM chains) ───────────────────────────────
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as `0x${string}`
// Only the approve function is needed — used to set allowance before Permit2.transferFrom
export const PERMIT2_ABI = [
  { inputs: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }], name: "approve", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const

// ─── Minimal ERC20 approve ABI ────────────────────────────────────────────────
// Used to approve WLD → Permit2 before Permit2.approve — World App does not
// pre-approve WLD to Permit2 the way it does for USDC.
export const ERC20_APPROVE_ABI = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
] as const

// ─── World Chain contract addresses ──────────────────────────────────────────
export const WORLD_BOOZTORY_ADDRESS = (process.env.NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`
export const WORLD_USDC_ADDRESS     = (process.env.NEXT_PUBLIC_WORLD_USDC_ADDRESS     || "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1") as `0x${string}`
export const WORLD_TOKEN_ADDRESS    = (process.env.NEXT_PUBLIC_WORLD_TOKEN_ADDRESS    || "0x0000000000000000000000000000000000000000") as `0x${string}`
export const WORLD_RAFFLE_ADDRESS   = (process.env.NEXT_PUBLIC_WORLD_RAFFLE_ADDRESS   || "0x0000000000000000000000000000000000000000") as `0x${string}`
export const WORLD_WLD_ADDRESS      = "0x2cFc85d8E48F8EAB294be644d9E25C3030863003" as `0x${string}`

// ─── Slot struct (shared between Base and World — identical shape) ─────────────
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

// ─── BooztoryWorld ABI ────────────────────────────────────────────────────────
// Same core functions as Booztory.sol (Base) + World ID functions.
// NFT pass functions (mintSlotWithNFTDiscount / mintSlotFreeWithNFT) not included
// — removed from BooztoryWorld.sol to stay under 24KB contract size limit.
export const WORLD_BOOZTORY_ABI = [
  // Errors
  { inputs: [], name: "QueueFull",           type: "error" },
  { inputs: [], name: "NotVerifiedHuman",    type: "error" },
  { inputs: [], name: "DuplicateNullifier",  type: "error" },
  { inputs: [], name: "WorldIdNotSet",       type: "error" },
  { inputs: [], name: "OracleNotSet",        type: "error" },
  { inputs: [], name: "OraclePriceInvalid",  type: "error" },
  { inputs: [], name: "WldNotSet",           type: "error" },

  // Events
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" }, { indexed: true, internalType: "address", name: "creator", type: "address" }, { indexed: false, internalType: "uint256", name: "scheduledTime", type: "uint256" }, { indexed: false, internalType: "uint256", name: "endTime", type: "uint256" }], name: "SlotMinted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" }, { indexed: true, internalType: "address", name: "donor", type: "address" }, { indexed: false, internalType: "uint256", name: "creatorAmount", type: "uint256" }, { indexed: false, internalType: "uint256", name: "feeAmount", type: "uint256" }, { indexed: false, internalType: "address", name: "paymentToken", type: "address" }], name: "DonationReceived", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "user", type: "address" }, { indexed: false, internalType: "uint16", name: "streakCount", type: "uint16" }, { indexed: false, internalType: "uint256", name: "reward", type: "uint256" }], name: "GMClaimed", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "user", type: "address" }, { indexed: false, internalType: "uint256", name: "pointsBurned", type: "uint256" }, { indexed: false, internalType: "uint256", name: "ticketsMinted", type: "uint256" }], name: "TicketsConverted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "wallet", type: "address" }], name: "HumanVerified", type: "event" },

  // Core write — mint paths (USDC via Permit2)
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlot",                outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlotWithDiscount",    outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlotWithTokens",     outputs: [], stateMutability: "nonpayable", type: "function" },
  // WLD mint paths (WLD via Permit2)
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlotWithWLD",         outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlotWithWLDDiscount",  outputs: [], stateMutability: "nonpayable", type: "function" },
  // ETH mint paths (native payable)
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlotWithETH",          outputs: [], stateMutability: "payable",    type: "function" },
  { inputs: [{ internalType: "string", name: "contentUrl", type: "string" }, { internalType: "string", name: "contentType", type: "string" }, { internalType: "string", name: "aspectRatio", type: "string" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "authorName", type: "string" }, { internalType: "string", name: "imageUrl", type: "string" }], name: "mintSlotWithETHDiscount",  outputs: [], stateMutability: "payable",    type: "function" },

  // Core write — donate (USDC via Permit2)
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "donate",        outputs: [], stateMutability: "nonpayable", type: "function" },
  // WLD donate
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }, { internalType: "uint256", name: "wldAmount", type: "uint256" }], name: "donateWithWLD", outputs: [], stateMutability: "nonpayable", type: "function" },
  // ETH donate
  { inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }], name: "donateWithETH", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [],                                                                                                                                                          name: "claimDailyGM",    outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],                                                                                             name: "convertToTickets", outputs: [], stateMutability: "nonpayable", type: "function" },

  // World ID — verification state reads (cloud-only pattern; on-chain gating disabled)
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "verifiedHumans",     outputs: [{ internalType: "bool", name: "", type: "bool" }],    stateMutability: "view", type: "function" },
  { inputs: [],                                                        name: "requireVerification", outputs: [{ internalType: "bool", name: "", type: "bool" }],    stateMutability: "view", type: "function" },

  // Slot / contract reads
  { inputs: [], name: "slotPrice",        outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "slotDuration",     outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "maxQueueSize",     outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "slotMintReward",   outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "discountBurnCost", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "freeSlotCost",     outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "discountAmount",   outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "donateBoozReward", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "mintPointReward",  outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "donatePointReward",outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "paymentToken",     outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "rewardToken",      outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "wldToken",         outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "wldOracle",        outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "ethOracle",        outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nextTokenId",      outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "queueEndTime",     outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },

  // Oracle price views
  { inputs: [], name: "getSlotPriceInWLD", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getSlotPriceInETH", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getWLDPrice",       outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getETHPrice",       outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },

  // Slot reads
  { inputs: [], name: "getCurrentSlot",  outputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }, { components: SLOT_COMPONENTS, internalType: "struct BooztoryWorld.Slot", name: "slot", type: "tuple" }, { internalType: "bool", name: "found", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getUpcomingSlots", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct BooztoryWorld.Slot[]", name: "slotData", type: "tuple[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "offset", type: "uint256" }, { internalType: "uint256", name: "limit", type: "uint256" }], name: "getPastSlots", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct BooztoryWorld.Slot[]", name: "slotData", type: "tuple[]" }, { internalType: "uint256", name: "total", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "creator", type: "address" }], name: "getSlotsByCreator", outputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }, { components: SLOT_COMPONENTS, internalType: "struct BooztoryWorld.Slot[]", name: "slotData", type: "tuple[]" }], stateMutability: "view", type: "function" },

  // GM streak reads
  { inputs: [{ internalType: "address", name: "account", type: "address" }], name: "gmStreaks",        outputs: [{ internalType: "uint256", name: "lastClaimDay", type: "uint256" }, { internalType: "uint16", name: "streakCount", type: "uint16" }, { internalType: "uint8", name: "claimedMilestones", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                                name: "gmFlatDailyReward", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },

  // Points / tickets reads
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "points",         outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                        name: "pointsPerTicket", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                        name: "raffle",          outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                        name: "donationFeeBps",  outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                        name: "paused",          outputs: [{ internalType: "bool",    name: "", type: "bool"    }], stateMutability: "view", type: "function" },
  { inputs: [],                                                        name: "owner",           outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },

  // Owner-only setters
  { inputs: [{ internalType: "uint256", name: "price",    type: "uint256" }], name: "setSlotPrice",           outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "duration", type: "uint256" }], name: "setSlotDuration",        outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_size",    type: "uint256" }], name: "setMaxQueueSize",        outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "bps",      type: "uint256" }], name: "setDonationFeeBps",      outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_cost",    type: "uint256" }], name: "setDiscountBurnCost",    outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_cost",    type: "uint256" }], name: "setFreeSlotCost",        outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount",  type: "uint256" }], name: "setDiscountAmount",      outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount",  type: "uint256" }], name: "setSlotMintReward",      outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount",  type: "uint256" }], name: "setDonateBoozReward",    outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount",  type: "uint256" }], name: "setMintPointReward",     outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount",  type: "uint256" }], name: "setDonatePointReward",   outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount",  type: "uint256" }], name: "setPointsPerTicket",     outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_amount",  type: "uint256" }], name: "setGMFlatDailyReward",   outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256[7]", name: "_rewards", type: "uint256[7]" }], name: "setGMDayRewards",       outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256[5]", name: "_rewards", type: "uint256[5]" }], name: "setGMMilestoneRewards", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "string", name: "_contentType", type: "string" }, { internalType: "string", name: "_imageUrl", type: "string" }], name: "setContentTypeImage", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "bool",    name: "required", type: "bool"    }], name: "setRequireVerification", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "wallet",   type: "address" }, { internalType: "bool", name: "verified", type: "bool" }], name: "setVerifiedHuman", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "token",    type: "address" }], name: "setRewardToken",         outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_raffle",  type: "address" }], name: "setRaffle",              outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_token", type: "address" }, { internalType: "uint256", name: "_price", type: "uint256" }], name: "setPaymentToken", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_worldId", type: "address" }, { internalType: "string", name: "_appId", type: "string" }, { internalType: "string", name: "_action", type: "string" }], name: "setWorldId", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_token",   type: "address" }], name: "setWldToken",            outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_oracle",  type: "address" }], name: "setWldOracle",           outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_oracle",  type: "address" }], name: "setEthOracle",           outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [],                                                                 name: "advanceCursor",          outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "token",    type: "address" }], name: "withdraw",               outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [],                                                                 name: "pause",                  outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [],                                                                 name: "unpause",                outputs: [], stateMutability: "nonpayable", type: "function" },
] as const

// ─── BooztoryRaffleWorld ABI ──────────────────────────────────────────────────
// Same sponsor/raffle functions as BooztoryRaffle.sol (Base) + commit-reveal draw
// + World ID verification.
export const WORLD_RAFFLE_ABI = [
  // Errors
  { inputs: [], name: "NotVerifiedHuman",   type: "error" },
  { inputs: [], name: "DuplicateNullifier", type: "error" },
  { inputs: [], name: "WorldIdNotSet",      type: "error" },
  { inputs: [], name: "InsufficientTickets", type: "error" },
  { inputs: [], name: "RaffleNotActive",    type: "error" },
  { inputs: [], name: "InvalidRaffle",      type: "error" },
  { inputs: [], name: "AlreadyCommitted",   type: "error" },
  { inputs: [], name: "DrawNotCommitted",   type: "error" },
  { inputs: [], name: "CommitmentMismatch", type: "error" },
  { inputs: [], name: "BlockHashExpired",   type: "error" },
  { inputs: [], name: "BelowThreshold",     type: "error" },

  // Events
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }, { indexed: true, internalType: "address", name: "user", type: "address" }, { indexed: false, internalType: "uint256", name: "ticketAmount", type: "uint256" }, { indexed: false, internalType: "uint256", name: "totalUserTickets", type: "uint256" }], name: "RaffleEntered", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }, { indexed: false, internalType: "bytes32", name: "commitment", type: "bytes32" }, { indexed: false, internalType: "uint256", name: "commitBlock", type: "uint256" }], name: "DrawCommitted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "raffleId", type: "uint256" }, { indexed: false, internalType: "address[]", name: "winners", type: "address[]" }], name: "DrawCompleted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }, { indexed: true, internalType: "address", name: "sponsor", type: "address" }], name: "ApplicationAccepted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }, { indexed: true, internalType: "address", name: "sponsor", type: "address" }], name: "ApplicationRejected", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "wallet", type: "address" }], name: "HumanVerified", type: "event" },

  // World ID
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "verifiedHumans",     outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                        name: "requireVerification", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },

  // Raffle entry
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }, { internalType: "uint256", name: "ticketAmount", type: "uint256" }], name: "enterRaffle", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Ticket reads
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "tickets", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }, { internalType: "address", name: "", type: "address" }], name: "raffleTickets", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "raffleTotalTickets", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },

  // Raffle reads
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "getRaffle", outputs: [{ internalType: "address[]", name: "prizeTokens", type: "address[]" }, { internalType: "uint256", name: "winnerCount", type: "uint256" }, { internalType: "uint256", name: "startTime", type: "uint256" }, { internalType: "uint256", name: "endTime", type: "uint256" }, { internalType: "uint8", name: "status", type: "uint8" }, { internalType: "uint256", name: "drawThreshold", type: "uint256" }, { internalType: "uint256", name: "minUniqueEntrants", type: "uint256" }, { internalType: "bytes32", name: "commitment", type: "bytes32" }, { internalType: "uint256", name: "commitBlock", type: "uint256" }, { internalType: "uint256", name: "totalTickets", type: "uint256" }, { internalType: "uint256", name: "uniqueEntrants", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "getRafflePrizeAmounts", outputs: [{ internalType: "uint256[][]", name: "", type: "uint256[][]" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "getRaffleWinners",  outputs: [{ internalType: "address[]", name: "", type: "address[]" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                                name: "getActiveRaffles", outputs: [{ internalType: "uint256[]", name: "ids", type: "uint256[]" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                                name: "nextRaffleId",     outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },

  // Commit-reveal draw views
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "isRevealable",      outputs: [{ internalType: "bool",    name: "", type: "bool"    }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "blocksUntilExpiry", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },

  // Sponsor applications
  { inputs: [{ internalType: "string", name: "adType", type: "string" }, { internalType: "string", name: "adContent", type: "string" }, { internalType: "string", name: "adLink", type: "string" }, { internalType: "uint256", name: "duration", type: "uint256" }], name: "submitApplication", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "appId", type: "uint256" }], name: "acceptApplication",  outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "appId", type: "uint256" }], name: "rejectApplication",  outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "appId", type: "uint256" }], name: "claimRefund",        outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }],      name: "applications",       outputs: [{ internalType: "address", name: "sponsor", type: "address" }, { internalType: "string", name: "adType", type: "string" }, { internalType: "string", name: "adContent", type: "string" }, { internalType: "string", name: "adLink", type: "string" }, { internalType: "uint256", name: "duration", type: "uint256" }, { internalType: "uint256", name: "prizePaid", type: "uint256" }, { internalType: "uint256", name: "feePaid", type: "uint256" }, { internalType: "uint256", name: "submittedAt", type: "uint256" }, { internalType: "uint256", name: "acceptedAt", type: "uint256" }, { internalType: "uint8", name: "status", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                             name: "nextApplicationId",  outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [],                                                             name: "nextAdStartTime",    outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },

  // Price tiers
  { inputs: [{ internalType: "uint256", name: "", type: "uint256" }], name: "priceTiers", outputs: [{ internalType: "uint256", name: "minPrize", type: "uint256" }, { internalType: "uint256", name: "fee", type: "uint256" }], stateMutability: "view", type: "function" },

  // Owner & state
  { inputs: [], name: "owner",                    outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "paused",                   outputs: [{ internalType: "bool",    name: "", type: "bool"    }], stateMutability: "view", type: "function" },
  { inputs: [], name: "boozToken",                outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "defaultDrawThreshold",     outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "defaultMinUniqueEntrants", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "refundTimeout",            outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },

  // Raffle reads (additional)
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }], name: "getRaffleEntrants", outputs: [{ internalType: "address[]", name: "", type: "address[]" }], stateMutability: "view", type: "function" },

  // Owner-only — create raffle
  { inputs: [{ internalType: "address[]", name: "prizeTokens", type: "address[]" }, { internalType: "uint256[][]", name: "prizeAmounts", type: "uint256[][]" }, { internalType: "uint256", name: "winnerCount", type: "uint256" }, { internalType: "uint256", name: "duration", type: "uint256" }], name: "createRaffle", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Owner-only — draw
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }, { internalType: "bytes32", name: "commitment", type: "bytes32" }], name: "commitDraw",  outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }, { internalType: "bytes32", name: "secret",     type: "bytes32" }], name: "revealDraw",  outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }],                                                                   name: "cancelRaffle", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }],                                                                   name: "resetDraw",    outputs: [], stateMutability: "nonpayable", type: "function" },

  // Owner-only — prize deposit
  { inputs: [{ internalType: "address", name: "token", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }], name: "depositPrize", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Owner-only — config
  { inputs: [{ internalType: "uint256", name: "duration", type: "uint256" }, { internalType: "uint256", name: "minPrize", type: "uint256" }, { internalType: "uint256", name: "fee", type: "uint256" }], name: "setPriceTier",                outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_threshold", type: "uint256" }],                                                                                                                            name: "setDefaultDrawThreshold",    outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_min",       type: "uint256" }],                                                                                                                            name: "setDefaultMinUniqueEntrants", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "raffleId", type: "uint256" }, { internalType: "uint256", name: "_threshold", type: "uint256" }, { internalType: "uint256", name: "_minUnique", type: "uint256" }], name: "setRaffleThresholds", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "_timeout",   type: "uint256" }],                                                                                                                            name: "setRefundTimeout",           outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_booztory",  type: "address" }],                                                                                                                            name: "setBooztory",                outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "_worldId", type: "address" }, { internalType: "string", name: "_appId", type: "string" }, { internalType: "string", name: "_action", type: "string" }], name: "setWorldId", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "bool",    name: "_required",  type: "bool"    }],                                                                                                                            name: "setRequireVerification",     outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "wallet", type: "address" }, { internalType: "bool", name: "verified", type: "bool" }],                                                                      name: "setVerifiedHuman",           outputs: [], stateMutability: "nonpayable", type: "function" },

  // Owner-only — withdraw & pause
  { inputs: [{ internalType: "address", name: "token", type: "address" }], name: "withdraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "pause",   outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "unpause", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const

// ─── BooztoryToken (BOOZ) ABI — World Chain ───────────────────────────────────
export const WORLD_TOKEN_ABI = [
  { inputs: [],                                                                                                name: "owner",              outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view",        type: "function" },
  { inputs: [],                                                                                                name: "totalSupply",        outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view",        type: "function" },
  { inputs: [],                                                                                                name: "MAX_SUPPLY",         outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view",        type: "function" },
  { inputs: [],                                                                                                name: "treasuryMinted",     outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view",        type: "function" },
  { inputs: [],                                                                                                name: "soulbound",          outputs: [{ internalType: "bool",    name: "", type: "bool"    }], stateMutability: "view",        type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }],                                        name: "authorizedMinters",  outputs: [{ internalType: "bool",    name: "", type: "bool"    }], stateMutability: "view",        type: "function" },
  { inputs: [{ internalType: "address", name: "minter", type: "address" }, { internalType: "bool", name: "authorized", type: "bool" }], name: "setAuthorizedMinter", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "bool",    name: "value",  type: "bool"    }],                                  name: "setSoulbound",        outputs: [], stateMutability: "nonpayable", type: "function" },
] as const
