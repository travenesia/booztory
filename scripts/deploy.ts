import hre from "hardhat"
import { ethers } from "hardhat"

// ── CREATE2 factory (Arachnid) — deployed on every EVM chain ──────────────────
// Guarantees BooztoryToken lands at the same address on Base, World Chain, etc.
const CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C"
const CREATE2_SALT    = ethers.ZeroHash // bytes32(0)

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// ── Chainlink VRF v2.5 coordinator addresses ──────────────────────────────────
// Source: https://docs.chain.link/vrf/v2-5/supported-networks
const VRF_COORDINATOR_BASE    = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
const VRF_COORDINATOR_SEPOLIA = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE"

// ── Chainlink VRF v2.5 key hashes (gas lanes) ─────────────────────────────────
// 30 gwei gas lane — suitable for both networks
const KEY_HASH_BASE    = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"
const KEY_HASH_SEPOLIA = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"

// ── VRF Subscription ID ───────────────────────────────────────────────────────
// Set this in your environment: VRF_SUBSCRIPTION_ID=<your id from vrf.chain.link>
// Must fund the subscription with LINK before the raffle can request randomness.
const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0")

async function main() {
  const network = hre.network.name
  const isBase  = network === "base"

  const paymentToken     = isBase ? USDC_BASE         : USDC_SEPOLIA
  const vrfCoordinator   = isBase ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_SEPOLIA
  const keyHash          = isBase ? KEY_HASH_BASE     : KEY_HASH_SEPOLIA

  if (VRF_SUBSCRIPTION_ID === 0n) {
    console.warn("⚠  VRF_SUBSCRIPTION_ID not set — BooztoryRaffle will deploy but cannot request randomness.")
    console.warn("   Set it via: VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/deploy.ts --network <network>")
  }

  const [deployer] = await ethers.getSigners()
  console.log(`\nDeploying on: ${network}`)
  console.log(`Deployer:     ${deployer.address}`)
  console.log(`USDC:         ${paymentToken}`)
  console.log(`VRF:          ${vrfCoordinator}`)
  console.log(`Sub ID:       ${VRF_SUBSCRIPTION_ID}\n`)

  // ── 1. Deploy Booztory ──────────────────────────────────────────────────────
  console.log("1/6  Deploying Booztory...")
  const BooztoryFactory = await ethers.getContractFactory("contracts/Booztory.sol:Booztory")
  const booztory = await BooztoryFactory.deploy(paymentToken)
  await booztory.waitForDeployment()
  const booztoryAddress = await booztory.getAddress()
  console.log(`     Booztory:       ${booztoryAddress}`)

  // ── 2. Deploy BooztoryToken via CREATE2 ────────────────────────────────────
  // Owner is passed as constructor arg — msg.sender inside CREATE2 factory is
  // the factory itself, not the deployer EOA, so we encode the owner explicitly.
  // Same deployer wallet on every chain = same initcode = same CREATE2 address.
  console.log("2/6  Deploying BooztoryToken via CREATE2...")
  const TokenFactory  = await ethers.getContractFactory("contracts/BooztoryToken.sol:BooztoryToken")
  const initcode      = ethers.concat([
    (TokenFactory as any).bytecode,
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [deployer.address]),
  ])
  const deployData    = CREATE2_SALT + initcode.slice(2) // salt(32) + initcode
  const deployTx      = await deployer.sendTransaction({ to: CREATE2_FACTORY, data: deployData })
  await deployTx.wait()
  const tokenAddress  = ethers.getCreate2Address(CREATE2_FACTORY, CREATE2_SALT, ethers.keccak256(initcode))
  const token         = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)
  console.log(`     BooztoryToken:  ${tokenAddress}`)

  // ── 3. Deploy BooztoryRaffle ────────────────────────────────────────────────
  console.log("3/6  Deploying BooztoryRaffle...")
  const RaffleFactory = await ethers.getContractFactory("contracts/BooztoryRaffle.sol:BooztoryRaffle")
  const raffle = await RaffleFactory.deploy(
    vrfCoordinator,
    booztoryAddress,
    paymentToken,
    VRF_SUBSCRIPTION_ID,
    keyHash
  )
  await raffle.waitForDeployment()
  const raffleAddress = await raffle.getAddress()
  console.log(`     BooztoryRaffle: ${raffleAddress}`)

  // ── 4. Wire: setBooztory on token ───────────────────────────────────────────
  console.log("4/6  Calling setBooztory on BooztoryToken...")
  const tx0 = await token.setBooztory(booztoryAddress)
  await tx0.wait()
  console.log(`     Done. (tx: ${tx0.hash})`)

  // ── 5. Wire: setRewardToken ─────────────────────────────────────────────────
  console.log("5/6  Calling setRewardToken on Booztory...")
  const tx1 = await booztory.setRewardToken(tokenAddress)
  await tx1.wait()
  console.log(`     Done. (tx: ${tx1.hash})`)

  // ── 6. Wire: setRaffle ──────────────────────────────────────────────────────
  console.log("6/6  Calling setRaffle on Booztory...")
  const tx2 = await booztory.setRaffle(raffleAddress)
  await tx2.wait()
  console.log(`     Done. (tx: ${tx2.hash})`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Deployment complete — ${network.padEnd(33)}║
╠══════════════════════════════════════════════════════════╣
║  Booztory:       ${booztoryAddress}  ║
║  BooztoryToken:  ${tokenAddress}  ║
║  BooztoryRaffle: ${raffleAddress}  ║
╚══════════════════════════════════════════════════════════╝

Add to .env.local:
  NEXT_PUBLIC_BOOZTORY_ADDRESS=${booztoryAddress}
  NEXT_PUBLIC_USDC_ADDRESS=${paymentToken}
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}
  NEXT_PUBLIC_TOKEN_ADDRESS=${tokenAddress}

Next steps:
  1. Add BooztoryRaffle (${raffleAddress}) as a consumer on your Chainlink VRF subscription
  2. Fund the subscription with LINK at https://vrf.chain.link
  3. Run verification:
       npx hardhat verify --network ${network} ${booztoryAddress} "${paymentToken}"
       npx hardhat verify --network ${network} ${tokenAddress}
       npx hardhat verify --network ${network} ${raffleAddress} "${vrfCoordinator}" "${booztoryAddress}" "${paymentToken}" ${VRF_SUBSCRIPTION_ID} "${keyHash}"
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
