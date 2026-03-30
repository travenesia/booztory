import hre from "hardhat"
import { ethers } from "hardhat"

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// ── Chainlink VRF v2.5 ────────────────────────────────────────────────────────
const VRF_COORDINATOR_BASE    = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
const VRF_COORDINATOR_SEPOLIA = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE"
const KEY_HASH = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"

// VRF_SUBSCRIPTION_ID must be set as an env var:
//   VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeploy.ts --network base-sepolia
const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0")

// ── What this script does ─────────────────────────────────────────────────────
// Both Booztory.sol and BooztoryRaffle.sol changed → redeploy both.
// BooztoryToken unchanged → kept, rewired to both new contracts.
//
// Booztory.sol changes:
//   - Pausable + _slotCursor + advanceCursor()
//   - NFT Pass: approvedNFTContracts, approvedNFTList, nftLastDiscountMint, nftLastFreeMint
//   - setNFTContract(), getApprovedNFTContracts()
//   - mintSlotWithNFTDiscount(), mintSlotFreeWithNFT()
//
// BooztoryRaffle.sol changes:
//   - BOOZMintFailed event in VRF callback catch block
//   - Pausable (pause/unpause by owner)
//
// After this script completes:
//   1. Remove OLD raffle from Chainlink VRF subscription (vrf.chain.link)
//   2. Add NEW raffle as VRF consumer

async function main() {
  const network = hre.network.name
  const isBase  = network === "base"

  if (VRF_SUBSCRIPTION_ID === 0n) {
    throw new Error(
      `VRF_SUBSCRIPTION_ID not set.\nRun: VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeploy.ts --network ${network}`
    )
  }

  const paymentToken   = isBase ? USDC_BASE    : USDC_SEPOLIA
  const vrfCoordinator = isBase ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_SEPOLIA

  const tokenAddress       = process.env.NEXT_PUBLIC_TOKEN_ADDRESS
  const oldBooztoryAddress = process.env.NEXT_PUBLIC_BOOZTORY_ADDRESS
  const oldRaffleAddress   = process.env.NEXT_PUBLIC_RAFFLE_ADDRESS

  if (!tokenAddress) throw new Error("NEXT_PUBLIC_TOKEN_ADDRESS not set in .env.local")

  const [deployer] = await ethers.getSigners()
  console.log(`\nRedeploying Booztory + BooztoryRaffle on: ${network}`)
  console.log(`Deployer:        ${deployer.address}`)
  console.log(`Old Booztory:    ${oldBooztoryAddress ?? "none"}`)
  console.log(`Old Raffle:      ${oldRaffleAddress   ?? "none"}`)
  console.log(`BooztoryToken:   ${tokenAddress}  (kept)`)
  console.log(`USDC:            ${paymentToken}`)
  console.log(`VRF Coordinator: ${vrfCoordinator}`)
  console.log(`Sub ID:          ${VRF_SUBSCRIPTION_ID}\n`)

  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  const token = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)

  // ── 1. Deploy new Booztory ────────────────────────────────────────────────
  console.log("1/10  Deploying Booztory...")
  const BooztoryFactory = await ethers.getContractFactory("contracts/Booztory.sol:Booztory")
  const booztory = await BooztoryFactory.deploy(paymentToken, { nonce: nextNonce() })
  await booztory.waitForDeployment()
  const booztoryAddress = await booztory.getAddress()
  console.log(`      Booztory: ${booztoryAddress}`)

  // ── 2. Deploy new BooztoryRaffle ──────────────────────────────────────────
  console.log("2/10  Deploying BooztoryRaffle...")
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
  console.log(`      BooztoryRaffle: ${raffleAddress}`)

  // ── 3. Revoke old Booztory minter rights ─────────────────────────────────
  if (oldBooztoryAddress) {
    console.log(`3/10  Revoking old Booztory minter rights (${oldBooztoryAddress})...`)
    const tx = await token.setAuthorizedMinter(oldBooztoryAddress, false, { nonce: nextNonce() })
    await tx.wait()
    console.log(`      Done. (tx: ${tx.hash})`)
  } else {
    console.log("3/10  No old Booztory address — skipping revoke.")
    _nonce--
  }

  // ── 4. Revoke old Raffle minter rights ───────────────────────────────────
  if (oldRaffleAddress) {
    console.log(`4/10  Revoking old Raffle minter rights (${oldRaffleAddress})...`)
    const tx = await token.setAuthorizedMinter(oldRaffleAddress, false, { nonce: nextNonce() })
    await tx.wait()
    console.log(`      Done. (tx: ${tx.hash})`)
  } else {
    console.log("4/10  No old Raffle address — skipping revoke.")
    _nonce--
  }

  // ── 5. Authorize new Booztory as minter on token ──────────────────────────
  console.log("5/10  Authorizing new Booztory as minter on BooztoryToken...")
  const tx5 = await token.setAuthorizedMinter(booztoryAddress, true, { nonce: nextNonce() })
  await tx5.wait()
  console.log(`      Done. (tx: ${tx5.hash})`)

  // ── 6. Authorize new Raffle as minter on token ────────────────────────────
  console.log("6/10  Authorizing new Raffle as minter on BooztoryToken...")
  const tx6 = await token.setAuthorizedMinter(raffleAddress, true, { nonce: nextNonce() })
  await tx6.wait()
  console.log(`      Done. (tx: ${tx6.hash})`)

  // ── 7. setRewardToken on new Booztory ─────────────────────────────────────
  console.log("7/10  Calling setRewardToken on Booztory...")
  const tx7 = await booztory.setRewardToken(tokenAddress, { nonce: nextNonce() })
  await tx7.wait()
  console.log(`      Done. (tx: ${tx7.hash})`)

  // ── 8. setRaffle on new Booztory ──────────────────────────────────────────
  console.log("8/10  Calling setRaffle on Booztory...")
  const tx8 = await booztory.setRaffle(raffleAddress, { nonce: nextNonce() })
  await tx8.wait()
  console.log(`      Done. (tx: ${tx8.hash})`)

  // ── 9. Testnet: lower thresholds + shorter slots for QA ──────────────────
  if (!isBase) {
    console.log("9/10  Testnet: slotDuration=1h, drawThreshold=1, minUniqueEntrants=1...")
    const tx9a = await booztory.setSlotDuration(3600, { nonce: nextNonce() })
    await tx9a.wait()
    const tx9b = await raffle.setDefaultDrawThreshold(1, { nonce: nextNonce() })
    await tx9b.wait()
    const tx9c = await raffle.setDefaultMinUniqueEntrants(1, { nonce: nextNonce() })
    await tx9c.wait()
    console.log(`      Done.`)
  } else {
    console.log("9/10  Mainnet: skipping testnet thresholds.")
  }

  // ── 10. Done ──────────────────────────────────────────────────────────────
  console.log("10/10 Complete.\n")

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Redeployed — ${network.padEnd(42)}║
╠══════════════════════════════════════════════════════════╣
║  Booztory (new):       ${booztoryAddress}  ║
║  BooztoryRaffle (new): ${raffleAddress}  ║
║  BooztoryToken:        ${tokenAddress}  (unchanged) ║
╚══════════════════════════════════════════════════════════╝

Update .env.local:
  NEXT_PUBLIC_BOOZTORY_ADDRESS=${booztoryAddress}
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}

Verify:
  npx hardhat verify --network ${network} ${booztoryAddress} "${paymentToken}"
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
