import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { DrawCompleted } from "../generated/BooztoryRaffle/BooztoryRaffle"
import { BooztoryRaffle } from "../generated/BooztoryRaffle/BooztoryRaffle"
import { Wallet, WinEvent } from "../generated/schema"

// USDC on Base Sepolia — set to Base Mainnet USDC at mainnet deploy
const USDC_ADDRESS = Address.fromString("0x036CbD53842c5426634e7929541eC2318f3dCF7e")

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

export function handleDrawCompleted(event: DrawCompleted): void {
  const contract = BooztoryRaffle.bind(event.address)
  const raffleId = event.params.raffleId

  // Read prize tokens and amounts from the contract at draw time
  const raffleData = contract.getRaffle(raffleId)
  const prizeTokens = raffleData.value0  // address[]
  const prizeAmounts = contract.getRafflePrizeAmounts(raffleId) // uint256[][]

  // Find which token index is USDC
  let usdcIndex = -1
  for (let t = 0; t < prizeTokens.length; t++) {
    if (prizeTokens[t].equals(USDC_ADDRESS)) {
      usdcIndex = t
      break
    }
  }

  const winners = event.params.winners
  for (let i = 0; i < winners.length; i++) {
    // Look up USDC amount for this winner's position
    let usdcAmount = BigInt.fromI32(0)
    if (usdcIndex >= 0 && usdcIndex < prizeAmounts.length) {
      const usdcPerWinner = prizeAmounts[usdcIndex]
      if (i < usdcPerWinner.length) {
        usdcAmount = usdcPerWinner[i]
      }
    }

    const wallet = getOrCreateWallet(winners[i])
    wallet.totalWins = wallet.totalWins + 1
    wallet.totalWinnings = wallet.totalWinnings.plus(usdcAmount)
    wallet.save()

    const id = event.transaction.hash.toHexString() + "-" + i.toString()
    const ev = new WinEvent(id)
    ev.winner = winners[i]
    ev.raffleId = raffleId
    ev.usdcAmount = usdcAmount
    ev.txHash = event.transaction.hash.toHexString()
    ev.blockTimestamp = event.block.timestamp
    ev.save()
  }
}
