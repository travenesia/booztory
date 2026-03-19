import hre from "hardhat"
import { ethers } from "hardhat"

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// ── Chainlink VRF v2.5 coordinator addresses ──────────────────────────────────
const VRF_COORDINATOR_BASE    = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
const VRF_COORDINATOR_SEPOLIA = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE"

// ── Chainlink VRF v2.5 key hashes (30 gwei gas lane) ─────────────────────────
const KEY_HASH = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"

// ── VRF Subscription ID ───────────────────────────────────────────────────────
// VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeploy-raffle.ts --network base-sepolia
const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0")

// ── Existing contract addresses (from .env.local or paste here) ───────────────
// These are NOT redeployed — only BooztoryRaffle is new.
const BOOZTORY_ADDRESS = process.env.NEXT_PUBLIC_BOOZTORY_ADDRESS || ""

async function main() {
  const network      = hre.network.name
  const isBase       = network === "base"
  const paymentToken = isBase ? USDC_BASE : USDC_SEPOLIA
  const vrfCoord     = isBase ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_SEPOLIA

  if (!BOOZTORY_ADDRESS || BOOZTORY_ADDRESS === "") {
    console.error("❌  NEXT_PUBLIC_BOOZTORY_ADDRESS is not set in .env.local")
    process.exit(1)
  }

  if (VRF_SUBSCRIPTION_ID === 0n) {
    console.warn("⚠  VRF_SUBSCRIPTION_ID not set — raffle will deploy but cannot request randomness.")
    console.warn("   Set it via: VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeploy-raffle.ts --network <network>")
  }

  const [deployer] = await ethers.getSigners()
  console.log(`\nRedeploying BooztoryRaffle on: ${network}`)
  console.log(`Deployer:         ${deployer.address}`)
  console.log(`Booztory:         ${BOOZTORY_ADDRESS}`)
  console.log(`USDC:             ${paymentToken}`)
  console.log(`VRF Coordinator:  ${vrfCoord}`)
  console.log(`Sub ID:           ${VRF_SUBSCRIPTION_ID}\n`)

  // ── 1. Deploy new BooztoryRaffle ────────────────────────────────────────────
  console.log("1/2  Deploying BooztoryRaffle...")
  const RaffleFactory = await ethers.getContractFactory("contracts/BooztoryRaffle.sol:BooztoryRaffle")
  const raffle = await RaffleFactory.deploy(
    vrfCoord,
    BOOZTORY_ADDRESS,
    paymentToken,
    VRF_SUBSCRIPTION_ID,
    KEY_HASH
  )
  await raffle.waitForDeployment()
  const raffleAddress = await raffle.getAddress()
  console.log(`     BooztoryRaffle: ${raffleAddress}`)

  // ── 2. Point Booztory to new raffle ─────────────────────────────────────────
  console.log("2/2  Calling setRaffle on Booztory...")
  const booztory = await ethers.getContractAt("contracts/Booztory.sol:Booztory", BOOZTORY_ADDRESS)
  const tx = await booztory.setRaffle(raffleAddress)
  await tx.wait()
  console.log(`     Done. (tx: ${tx.hash})`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  BooztoryRaffle redeployed — ${network.padEnd(27)}║
╠══════════════════════════════════════════════════════════╣
║  BooztoryRaffle: ${raffleAddress}  ║
╚══════════════════════════════════════════════════════════╝

Update .env.local:
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}

Next steps:
  1. Add new BooztoryRaffle as a consumer on your Chainlink VRF subscription
       https://vrf.chain.link — remove old consumer, add: ${raffleAddress}
  2. For testnet — call setWeekDuration(3600) on the new raffle for 1-hour weeks
  3. Verify on Basescan:
       npx hardhat verify --network ${network} ${raffleAddress} "${vrfCoord}" "${BOOZTORY_ADDRESS}" "${paymentToken}" ${VRF_SUBSCRIPTION_ID} "${KEY_HASH}"
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
