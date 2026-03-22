import hre from "hardhat"
import { ethers } from "hardhat"

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_BASE    = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// ── Chainlink VRF v2.5 ────────────────────────────────────────────────────────
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

  // ── Read existing BooztoryToken address from env (not redeploying) ───────────
  const tokenAddress      = process.env.NEXT_PUBLIC_TOKEN_ADDRESS
  const oldBooztoryAddress = process.env.NEXT_PUBLIC_BOOZTORY_ADDRESS
  const oldRaffleAddress  = process.env.NEXT_PUBLIC_RAFFLE_ADDRESS

  if (!tokenAddress) throw new Error("NEXT_PUBLIC_TOKEN_ADDRESS not set in .env.local")

  if (VRF_SUBSCRIPTION_ID === 0n) {
    console.warn("⚠  VRF_SUBSCRIPTION_ID not set — BooztoryRaffle will deploy but cannot request randomness.")
  }

  const [deployer] = await ethers.getSigners()
  console.log(`\nDeploying Booztory + BooztoryRaffle on: ${network}`)
  console.log(`Deployer:         ${deployer.address}`)
  console.log(`BooztoryToken:    ${tokenAddress}  (kept — not redeployed)`)
  console.log(`Old Booztory:     ${oldBooztoryAddress ?? "none"}`)
  console.log(`Old Raffle:       ${oldRaffleAddress  ?? "none"}`)
  console.log(`USDC:             ${paymentToken}`)
  console.log(`VRF coordinator:  ${vrfCoordinator}`)
  console.log(`Sub ID:           ${VRF_SUBSCRIPTION_ID}\n`)

  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  const token = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)

  // ── 1. Deploy new Booztory ───────────────────────────────────────────────────
  console.log("1/8  Deploying Booztory...")
  const BooztoryFactory = await ethers.getContractFactory("contracts/Booztory.sol:Booztory")
  const booztory = await BooztoryFactory.deploy(paymentToken, { nonce: await nextNonce() })
  await booztory.waitForDeployment()
  const booztoryAddress = await booztory.getAddress()
  console.log(`     Booztory:       ${booztoryAddress}`)

  // ── 2. Deploy new BooztoryRaffle ─────────────────────────────────────────────
  console.log("2/8  Deploying BooztoryRaffle...")
  const RaffleFactory = await ethers.getContractFactory("contracts/BooztoryRaffle.sol:BooztoryRaffle")
  const raffle = await RaffleFactory.deploy(
    vrfCoordinator,
    booztoryAddress,
    paymentToken,
    tokenAddress,
    VRF_SUBSCRIPTION_ID,
    keyHash,
    { nonce: await nextNonce() }
  )
  await raffle.waitForDeployment()
  const raffleAddress = await raffle.getAddress()
  console.log(`     BooztoryRaffle: ${raffleAddress}`)

  // ── 3. Revoke old Booztory minter rights ─────────────────────────────────────
  if (oldBooztoryAddress) {
    console.log(`3/8  Revoking minter rights from old Booztory (${oldBooztoryAddress})...`)
    const tx = await token.setAuthorizedMinter(oldBooztoryAddress, false, { nonce: await nextNonce() })
    await tx.wait()
    console.log(`     Done. (tx: ${tx.hash})`)
  } else {
    console.log("3/8  No old Booztory address — skipping revoke.")
  }

  // ── 4. Revoke old Raffle minter rights ───────────────────────────────────────
  if (oldRaffleAddress) {
    console.log(`4/8  Revoking minter rights from old Raffle (${oldRaffleAddress})...`)
    const tx = await token.setAuthorizedMinter(oldRaffleAddress, false, { nonce: await nextNonce() })
    await tx.wait()
    console.log(`     Done. (tx: ${tx.hash})`)
  } else {
    console.log("4/8  No old Raffle address — skipping revoke.")
  }

  // ── 5. Authorize new Booztory as minter on BooztoryToken ─────────────────────
  console.log("5/8  Authorizing new Booztory as minter on BooztoryToken...")
  const tx5 = await token.setAuthorizedMinter(booztoryAddress, true, { nonce: await nextNonce() })
  await tx5.wait()
  console.log(`     Done. (tx: ${tx5.hash})`)

  // ── 6. Authorize new Raffle as minter on BooztoryToken ───────────────────────
  console.log("6/8  Authorizing new Raffle as minter on BooztoryToken...")
  const tx6 = await token.setAuthorizedMinter(raffleAddress, true, { nonce: await nextNonce() })
  await tx6.wait()
  console.log(`     Done. (tx: ${tx6.hash})`)

  // ── 7. setRewardToken on new Booztory ────────────────────────────────────────
  console.log("7/8  Calling setRewardToken on Booztory...")
  const tx7 = await booztory.setRewardToken(tokenAddress, { nonce: await nextNonce() })
  await tx7.wait()
  console.log(`     Done. (tx: ${tx7.hash})`)

  // ── 8. setRaffle on new Booztory ─────────────────────────────────────────────
  console.log("8/8  Calling setRaffle on Booztory...")
  const tx8 = await booztory.setRaffle(raffleAddress, { nonce: await nextNonce() })
  await tx8.wait()
  console.log(`     Done. (tx: ${tx8.hash})`)

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Deployment complete — ${network.padEnd(33)}║
╠══════════════════════════════════════════════════════════╣
║  Booztory:       ${booztoryAddress}  ║
║  BooztoryToken:  ${tokenAddress}  (unchanged)      ║
║  BooztoryRaffle: ${raffleAddress}  ║
╚══════════════════════════════════════════════════════════╝

Update .env.local:
  NEXT_PUBLIC_BOOZTORY_ADDRESS=${booztoryAddress}
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}

Next steps:
  1. Remove old raffle from Chainlink VRF subscription (if added)
  2. Add new raffle (${raffleAddress}) as a consumer at https://vrf.chain.link
  3. Verify:
       npx hardhat verify --network ${network} ${booztoryAddress} "${paymentToken}"
       npx hardhat verify --network ${network} ${raffleAddress} "${vrfCoordinator}" "${booztoryAddress}" "${paymentToken}" "${tokenAddress}" ${VRF_SUBSCRIPTION_ID} "${keyHash}"
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
