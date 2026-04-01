/**
 * createVesting.ts
 *
 * Deploys one OZ VestingWallet per beneficiary defined in scripts/vesting-config.json,
 * then mints BOOZ to each wallet via BooztoryToken.mintTreasury().
 *
 * Vesting mechanics (OZ VestingWallet v5, no built-in cliff):
 *   - Cliff emulated by setting startTimestamp = now + cliffDays
 *   - After start, tokens vest linearly over linearDays
 *   - linearDays = 0 → 100% unlocks at the cliff date (full cliff unlock)
 *
 * Usage:
 *   npx hardhat run scripts/createVesting.ts --network base-sepolia
 *   npx hardhat run scripts/createVesting.ts --network base
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_TOKEN_ADDRESS set in .env.local (or TOKEN_ADDRESS env var)
 *   - Deployer wallet = token owner (same wallet used to deploy BooztoryToken)
 *   - Sufficient remaining TREASURY_CAP on the token contract
 *   - Edit scripts/vesting-config.json with real addresses and amounts before running
 */

import hre from "hardhat"
import { ethers } from "hardhat"
import * as fs from "fs"
import * as path from "path"

// ── Config ────────────────────────────────────────────────────────────────────

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS
  || process.env.NEXT_PUBLIC_TOKEN_ADDRESS
  || ""

const TREASURY_CAP  = 10_000_000n          // BOOZ (human-readable, without decimals)
const DECIMALS      = 18n
const ONE_ETHER     = 10n ** DECIMALS

// ── Types ─────────────────────────────────────────────────────────────────────

interface BeneficiaryConfig {
  label:      string
  address:    string
  boozAmount: string   // human-readable, e.g. "1000000"
  cliffDays:  number
  linearDays: number
}

interface VestingConfig {
  beneficiaries: BeneficiaryConfig[]
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const network = hre.network.name

  // ── Validate token address ──────────────────────────────────────────────────
  if (!TOKEN_ADDRESS || TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "TOKEN_ADDRESS not set.\n" +
      "Set it via: TOKEN_ADDRESS=0x… npx hardhat run scripts/createVesting.ts --network <network>\n" +
      "Or set NEXT_PUBLIC_TOKEN_ADDRESS in .env.local"
    )
  }

  // ── Load config ─────────────────────────────────────────────────────────────
  const configPath = path.join(__dirname, "vesting-config.json")
  if (!fs.existsSync(configPath)) {
    throw new Error(`vesting-config.json not found at ${configPath}`)
  }
  const config: VestingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"))
  const beneficiaries = config.beneficiaries

  if (!beneficiaries || beneficiaries.length === 0) {
    throw new Error("No beneficiaries found in vesting-config.json")
  }

  // ── Validate config entries ─────────────────────────────────────────────────
  for (const b of beneficiaries) {
    if (!ethers.isAddress(b.address)) {
      throw new Error(`Invalid address for "${b.label}": ${b.address}`)
    }
    if (b.address === ethers.ZeroAddress) {
      throw new Error(`Zero address not allowed for "${b.label}"`)
    }
    if (isNaN(Number(b.boozAmount)) || Number(b.boozAmount) <= 0) {
      throw new Error(`Invalid boozAmount for "${b.label}": ${b.boozAmount}`)
    }
    if (b.cliffDays < 0 || b.linearDays < 0) {
      throw new Error(`Negative days not allowed for "${b.label}"`)
    }
  }

  // ── Check total allocation vs TREASURY_CAP ──────────────────────────────────
  const totalBooz = beneficiaries.reduce((sum, b) => sum + BigInt(b.boozAmount), 0n)
  if (totalBooz > TREASURY_CAP) {
    throw new Error(
      `Total allocation (${totalBooz.toLocaleString()} BOOZ) exceeds TREASURY_CAP ` +
      `(${TREASURY_CAP.toLocaleString()} BOOZ)`
    )
  }

  const [deployer] = await ethers.getSigners()

  console.log(`\nNetwork:   ${network}`)
  console.log(`Deployer:  ${deployer.address}`)
  console.log(`Token:     ${TOKEN_ADDRESS}`)
  console.log(`Entries:   ${beneficiaries.length}`)
  console.log(`Total:     ${totalBooz.toLocaleString()} BOOZ\n`)

  // ── Connect to token contract ───────────────────────────────────────────────
  const tokenAbi = [
    "function owner() view returns (address)",
    "function treasuryMinted() view returns (uint256)",
    "function TREASURY_CAP() view returns (uint256)",
    "function mintTreasury(address to, uint256 amount) external",
  ]
  const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, deployer)

  // Verify deployer is owner
  const owner = await token.owner()
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Deployer ${deployer.address} is not the token owner (${owner}).\n` +
      "You must run this script from the owner wallet."
    )
  }

  // Check remaining treasury cap on-chain
  const treasuryMinted = await token.treasuryMinted() as bigint
  const treasuryCapOnChain = await token.TREASURY_CAP() as bigint
  const remaining = treasuryCapOnChain - treasuryMinted
  const totalBoozWei = totalBooz * ONE_ETHER

  console.log(`Treasury used:      ${ethers.formatUnits(treasuryMinted, 18)} BOOZ`)
  console.log(`Treasury remaining: ${ethers.formatUnits(remaining, 18)} BOOZ`)
  console.log(`This allocation:    ${ethers.formatUnits(totalBoozWei, 18)} BOOZ\n`)

  if (totalBoozWei > remaining) {
    throw new Error(
      `Allocation (${ethers.formatUnits(totalBoozWei, 18)} BOOZ) exceeds ` +
      `remaining treasury cap (${ethers.formatUnits(remaining, 18)} BOOZ)`
    )
  }

  // ── Get VestingWallet factory ───────────────────────────────────────────────
  const VestingWalletFactory = await ethers.getContractFactory(
    "@openzeppelin/contracts/finance/VestingWallet.sol:VestingWallet"
  )

  // ── Read nonce once, increment locally ─────────────────────────────────────
  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  const now = Math.floor(Date.now() / 1000)
  const results: Array<{ label: string; beneficiary: string; vestingWallet: string; amount: string; startDate: string; endDate: string }> = []

  // ── Deploy and fund each vesting wallet ────────────────────────────────────
  for (let i = 0; i < beneficiaries.length; i++) {
    const b = beneficiaries[i]
    const startTimestamp  = now + b.cliffDays  * 86400
    const durationSeconds = b.linearDays       * 86400
    const amountWei       = BigInt(b.boozAmount) * ONE_ETHER

    const startDate = new Date(startTimestamp * 1000).toISOString().slice(0, 10)
    const endDate   = durationSeconds > 0
      ? new Date((startTimestamp + durationSeconds) * 1000).toISOString().slice(0, 10)
      : startDate  // full unlock at cliff

    console.log(`[${i + 1}/${beneficiaries.length}] ${b.label}`)
    console.log(`  Beneficiary: ${b.address}`)
    console.log(`  Amount:      ${b.boozAmount} BOOZ`)
    console.log(`  Cliff:       ${b.cliffDays}d  (unlocks ${startDate})`)
    console.log(`  Linear:      ${b.linearDays}d  (fully vested ${endDate})`)

    // Deploy VestingWallet
    process.stdout.write(`  Deploying VestingWallet...`)
    const vestingWallet = await VestingWalletFactory.deploy(
      b.address,
      BigInt(startTimestamp),
      BigInt(durationSeconds),
      { nonce: nextNonce() }
    )
    await vestingWallet.waitForDeployment()
    const vestingAddress = await vestingWallet.getAddress()
    console.log(` ${vestingAddress}`)

    // Fund via mintTreasury
    process.stdout.write(`  Minting ${b.boozAmount} BOOZ to vesting wallet...`)
    const mintTx = await token.mintTreasury(vestingAddress, amountWei, { nonce: nextNonce() })
    await mintTx.wait()
    console.log(` ✓`)

    results.push({
      label:         b.label,
      beneficiary:   b.address,
      vestingWallet: vestingAddress,
      amount:        `${b.boozAmount} BOOZ`,
      startDate,
      endDate,
    })

    console.log()
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════")
  console.log("  Vesting Deployment Summary")
  console.log("═══════════════════════════════════════════════════════")
  for (const r of results) {
    console.log(`\n  ${r.label}`)
    console.log(`    Beneficiary:    ${r.beneficiary}`)
    console.log(`    VestingWallet:  ${r.vestingWallet}`)
    console.log(`    Amount:         ${r.amount}`)
    console.log(`    Unlocks:        ${r.startDate}`)
    console.log(`    Fully vested:   ${r.endDate}`)
  }
  console.log("\n  Beneficiaries call release(TOKEN_ADDRESS) on their VestingWallet")
  console.log(`  Token: ${TOKEN_ADDRESS}`)
  console.log("═══════════════════════════════════════════════════════\n")

  // ── Save output to file ─────────────────────────────────────────────────────
  const outputPath = path.join(__dirname, `vesting-output-${network}-${Date.now()}.json`)
  fs.writeFileSync(outputPath, JSON.stringify({ network, token: TOKEN_ADDRESS, deployedAt: new Date().toISOString(), entries: results }, null, 2))
  console.log(`  Output saved to: ${outputPath}\n`)
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
