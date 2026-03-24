import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  SlotMinted,
  FreeSlotMinted,
  DiscountSlotMinted,
  GMClaimed,
  PointsEarned,
  DonationReceived,
} from "../generated/Booztory/Booztory"
import {
  Wallet,
  Slot,
  SlotMintEvent,
  GMClaimEvent,
  PointsEarnedEvent,
  DonationEvent,
} from "../generated/schema"

// ── Helper ─────────────────────────────────────────────────────────────────────
function getOrCreateWallet(address: Bytes): Wallet {
  const id = address.toHexString().toLowerCase()
  let wallet = Wallet.load(id)
  if (!wallet) {
    wallet = new Wallet(id)
    wallet.totalSlots = BigInt.fromI32(0)
    wallet.bestStreak = 0
    wallet.totalPoints = BigInt.fromI32(0)
    wallet.totalDonated = BigInt.fromI32(0)
    wallet.totalReceived = BigInt.fromI32(0)
    wallet.totalWins = 0
    wallet.totalWinnings = BigInt.fromI32(0)
  }
  return wallet
}

function mintEventId(hash: Bytes, logIndex: BigInt): string {
  return hash.toHexString() + "-" + logIndex.toString()
}

// ── Slot mint handlers — all three paths count toward totalSlots ──────────────
export function handleSlotMinted(event: SlotMinted): void {
  const wallet = getOrCreateWallet(event.params.creator)
  wallet.totalSlots = wallet.totalSlots.plus(BigInt.fromI32(1))
  wallet.save()

  // Store slot for creator lookup when DonationReceived fires
  const slot = new Slot(event.params.tokenId.toString())
  slot.creator = event.params.creator
  slot.save()

  const ev = new SlotMintEvent(mintEventId(event.transaction.hash, event.logIndex))
  ev.creator = event.params.creator
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}

export function handleFreeSlotMinted(event: FreeSlotMinted): void {
  const wallet = getOrCreateWallet(event.params.creator)
  wallet.totalSlots = wallet.totalSlots.plus(BigInt.fromI32(1))
  wallet.save()

  const slot = new Slot(event.params.tokenId.toString())
  slot.creator = event.params.creator
  slot.save()

  const ev = new SlotMintEvent(mintEventId(event.transaction.hash, event.logIndex))
  ev.creator = event.params.creator
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}

export function handleDiscountSlotMinted(event: DiscountSlotMinted): void {
  const wallet = getOrCreateWallet(event.params.creator)
  wallet.totalSlots = wallet.totalSlots.plus(BigInt.fromI32(1))
  wallet.save()

  const slot = new Slot(event.params.tokenId.toString())
  slot.creator = event.params.creator
  slot.save()

  const ev = new SlotMintEvent(mintEventId(event.transaction.hash, event.logIndex))
  ev.creator = event.params.creator
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}

// ── GM streak ─────────────────────────────────────────────────────────────────
export function handleGMClaimed(event: GMClaimed): void {
  const wallet = getOrCreateWallet(event.params.user)
  const streak = event.params.streakCount as i32
  // All-time: keep the highest streak ever reached
  if (streak > wallet.bestStreak) {
    wallet.bestStreak = streak
  }
  wallet.save()

  const ev = new GMClaimEvent(mintEventId(event.transaction.hash, event.logIndex))
  ev.user = event.params.user
  ev.streakCount = streak
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}

// ── Points ─────────────────────────────────────────────────────────────────────
export function handlePointsEarned(event: PointsEarned): void {
  const wallet = getOrCreateWallet(event.params.user)
  wallet.totalPoints = wallet.totalPoints.plus(event.params.amount)
  wallet.save()

  const ev = new PointsEarnedEvent(mintEventId(event.transaction.hash, event.logIndex))
  ev.user = event.params.user
  ev.amount = event.params.amount
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}

// ── Donations ─────────────────────────────────────────────────────────────────
export function handleDonationReceived(event: DonationReceived): void {
  const total = event.params.creatorAmount.plus(event.params.feeAmount)

  // Update donor totals
  const donor = getOrCreateWallet(event.params.donor)
  donor.totalDonated = donor.totalDonated.plus(total)
  donor.save()

  // Look up creator from Slot entity stored at mint time
  const slot = Slot.load(event.params.tokenId.toString())
  if (!slot) return

  const creator = getOrCreateWallet(slot.creator)
  creator.totalReceived = creator.totalReceived.plus(event.params.creatorAmount)
  creator.save()

  const ev = new DonationEvent(mintEventId(event.transaction.hash, event.logIndex))
  ev.donor = event.params.donor
  ev.creator = slot.creator
  ev.creatorAmount = event.params.creatorAmount
  ev.totalAmount = total
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}
