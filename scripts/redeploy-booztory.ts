import hre from "hardhat"
import { ethers } from "hardhat"

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// ── What this script does ─────────────────────────────────────────────────────
// Booztory.sol changed (GM try/catch fix) → redeploy Booztory only.
// BooztoryToken + BooztoryRaffle unchanged → kept, rewired.

async function main() {
  const network = hre.network.name
  const isBase  = network === "base"

  const paymentToken = isBase ? USDC_BASE : USDC_SEPOLIA

  const tokenAddress    = process.env.NEXT_PUBLIC_TOKEN_ADDRESS
  const raffleAddress   = process.env.NEXT_PUBLIC_RAFFLE_ADDRESS
  const oldBooztoryAddress = process.env.NEXT_PUBLIC_BOOZTORY_ADDRESS

  if (!tokenAddress)  throw new Error("NEXT_PUBLIC_TOKEN_ADDRESS not set in .env.local")
  if (!raffleAddress) throw new Error("NEXT_PUBLIC_RAFFLE_ADDRESS not set in .env.local")

  const [deployer] = await ethers.getSigners()
  console.log(`\nRedeploying Booztory on: ${network}`)
  console.log(`Deployer:        ${deployer.address}`)
  console.log(`Old Booztory:    ${oldBooztoryAddress ?? "none"}`)
  console.log(`BooztoryToken:   ${tokenAddress}  (kept)`)
  console.log(`BooztoryRaffle:  ${raffleAddress}  (kept)`)
  console.log(`USDC:            ${paymentToken}\n`)

  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  const token  = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)
  const raffle = await ethers.getContractAt("contracts/BooztoryRaffle.sol:BooztoryRaffle", raffleAddress)

  // ── 1. Deploy new Booztory ────────────────────────────────────────────────
  console.log("1/6  Deploying Booztory...")
  const BooztoryFactory = await ethers.getContractFactory("contracts/Booztory.sol:Booztory")
  const booztory = await BooztoryFactory.deploy(paymentToken, { nonce: nextNonce() })
  await booztory.waitForDeployment()
  const booztoryAddress = await booztory.getAddress()
  console.log(`     Booztory: ${booztoryAddress}`)

  // ── 2. Revoke old Booztory minter rights on token ─────────────────────────
  if (oldBooztoryAddress) {
    console.log(`2/6  Revoking old Booztory minter rights (${oldBooztoryAddress})...`)
    const tx = await token.setAuthorizedMinter(oldBooztoryAddress, false, { nonce: nextNonce() })
    await tx.wait()
    console.log(`     Done. (tx: ${tx.hash})`)
  } else {
    console.log("2/6  No old Booztory address — skipping revoke.")
  }

  // ── 3. Authorize new Booztory as minter on token ──────────────────────────
  console.log("3/6  Authorizing new Booztory as minter on BooztoryToken...")
  const tx3 = await token.setAuthorizedMinter(booztoryAddress, true, { nonce: nextNonce() })
  await tx3.wait()
  console.log(`     Done. (tx: ${tx3.hash})`)

  // ── 4. setRewardToken on new Booztory ─────────────────────────────────────
  console.log("4/6  Calling setRewardToken on Booztory...")
  const tx4 = await booztory.setRewardToken(tokenAddress, { nonce: nextNonce() })
  await tx4.wait()
  console.log(`     Done. (tx: ${tx4.hash})`)

  // ── 5. setRaffle on new Booztory ──────────────────────────────────────────
  console.log("5/6  Calling setRaffle on Booztory...")
  const tx5 = await booztory.setRaffle(raffleAddress, { nonce: nextNonce() })
  await tx5.wait()
  console.log(`     Done. (tx: ${tx5.hash})`)

  // ── 6. setBooztory on Raffle → new address ────────────────────────────────
  console.log("6/6  Calling setBooztory on BooztoryRaffle...")
  const tx6 = await raffle.setBooztory(booztoryAddress, { nonce: nextNonce() })
  await tx6.wait()
  console.log(`     Done. (tx: ${tx6.hash})`)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Booztory redeployed — ${network.padEnd(33)}║
╠══════════════════════════════════════════════════════════╣
║  Booztory (new):  ${booztoryAddress}  ║
║  BooztoryToken:   ${tokenAddress}  (unchanged) ║
║  BooztoryRaffle:  ${raffleAddress}  (unchanged) ║
╚══════════════════════════════════════════════════════════╝

Update .env.local:
  NEXT_PUBLIC_BOOZTORY_ADDRESS=${booztoryAddress}

Verify:
  npx hardhat verify --network ${network} ${booztoryAddress} "${paymentToken}"
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
