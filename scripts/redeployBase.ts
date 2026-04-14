import hre from "hardhat"
import { ethers } from "hardhat"

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// ── Chainlink VRF v2.5 ────────────────────────────────────────────────────────
const VRF_COORDINATOR_BASE    = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
const VRF_COORDINATOR_SEPOLIA = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE"
const KEY_HASH = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"

// ── What this script does ─────────────────────────────────────────────────────
// Only BooztoryRaffle.sol changed (cancelRaffle now refunds tickets on cancel).
// Booztory.sol and BooztoryToken.sol are UNTOUCHED — kept at existing addresses.
// After deploying the new BooztoryRaffle, we:
//   - Revoke old BooztoryRaffle minter rights on BooztoryToken
//   - Grant new BooztoryRaffle minter rights on BooztoryToken
//   - Call setRaffle(newRaffleAddress) on the existing Booztory contract
//
// VRF_SUBSCRIPTION_ID must be set as an env var:
//   VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeployBase.ts --network base
//
// Run with:
//   VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeployBase.ts --network base-sepolia
//   VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeployBase.ts --network base

const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0")

async function main() {
  const network = hre.network.name
  const isBase  = network === "base"

  if (network !== "base" && network !== "base-sepolia") {
    throw new Error(
      `Wrong network: "${network}"\n` +
      `Run: VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeployBase.ts --network base\n` +
      `  or: VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeployBase.ts --network base-sepolia`
    )
  }

  if (VRF_SUBSCRIPTION_ID === 0n) {
    throw new Error(
      `VRF_SUBSCRIPTION_ID not set.\nRun: VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeployBase.ts --network ${network}`
    )
  }

  const paymentToken   = isBase ? USDC_BASE    : USDC_SEPOLIA
  const vrfCoordinator = isBase ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_SEPOLIA

  // Read existing addresses from .env.local — booztory and token are kept
  const tokenAddress       = process.env.NEXT_PUBLIC_TOKEN_ADDRESS
  const booztoryAddress    = process.env.NEXT_PUBLIC_BOOZTORY_ADDRESS
  const oldRaffleAddress   = process.env.NEXT_PUBLIC_RAFFLE_ADDRESS

  if (!tokenAddress)    throw new Error("NEXT_PUBLIC_TOKEN_ADDRESS not set in .env.local")
  if (!booztoryAddress) throw new Error("NEXT_PUBLIC_BOOZTORY_ADDRESS not set in .env.local")

  const [deployer] = await ethers.getSigners()
  console.log(`\nRedeploying BooztoryRaffle only on: ${network}`)
  console.log(`Deployer:         ${deployer.address}`)
  console.log(`Old Raffle:       ${oldRaffleAddress ?? "none"}`)
  console.log(`Booztory:         ${booztoryAddress}  (kept)`)
  console.log(`BooztoryToken:    ${tokenAddress}  (kept)`)
  console.log(`USDC:             ${paymentToken}`)
  console.log(`VRF Coordinator:  ${vrfCoordinator}`)
  console.log(`Sub ID:           ${VRF_SUBSCRIPTION_ID}\n`)

  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  const token    = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)
  const booztory = await ethers.getContractAt("contracts/Booztory.sol:Booztory", booztoryAddress)

  // ── 1. Deploy new BooztoryRaffle ──────────────────────────────────────────
  console.log("1/5  Deploying BooztoryRaffle...")
  const RaffleFactory = await ethers.getContractFactory("contracts/BooztoryRaffle.sol:BooztoryRaffle")
  const raffle = await RaffleFactory.deploy(
    vrfCoordinator,
    booztoryAddress,
    paymentToken,
    tokenAddress,
    VRF_SUBSCRIPTION_ID,
    KEY_HASH,
    { nonce: nextNonce() }
  )
  await raffle.waitForDeployment()
  const raffleAddress = await raffle.getAddress()
  console.log(`     BooztoryRaffle: ${raffleAddress}`)

  // ── 2. Revoke old raffle minter rights on BooztoryToken ──────────────────
  if (oldRaffleAddress) {
    console.log(`2/5  Revoking old raffle minter rights (${oldRaffleAddress})...`)
    const tx = await token.setAuthorizedMinter(oldRaffleAddress, false, { nonce: nextNonce() })
    await tx.wait()
    console.log(`     Done. (tx: ${tx.hash})`)
  } else {
    console.log("2/5  No old raffle address — skipping revoke.")
    _nonce--
  }

  // ── 3. Authorize new raffle as minter on BooztoryToken ───────────────────
  console.log("3/5  setAuthorizedMinter(new BooztoryRaffle)...")
  const tx3 = await token.setAuthorizedMinter(raffleAddress, true, { nonce: nextNonce() })
  await tx3.wait()
  console.log(`     Done. (tx: ${tx3.hash})`)

  // ── 4. Wire new raffle into existing Booztory ─────────────────────────────
  console.log("4/5  setRaffle on Booztory...")
  const tx4 = await booztory.setRaffle(raffleAddress, { nonce: nextNonce() })
  await tx4.wait()
  console.log(`     Done. (tx: ${tx4.hash})`)

  // ── 5. Testnet QA settings ────────────────────────────────────────────────
  if (!isBase) {
    console.log("5/5  Testnet: drawThreshold=1, minUniqueEntrants=1...")
    const tx5a = await raffle.setDefaultDrawThreshold(1, { nonce: nextNonce() })
    await tx5a.wait()
    const tx5b = await raffle.setDefaultMinUniqueEntrants(1, { nonce: nextNonce() })
    await tx5b.wait()
    console.log(`     Done.`)
  } else {
    console.log("5/5  Mainnet: skipping testnet settings.")
  }

  console.log("\nComplete.\n")

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Redeployed — ${network.padEnd(42)}║
╠══════════════════════════════════════════════════════════╣
║  BooztoryRaffle (new): ${raffleAddress}  ║
║  Booztory:             ${booztoryAddress}  (unchanged) ║
║  BooztoryToken:        ${tokenAddress}  (unchanged) ║
╚══════════════════════════════════════════════════════════╝

Update .env.local:
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}

Update Vercel env var:
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}

Verify on Basescan:
  npx hardhat verify --network ${network} ${raffleAddress} "${vrfCoordinator}" "${booztoryAddress}" "${paymentToken}" "${tokenAddress}" ${VRF_SUBSCRIPTION_ID} "${KEY_HASH}"

⚠  Manual VRF steps required at https://vrf.chain.link:
  1. Remove old consumer: ${oldRaffleAddress ?? "(no old address)"}
  2. Add new consumer:    ${raffleAddress}
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
