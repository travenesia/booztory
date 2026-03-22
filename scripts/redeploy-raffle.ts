import hre from "hardhat"
import { ethers } from "hardhat"

// ── Chainlink VRF v2.5 ────────────────────────────────────────────────────────
const VRF_COORDINATOR_BASE    = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634"
const VRF_COORDINATOR_SEPOLIA = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE"
const KEY_HASH_BASE    = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"
const KEY_HASH_SEPOLIA = "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71"
const VRF_SUBSCRIPTION_ID = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0")

async function main() {
  const network = hre.network.name
  const isBase  = network === "base"

  const vrfCoordinator = isBase ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_SEPOLIA
  const keyHash        = isBase ? KEY_HASH_BASE        : KEY_HASH_SEPOLIA

  // ── Read existing addresses from env ────────────────────────────────────────
  const booztoryAddress = process.env.NEXT_PUBLIC_BOOZTORY_ADDRESS
  const tokenAddress    = process.env.NEXT_PUBLIC_TOKEN_ADDRESS
  const usdcAddress     = process.env.NEXT_PUBLIC_USDC_ADDRESS
  const oldRaffleAddress = process.env.NEXT_PUBLIC_RAFFLE_ADDRESS

  if (!booztoryAddress) throw new Error("NEXT_PUBLIC_BOOZTORY_ADDRESS not set in .env.local")
  if (!tokenAddress)    throw new Error("NEXT_PUBLIC_TOKEN_ADDRESS not set in .env.local")
  if (!usdcAddress)     throw new Error("NEXT_PUBLIC_USDC_ADDRESS not set in .env.local")

  if (VRF_SUBSCRIPTION_ID === 0n) {
    console.warn("⚠  VRF_SUBSCRIPTION_ID not set — raffle will deploy but cannot request randomness.")
  }

  const [deployer] = await ethers.getSigners()
  console.log(`\nRedeploying BooztoryRaffle on: ${network}`)
  console.log(`Deployer:        ${deployer.address}`)
  console.log(`Booztory:        ${booztoryAddress}`)
  console.log(`BooztoryToken:   ${tokenAddress}`)
  console.log(`USDC:            ${usdcAddress}`)
  console.log(`Old raffle:      ${oldRaffleAddress ?? "none"}`)
  console.log(`VRF coordinator: ${vrfCoordinator}`)
  console.log(`Sub ID:          ${VRF_SUBSCRIPTION_ID}\n`)

  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  // ── 1. Deploy new BooztoryRaffle ────────────────────────────────────────────
  console.log("1/4  Deploying BooztoryRaffle...")
  const RaffleFactory = await ethers.getContractFactory("contracts/BooztoryRaffle.sol:BooztoryRaffle")
  const raffle = await RaffleFactory.deploy(
    vrfCoordinator,
    booztoryAddress,
    usdcAddress,
    tokenAddress,
    VRF_SUBSCRIPTION_ID,
    keyHash,
    { nonce: await nextNonce() }
  )
  await raffle.waitForDeployment()
  const raffleAddress = await raffle.getAddress()
  console.log(`     BooztoryRaffle: ${raffleAddress}`)

  const token    = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)
  const booztory = await ethers.getContractAt("contracts/Booztory.sol:Booztory", booztoryAddress)

  // ── 2. Revoke old raffle minter rights (if exists) ──────────────────────────
  if (oldRaffleAddress) {
    console.log(`2/4  Revoking minter rights from old raffle (${oldRaffleAddress})...`)
    const tx = await token.setAuthorizedMinter(oldRaffleAddress, false, { nonce: await nextNonce() })
    await tx.wait()
    console.log(`     Done. (tx: ${tx.hash})`)
  } else {
    console.log("2/4  No old raffle address — skipping revoke.")
  }

  // ── 3. Authorize new raffle as minter on BooztoryToken ──────────────────────
  console.log("3/4  Authorizing new raffle as minter on BooztoryToken...")
  const tx2 = await token.setAuthorizedMinter(raffleAddress, true, { nonce: await nextNonce() })
  await tx2.wait()
  console.log(`     Done. (tx: ${tx2.hash})`)

  // ── 4. Point Booztory at new raffle ─────────────────────────────────────────
  console.log("4/4  Calling setRaffle on Booztory...")
  const tx3 = await booztory.setRaffle(raffleAddress, { nonce: await nextNonce() })
  await tx3.wait()
  console.log(`     Done. (tx: ${tx3.hash})`)

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  BooztoryRaffle redeployed — ${network.padEnd(28)}║
╠══════════════════════════════════════════════════════════╣
║  New raffle: ${raffleAddress}  ║
╚══════════════════════════════════════════════════════════╝

Update .env.local:
  NEXT_PUBLIC_RAFFLE_ADDRESS=${raffleAddress}

Next steps:
  1. Remove old raffle from Chainlink VRF subscription (if added)
  2. Add new raffle (${raffleAddress}) as a consumer at https://vrf.chain.link
  3. Verify:
       npx hardhat verify --network ${network} ${raffleAddress} "${vrfCoordinator}" "${booztoryAddress}" "${usdcAddress}" "${tokenAddress}" ${VRF_SUBSCRIPTION_ID} "${keyHash}"
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
