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

function eventId(hash: Bytes, logIndex: BigInt): string {
  return hash.toHexString() + "-" + logIndex.toString()
}

// ── Slot mint handlers — all three paths count toward totalSlots ──────────────
export function handleSlotMinted(event: SlotMinted): void {
  const wallet = getOrCreateWallet(event.params.creator)
  wallet.totalSlots = wallet.totalSlots.plus(BigInt.fromI32(1))
  wallet.save()

  const slot = new Slot(event.params.tokenId.toString())
  slot.creator = event.params.creator
  slot.save()

  const ev = new SlotMintEvent(eventId(event.transaction.hash, event.logIndex))
  ev.creator = event.params.creator
  ev.tokenId = event.params.tokenId
  ev.mintType = "standard"
  ev.txHash = event.transaction.hash.toHexString()
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

  const ev = new SlotMintEvent(eventId(event.transaction.hash, event.logIndex))
  ev.creator = event.params.creator
  ev.tokenId = event.params.tokenId
  ev.mintType = "free"
  ev.txHash = event.transaction.hash.toHexString()
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

  const ev = new SlotMintEvent(eventId(event.transaction.hash, event.logIndex))
  ev.creator = event.params.creator
  ev.tokenId = event.params.tokenId
  ev.mintType = "discount"
  ev.txHash = event.transaction.hash.toHexString()
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}

// ── GM streak ─────────────────────────────────────────────────────────────────
export function handleGMClaimed(event: GMClaimed): void {
  const wallet = getOrCreateWallet(event.params.user)
  const streak = event.params.streakCount as i32
  if (streak > wallet.bestStreak) {
    wallet.bestStreak = streak
  }
  wallet.save()

  const ev = new GMClaimEvent(eventId(event.transaction.hash, event.logIndex))
  ev.user = event.params.user
  ev.streakCount = streak
  ev.boozAmount = event.params.reward
  ev.txHash = event.transaction.hash.toHexString()
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}

// ── Points ─────────────────────────────────────────────────────────────────────
export function handlePointsEarned(event: PointsEarned): void {
  const wallet = getOrCreateWallet(event.params.user)
  wallet.totalPoints = wallet.totalPoints.plus(event.params.amount)
  wallet.save()

  const ev = new PointsEarnedEvent(eventId(event.transaction.hash, event.logIndex))
  ev.user = event.params.user
  ev.amount = event.params.amount
  ev.txHash = event.transaction.hash.toHexString()
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}

// ── Donations ─────────────────────────────────────────────────────────────────
export function handleDonationReceived(event: DonationReceived): void {
  const total = event.params.creatorAmount.plus(event.params.feeAmount)

  const donor = getOrCreateWallet(event.params.donor)
  donor.totalDonated = donor.totalDonated.plus(total)
  donor.save()

  const slot = Slot.load(event.params.tokenId.toString())
  if (!slot) return

  const creator = getOrCreateWallet(slot.creator)
  creator.totalReceived = creator.totalReceived.plus(event.params.creatorAmount)
  creator.save()

  const ev = new DonationEvent(eventId(event.transaction.hash, event.logIndex))
  ev.donor = event.params.donor
  ev.creator = slot.creator
  ev.tokenId = event.params.tokenId
  ev.creatorAmount = event.params.creatorAmount
  ev.totalAmount = total
  ev.txHash = event.transaction.hash.toHexString()
  ev.blockTimestamp = event.block.timestamp
  ev.save()
}
