import hre from "hardhat"
import { ethers } from "hardhat"

// ── Addresses from the partial deploy ─────────────────────────────────────────
const BOOZTORY_ADDRESS = "0xF94E370201E9C3FaDDA1d61Ee7797E7592964b68"
const TOKEN_ADDRESS    = "0x02A2830552Da5caA0173a0fcbbc005FC70339855"

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// ── Chainlink VRF v2.5 coordinator addresses ──────────────────────────────────
const VRF_COORDINATOR_BASE    = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
const VRF_COORDINATOR_SEPOLIA = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE"

const KEY_HASH_BASE    = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"
const KEY_HASH_SEPOLIA = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"

const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0")

async function main() {
  const network = hre.network.name
  const isBase  = network === "base"

  const paymentToken   = isBase ? USDC_BASE         : USDC_SEPOLIA
  const vrfCoordinator = isBase ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_SEPOLIA
  const keyHash        = isBase ? KEY_HASH_BASE     : KEY_HASH_SEPOLIA

  const [deployer] = await ethers.getSigners()
  console.log(`\nContinuing deployment on: ${network}`)
  console.log(`Deployer:      ${deployer.address}`)
  console.log(`Booztory:      ${BOOZTORY_ADDRESS}  (already deployed)`)
  console.log(`BooztoryToken: ${TOKEN_ADDRESS}  (already deployed)`)
  console.log(`Sub ID:        ${VRF_SUBSCRIPTION_ID}\n`)

  // Read nonce once from "pending" (includes mempool), then increment locally.
  // Avoids RPC propagation lag where "latest" hasn't updated yet after a confirmed tx.
  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  const booztory = await ethers.getContractAt("contracts/Booztory.sol:Booztory", BOOZTORY_ADDRESS)
  const token    = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", TOKEN_ADDRESS)

  // ── 3. Deploy BooztoryRaffle ────────────────────────────────────────────────
  console.log("3/7  Deploying BooztoryRaffle...")
  const RaffleFactory = await ethers.getContractFactory("contracts/BooztoryRaffle.sol:BooztoryRaffle")
  const raffle = await RaffleFactory.deploy(
    vrfCoordinator,
    BOOZTORY_ADDRESS,
    paymentToken,
    TOKEN_ADDRESS,
    VRF_SUBSCRIPTION_ID,
    keyHash,
    { nonce: await nextNonce() }
  )
  await raffle.waitForDeployment()
  const raffleAddress = await raffle.getAddress()
  console.log(`     BooztoryRaffle: ${raffleAddress}`)

  // ── 4. Wire: authorize Booztory as minter on BooztoryToken ─────────────────
  console.log("4/7  Calling setAuthorizedMinter on BooztoryToken (Booztory)...")
  const tx0 = await token.setAuthorizedMinter(BOOZTORY_ADDRESS, true, { nonce: await nextNonce() })
  await tx0.wait()
  console.log(`     Done. (tx: ${tx0.hash})`)

  // ── 5. Wire: authorize BooztoryRaffle as minter on BooztoryToken ────────────
  console.log("5/7  Calling setAuthorizedMinter on BooztoryToken (BooztoryRaffle)...")
  const tx0b = await token.setAuthorizedMinter(raffleAddress, true, { nonce: await nextNonce() })
  await tx0b.wait()
  console.log(`     Done. (tx: ${tx0b.hash})`)

  // ── 6. Wire: setRewardToken ─────────────────────────────────────────────────
  console.log("6/7  Calling setRewardToken on Booztory...")
  const tx1 = await booztory.setRewardToken(TOKEN_ADDRESS, { nonce: await nextNonce() })
  await tx1.wait()
  console.log(`     Done. (tx: ${tx1.hash})`)

  // ── 7. Wire: setRaffle ──────────────────────────────────────────────────────
  console.log("7/7  Calling setRaffle on Booztory...")
  const tx2 = await booztory.setRaffle(raffleAddress, { nonce: await nextNonce() })
  await tx2.wait()
  console.log(`     Done. (tx: ${tx2.hash})`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Deployment complete — ${network.padEnd(33)}║
╠══════════════════════════════════════════════════════════╣
║  Booztory:       ${BOOZTORY_ADDRESS}  ║
║  BooztoryToken:  ${TOKEN_ADDRESS}  ║
║  BooztoryRaffle: ${raffleAddress}  ║
╚══════════════════════════════════════════════════════════╝

Add to .env.local:
  NEXT_PUBLIC_BOOZTORY_ADDRESS=${BOOZTORY_ADDRESS}
  NEXT_PUBLIC_USDC_ADDRESS=${paymentToken}
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}
  NEXT_PUBLIC_TOKEN_ADDRESS=${TOKEN_ADDRESS}

Next steps:
  1. Add BooztoryRaffle (${raffleAddress}) as a consumer on your Chainlink VRF subscription
  2. Fund the subscription with LINK at https://vrf.chain.link
  3. Run verification:
       npx hardhat verify --network ${network} ${BOOZTORY_ADDRESS} "${paymentToken}"
       npx hardhat verify --network ${network} ${TOKEN_ADDRESS} "${deployer.address}"
       npx hardhat verify --network ${network} ${raffleAddress} "${vrfCoordinator}" "${BOOZTORY_ADDRESS}" "${paymentToken}" "${TOKEN_ADDRESS}" ${VRF_SUBSCRIPTION_ID} "${keyHash}"
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
