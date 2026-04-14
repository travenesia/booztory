import hre from "hardhat"
import { ethers } from "hardhat"

/**
 * Post-deploy configuration script for World Chain contracts.
 *
 * Run after deployWorld.ts once you have the contract addresses:
 *   npx hardhat run scripts/setupWorld.ts --network world-chain-sepolia
 *   npx hardhat run scripts/setupWorld.ts --network world-chain
 *
 * Fill in the addresses below from deployWorld.ts output before running.
 */

// ── Fill these in after running deployWorld.ts ─────────────────────────────────
const BOOZTORY_WORLD_ADDRESS  = "0x14Fb9124b2E376c250DCf73336912eD6EB6e1219"   // BooztoryWorld — World Chain Mainnet
const RAFFLE_WORLD_ADDRESS    = "0x5DED6db77ea2C0476402145A984DD32bc6cAD89C"   // BooztoryRaffleWorld — World Chain Mainnet

// ── World ID ───────────────────────────────────────────────────────────────────
// Your app ID from https://developer.worldcoin.org → your app → App ID
const WORLD_APP_ID = "app_8d4c76e0cea57e5f01c3c51699b96dac"
const WORLD_ACTION = "booztory-human" // must match action name in Developer Portal

// ── WorldIDRouter addresses (already confirmed) ────────────────────────────────
const WORLDID_ROUTER_MAINNET = "0x17B354dD2595411ff79041f930e491A4Df39A278"
const WORLDID_ROUTER_SEPOLIA = "0x57f928158C3EE7CDad1e4D8642503c4D0201f611"

// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  const network   = hre.network.name
  const isMainnet = network === "world-chain"

  if (network !== "world-chain" && network !== "world-chain-sepolia") {
    throw new Error(
      `Wrong network: "${network}"\n` +
      `Run: npx hardhat run scripts/setupWorld.ts --network world-chain-sepolia`
    )
  }

  if (!BOOZTORY_WORLD_ADDRESS || !RAFFLE_WORLD_ADDRESS) {
    throw new Error(
      "Fill in BOOZTORY_WORLD_ADDRESS and RAFFLE_WORLD_ADDRESS at the top of this file."
    )
  }

  if (!WORLD_APP_ID) {
    throw new Error(
      "Fill in WORLD_APP_ID from https://developer.worldcoin.org → your app → App ID"
    )
  }

  const worldIdRouter = isMainnet ? WORLDID_ROUTER_MAINNET : WORLDID_ROUTER_SEPOLIA
  const [deployer]    = await ethers.getSigners()

  console.log(`\nConfiguring World Chain contracts`)
  console.log(`Network:        ${network}`)
  console.log(`Deployer:       ${deployer.address}`)
  console.log(`BooztoryWorld:  ${BOOZTORY_WORLD_ADDRESS}`)
  console.log(`RaffleWorld:    ${RAFFLE_WORLD_ADDRESS}`)
  console.log(`WorldIDRouter:  ${worldIdRouter}`)
  console.log(`App ID:         ${WORLD_APP_ID}`)
  console.log(`Action:         ${WORLD_ACTION}\n`)

  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  const booztory = await ethers.getContractAt(
    "contracts/world/BooztoryWorld.sol:BooztoryWorld",
    BOOZTORY_WORLD_ADDRESS
  )
  const raffle = await ethers.getContractAt(
    "contracts/world/BooztoryRaffleWorld.sol:BooztoryRaffleWorld",
    RAFFLE_WORLD_ADDRESS
  )

  // ── 1. setWorldId on BooztoryWorld ──────────────────────────────────────────
  console.log("1/4  setWorldId on BooztoryWorld...")
  const tx1 = await booztory.setWorldId(worldIdRouter, WORLD_APP_ID, WORLD_ACTION, { nonce: nextNonce() })
  await tx1.wait()
  console.log(`     Done. (tx: ${tx1.hash})`)

  // ── 2. setWorldId on BooztoryRaffleWorld ────────────────────────────────────
  console.log("2/4  setWorldId on BooztoryRaffleWorld...")
  const tx2 = await raffle.setWorldId(worldIdRouter, WORLD_APP_ID, WORLD_ACTION, { nonce: nextNonce() })
  await tx2.wait()
  console.log(`     Done. (tx: ${tx2.hash})`)

  // ── 3. setRequireVerification(false) — cloud-only verification pattern ─────────
  // On-chain gating is disabled on both mainnet and testnet. World ID verification
  // is enforced at the session/frontend layer via useVerifyHuman + canProceed.
  console.log("3/2  setRequireVerification(false) on BooztoryWorld...")
  const tx3a = await booztory.setRequireVerification(false, { nonce: nextNonce() })
  await tx3a.wait()
  console.log(`     Done. (tx: ${tx3a.hash})`)

  const tx3b = await raffle.setRequireVerification(false, { nonce: nextNonce() })
  await tx3b.wait()
  console.log(`     Done. (tx: ${tx3b.hash})`)

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  World Chain setup complete — ${network.padEnd(26)}║
╠══════════════════════════════════════════════════════════════╣
║  WorldIDRouter set ✅                                        ║
║  externalNullifierHash computed on-chain ✅                  ║
║  requireVerification: false (cloud-only pattern) ✅          ║
╚══════════════════════════════════════════════════════════════╝

Next steps:
  1. Register contracts in Dev Portal${isMainnet ? " production" : " staging"} app:
     https://developer.worldcoin.org → your app → Contracts
  2. Update NEXT_PUBLIC_WORLD_* env vars in ${isMainnet ? "production" : ".env.local"}
  3. Verify contracts on Worldscan:
     npx hardhat verify --network ${network} ${BOOZTORY_WORLD_ADDRESS} "<USDC_ADDRESS>"
     npx hardhat verify --network ${network} ${RAFFLE_WORLD_ADDRESS} "${BOOZTORY_WORLD_ADDRESS}" "<USDC>" "<TOKEN>"
  4. ${isMainnet ? "Deploy to production" : "Start local server + ngrok:\n     pnpm dev  →  ngrok http 3000\n     Open your ngrok URL inside World App → test all flows"}
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
