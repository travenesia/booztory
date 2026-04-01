import hre from "hardhat"
import { ethers } from "hardhat"

// ── CREATE2 factory (Arachnid) — deployed on every EVM chain ──────────────────
// Guarantees BooztoryToken lands at the same address on Base, World Chain, etc.
// Same deployer wallet + same salt + same initcode = same address everywhere.
const CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C"
const CREATE2_SALT    = ethers.ZeroHash // bytes32(0)

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// ── Chainlink VRF v2.5 ────────────────────────────────────────────────────────
// Source: https://docs.chain.link/vrf/v2-5/supported-networks
const VRF_COORDINATOR_BASE    = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
const VRF_COORDINATOR_SEPOLIA = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE"
const KEY_HASH_BASE    = "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70" // 30 gwei — Base Mainnet
const KEY_HASH_SEPOLIA = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71" // Base Sepolia

// ── VRF Subscription ID ───────────────────────────────────────────────────────
// Set via env: VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/deploy.ts --network base
const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0")

// ── BooztoryToken (current) ───────────────────────────────────────────────────
// MAX_SUPPLY = 100,000,000 BOOZ (hard cap, on-chain)
// TREASURY_CAP = 10,000,000 BOOZ (tranche-based, cumulative)
// Soulbound Phase 1 on deploy — call setSoulbound(false) to enable trading (Phase 2)
// SuperchainERC20 (IERC7802) — crosschainMint/Burn authorized to SUPERCHAIN_BRIDGE predeploy

async function main() {
  const network = hre.network.name
  const isBase  = network === "base"

  const paymentToken   = isBase ? USDC_BASE           : USDC_SEPOLIA
  const vrfCoordinator = isBase ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_SEPOLIA
  const keyHash        = isBase ? KEY_HASH_BASE        : KEY_HASH_SEPOLIA

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

  // Read nonce once from "pending" (includes mempool), then increment locally.
  // Avoids RPC propagation lag where "latest" hasn't updated yet after a confirmed tx.
  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  // ── 1. Deploy Booztory ──────────────────────────────────────────────────────
  console.log("1/7  Deploying Booztory...")
  const BooztoryFactory = await ethers.getContractFactory("contracts/Booztory.sol:Booztory")
  const booztory = await BooztoryFactory.deploy(paymentToken, { nonce: nextNonce() })
  await booztory.waitForDeployment()
  const booztoryAddress = await booztory.getAddress()
  console.log(`     Booztory:       ${booztoryAddress}`)

  // ── 2. Deploy BooztoryToken via CREATE2 ────────────────────────────────────
  // Owner passed as constructor arg — msg.sender inside CREATE2 factory is the
  // factory itself, not the deployer EOA, so we encode the owner explicitly.
  // Same deployer + same salt + same initcode = same address on every OP Stack chain.
  console.log("2/7  Deploying BooztoryToken via CREATE2...")
  const TokenFactory = await ethers.getContractFactory("contracts/BooztoryToken.sol:BooztoryToken")
  const initcode     = ethers.concat([
    (TokenFactory as any).bytecode,
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [deployer.address]),
  ])
  const deployData   = CREATE2_SALT + initcode.slice(2) // salt(32) + initcode
  const deployTx     = await deployer.sendTransaction({ to: CREATE2_FACTORY, data: deployData, nonce: nextNonce() })
  await deployTx.wait()
  const tokenAddress = ethers.getCreate2Address(CREATE2_FACTORY, CREATE2_SALT, ethers.keccak256(initcode))
  const token        = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)
  console.log(`     BooztoryToken:  ${tokenAddress}`)

  // ── 3. Deploy BooztoryRaffle ────────────────────────────────────────────────
  // boozToken is constructor-only (no setter) — must redeploy if token address changes
  console.log("3/7  Deploying BooztoryRaffle...")
  const RaffleFactory = await ethers.getContractFactory("contracts/BooztoryRaffle.sol:BooztoryRaffle")
  const raffle = await RaffleFactory.deploy(
    vrfCoordinator,
    booztoryAddress,
    paymentToken,
    tokenAddress,
    VRF_SUBSCRIPTION_ID,
    keyHash,
    { nonce: nextNonce() }
  )
  await raffle.waitForDeployment()
  const raffleAddress = await raffle.getAddress()
  console.log(`     BooztoryRaffle: ${raffleAddress}`)

  // ── 4. Authorize Booztory as minter on BooztoryToken ───────────────────────
  console.log("4/7  Calling setAuthorizedMinter on BooztoryToken (Booztory)...")
  const tx4 = await token.setAuthorizedMinter(booztoryAddress, true, { nonce: nextNonce() })
  await tx4.wait()
  console.log(`     Done. (tx: ${tx4.hash})`)

  // ── 5. Authorize BooztoryRaffle as minter on BooztoryToken ─────────────────
  console.log("5/7  Calling setAuthorizedMinter on BooztoryToken (BooztoryRaffle)...")
  const tx5 = await token.setAuthorizedMinter(raffleAddress, true, { nonce: nextNonce() })
  await tx5.wait()
  console.log(`     Done. (tx: ${tx5.hash})`)

  // ── 6. setRewardToken on Booztory ──────────────────────────────────────────
  console.log("6/7  Calling setRewardToken on Booztory...")
  const tx6 = await booztory.setRewardToken(tokenAddress, { nonce: nextNonce() })
  await tx6.wait()
  console.log(`     Done. (tx: ${tx6.hash})`)

  // ── 7. setRaffle on Booztory ───────────────────────────────────────────────
  console.log("7/7  Calling setRaffle on Booztory...")
  const tx7 = await booztory.setRaffle(raffleAddress, { nonce: nextNonce() })
  await tx7.wait()
  console.log(`     Done. (tx: ${tx7.hash})`)

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
  NEXT_PUBLIC_TOKEN_ADDRESS=${tokenAddress}
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}

Next steps:
  1. Add BooztoryRaffle (${raffleAddress}) as a consumer at https://vrf.chain.link
  2. Fund the subscription with LINK
  3. Verify:
       npx hardhat verify --network ${network} ${booztoryAddress} "${paymentToken}"
       npx hardhat verify --network ${network} ${tokenAddress} "${deployer.address}"
       npx hardhat verify --network ${network} ${raffleAddress} "${vrfCoordinator}" "${booztoryAddress}" "${paymentToken}" "${tokenAddress}" ${VRF_SUBSCRIPTION_ID} "${keyHash}"
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
