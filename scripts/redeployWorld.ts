import hre from "hardhat"
import { ethers } from "hardhat"

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_WORLD_MAINNET = "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1"
const USDC_WORLD_SEPOLIA = "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88"

// ── WLD token (same on mainnet and Sepolia) ───────────────────────────────────
const WLD_TOKEN = "0x2cFc85d8E48F8EAB294be644d9E25C3030863003"

// ── Api3 oracle addresses ─────────────────────────────────────────────────────
// Mainnet: live Api3 dAPI proxies on World Chain
// Sepolia: address(0) — set via setWldOracle/setEthOracle in admin panel after deploy
const WLD_USD_ORACLE_MAINNET = "0x8Bb2943AB030E3eE05a58d9832525B4f60A97FA0"
const ETH_USD_ORACLE_MAINNET = "0xe1d72a719171DceAB9499757EB9d5AEb9e8D64A6"
const WLD_USD_ORACLE_SEPOLIA  = ethers.ZeroAddress
const ETH_USD_ORACLE_SEPOLIA  = ethers.ZeroAddress

// ── World ID Router ───────────────────────────────────────────────────────────
const WORLDID_ROUTER_MAINNET = "0x17B354dD2595411ff79041f930e491A4Df39A278"
const WORLDID_ROUTER_SEPOLIA = "0x57f928158C3EE7CDad1e4D8642503c4D0201f611"

// ── What this script does ─────────────────────────────────────────────────────
// Only BooztoryWorld.sol changed (added WLDSlotMinted event + paymentToken on DonationReceived).
// BooztoryToken and BooztoryRaffleWorld are UNTOUCHED — kept at existing addresses.
// After deploying the new BooztoryWorld, we:
//   - Revoke old BooztoryWorld minter rights on BooztoryToken
//   - Grant new BooztoryWorld minter rights on BooztoryToken
//   - Wire setRewardToken + setRaffle on the new BooztoryWorld
//   - Call setBooztory(newAddress) on the existing BooztoryRaffleWorld
//
// Run with:
//   npx hardhat run scripts/redeployWorld.ts --network world-chain-sepolia
//   npx hardhat run scripts/redeployWorld.ts --network world-chain

async function main() {
  const network   = hre.network.name
  const isMainnet = network === "world-chain"

  if (network !== "world-chain" && network !== "world-chain-sepolia") {
    throw new Error(
      `Wrong network: "${network}"\n` +
      `Run: npx hardhat run scripts/redeployWorld.ts --network world-chain-sepolia\n` +
      `  or: npx hardhat run scripts/redeployWorld.ts --network world-chain`
    )
  }

  const paymentToken = isMainnet ? USDC_WORLD_MAINNET : USDC_WORLD_SEPOLIA
  const wldOracle    = isMainnet ? WLD_USD_ORACLE_MAINNET : WLD_USD_ORACLE_SEPOLIA
  const ethOracle    = isMainnet ? ETH_USD_ORACLE_MAINNET : ETH_USD_ORACLE_SEPOLIA
  const worldIdRouter = isMainnet ? WORLDID_ROUTER_MAINNET : WORLDID_ROUTER_SEPOLIA

  // Read existing addresses from .env.local — token and raffle are kept
  const tokenAddress       = process.env.NEXT_PUBLIC_WORLD_TOKEN_ADDRESS
  const raffleAddress      = process.env.NEXT_PUBLIC_WORLD_RAFFLE_ADDRESS
  const oldBooztoryAddress = process.env.NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS

  if (!tokenAddress)  throw new Error("NEXT_PUBLIC_WORLD_TOKEN_ADDRESS not set in .env.local")
  if (!raffleAddress) throw new Error("NEXT_PUBLIC_WORLD_RAFFLE_ADDRESS not set in .env.local")

  const [deployer] = await ethers.getSigners()
  console.log(`\nRedeploying BooztoryWorld only on: ${network}`)
  console.log(`Deployer:             ${deployer.address}`)
  console.log(`Old BooztoryWorld:    ${oldBooztoryAddress ?? "none"}`)
  console.log(`BooztoryToken:        ${tokenAddress}  (kept)`)
  console.log(`BooztoryRaffleWorld:  ${raffleAddress}  (kept)`)
  console.log(`USDC:                 ${paymentToken}`)
  console.log(`WLD token:            ${WLD_TOKEN}`)
  console.log(`WLD/USD oracle:       ${wldOracle || "(not set — Sepolia)"}`)
  console.log(`ETH/USD oracle:       ${ethOracle || "(not set — Sepolia)"}\n`)

  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  const token  = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)
  const raffle = await ethers.getContractAt("contracts/world/BooztoryRaffleWorld.sol:BooztoryRaffleWorld", raffleAddress)

  // ── 1. Deploy new BooztoryWorld ───────────────────────────────────────────
  console.log("1/7  Deploying BooztoryWorld...")
  const BooztoryFactory = await ethers.getContractFactory("contracts/world/BooztoryWorld.sol:BooztoryWorld")
  const booztory = await BooztoryFactory.deploy(paymentToken, WLD_TOKEN, wldOracle, ethOracle, { nonce: nextNonce() })
  await booztory.waitForDeployment()
  const booztoryAddress = await booztory.getAddress()
  console.log(`     BooztoryWorld: ${booztoryAddress}`)

  // ── 2. Revoke old BooztoryWorld minter rights on token ───────────────────
  if (oldBooztoryAddress && oldBooztoryAddress !== ethers.ZeroAddress) {
    console.log(`2/7  Revoking old BooztoryWorld minter rights (${oldBooztoryAddress})...`)
    const tx = await token.setAuthorizedMinter(oldBooztoryAddress, false, { nonce: nextNonce() })
    await tx.wait()
    console.log(`     Done. (tx: ${tx.hash})`)
  } else {
    console.log("2/7  No old BooztoryWorld address — skipping revoke.")
    _nonce--
  }

  // ── 3. Authorize new BooztoryWorld as minter on token ────────────────────
  console.log("3/7  setAuthorizedMinter(BooztoryWorld)...")
  const tx3 = await token.setAuthorizedMinter(booztoryAddress, true, { nonce: nextNonce() })
  await tx3.wait()
  console.log(`     Done. (tx: ${tx3.hash})`)

  // ── 4. setRewardToken on new BooztoryWorld ────────────────────────────────
  console.log("4/7  setRewardToken on BooztoryWorld...")
  const tx4 = await booztory.setRewardToken(tokenAddress, { nonce: nextNonce() })
  await tx4.wait()
  console.log(`     Done. (tx: ${tx4.hash})`)

  // ── 5. setRaffle on new BooztoryWorld ─────────────────────────────────────
  console.log("5/7  setRaffle on BooztoryWorld...")
  const tx5 = await booztory.setRaffle(raffleAddress, { nonce: nextNonce() })
  await tx5.wait()
  console.log(`     Done. (tx: ${tx5.hash})`)

  // ── 6. setBooztory on existing BooztoryRaffleWorld ────────────────────────
  console.log("6/7  setBooztory on BooztoryRaffleWorld (update pointer)...")
  const tx6 = await raffle.setBooztory(booztoryAddress, { nonce: nextNonce() })
  await tx6.wait()
  console.log(`     Done. (tx: ${tx6.hash})`)

  // ── 7. Testnet QA settings ────────────────────────────────────────────────
  if (!isMainnet) {
    console.log("7/7  Testnet: slotDuration=1h...")
    const tx7 = await booztory.setSlotDuration(3600, { nonce: nextNonce() })
    await tx7.wait()
    console.log(`     Done.`)
  } else {
    console.log("7/7  Mainnet: skipping testnet settings.")
  }

  console.log("\nComplete.\n")

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Redeployed — ${network.padEnd(46)}║
╠══════════════════════════════════════════════════════════════╣
║  BooztoryWorld (new):       ${booztoryAddress}  ║
║  BooztoryRaffleWorld:       ${raffleAddress}  (unchanged) ║
║  BooztoryToken:             ${tokenAddress}  (unchanged) ║
╚══════════════════════════════════════════════════════════════╝

Update .env.local:
  NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS=${booztoryAddress}

Verify:
  npx hardhat verify --network ${network} ${booztoryAddress} "${paymentToken}" "${WLD_TOKEN}" "${wldOracle}" "${ethOracle}"

Update World Dev Portal (https://developer.worldcoin.org):
  1. Remove old contract: ${oldBooztoryAddress ?? "(none)"}
  2. Add new contract:    ${booztoryAddress}
  (BooztoryRaffleWorld allowlist unchanged — same address)

Post-deploy setup (if not already set on this chain):
  BooztoryWorld.setWorldId("${worldIdRouter}", "<YOUR_APP_ID>", "booztory-human")
  setRequireVerification(false) on BooztoryWorld

Update Goldsky subgraph:
  1. Update BooztoryWorld address in subgraph-world/subgraph.yaml (startBlock = new deploy block)
  2. goldsky subgraph deploy booztory-world/<new-version> --path ./subgraph-world
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
