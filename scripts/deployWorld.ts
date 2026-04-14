import hre from "hardhat"
import { ethers } from "hardhat"

// ── CREATE2 factory (Arachnid) ─────────────────────────────────────────────────
// Same factory address on every EVM chain including World Chain.
// Guarantees BooztoryToken lands at the same address on World Chain as on Base.
// Same deployer wallet + same salt + same initcode = same address everywhere.
const CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C"
const CREATE2_SALT    = ethers.ZeroHash // bytes32(0)

// ── USDC addresses ────────────────────────────────────────────────────────────
const USDC_WORLD_MAINNET = "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1" // confirmed ✅
const USDC_WORLD_SEPOLIA = "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88" // confirmed ✅

// ── WLD token ─────────────────────────────────────────────────────────────────
// Same address on mainnet and Sepolia (World-issued WLD)
const WLD_TOKEN = "0x2cFc85d8E48F8EAB294be644d9E25C3030863003"

// ── Api3 oracle addresses (World Chain mainnet) ───────────────────────────────
// Source: https://market.api3.org / Api3 dAPI docs
// These are push-based proxies. read() returns (int224 price_18dec, uint32 timestamp).
const WLD_USD_ORACLE_MAINNET = "0x8Bb2943AB030E3eE05a58d9832525B4f60A97FA0"
const ETH_USD_ORACLE_MAINNET = "0xe1d72a719171DceAB9499757EB9d5AEb9e8D64A6"
// Sepolia: set to address(0) — oracles are mainnet-only; admin can setWldOracle/setEthOracle after deploy
const WLD_USD_ORACLE_SEPOLIA  = ethers.ZeroAddress
const ETH_USD_ORACLE_SEPOLIA  = ethers.ZeroAddress

// ── World ID Router ───────────────────────────────────────────────────────────
// Source: https://docs.world.org/world-id/id/on-chain
// Call setWorldId(router, appId, action) on both contracts after deploy.
// GROUP_ID is always 1 (Orb-verified humans, WorldIDRouter legacy v3).
const WORLDID_ROUTER_MAINNET = "0x17B354dD2595411ff79041f930e491A4Df39A278" // confirmed ✅
const WORLDID_ROUTER_SEPOLIA = "0x57f928158C3EE7CDad1e4D8642503c4D0201f611" // confirmed ✅

// ── Randomness ────────────────────────────────────────────────────────────────
// BooztoryRaffleWorld uses a commit-reveal scheme — no external oracle needed.
// No Chainlink VRF, WitNet, Pyth Entropy, or Gelato VRF is deployed on World Chain.

// ── Network helpers ───────────────────────────────────────────────────────────
// Run with:
//   npx hardhat run scripts/deployWorld.ts --network world-chain-sepolia
//   npx hardhat run scripts/deployWorld.ts --network world-chain
//
// world-chain and world-chain-sepolia must be added to hardhat.config.ts:
//   "world-chain": { url: "https://worldchain-mainnet.g.alchemy.com/public", chainId: 480 }
//   "world-chain-sepolia": { url: "https://worldchain-sepolia.g.alchemy.com/public", chainId: 4801 }

async function main() {
  const network   = hre.network.name
  const isMainnet = network === "world-chain"

  if (network !== "world-chain" && network !== "world-chain-sepolia") {
    throw new Error(
      `Wrong network: "${network}"\n` +
      `Run: npx hardhat run scripts/deployWorld.ts --network world-chain-sepolia\n` +
      `  or: npx hardhat run scripts/deployWorld.ts --network world-chain`
    )
  }

  const paymentToken  = isMainnet ? USDC_WORLD_MAINNET : USDC_WORLD_SEPOLIA
  const worldIdRouter = isMainnet ? WORLDID_ROUTER_MAINNET : WORLDID_ROUTER_SEPOLIA
  const wldOracle     = isMainnet ? WLD_USD_ORACLE_MAINNET : WLD_USD_ORACLE_SEPOLIA
  const ethOracle     = isMainnet ? ETH_USD_ORACLE_MAINNET : ETH_USD_ORACLE_SEPOLIA

  const [deployer] = await ethers.getSigners()
  console.log(`\nDeploying Booztory World Chain contracts`)
  console.log(`Network:        ${network} (chainId: ${isMainnet ? 480 : 4801})`)
  console.log(`Deployer:       ${deployer.address}`)
  console.log(`USDC:           ${paymentToken}`)
  console.log(`WLD token:      ${WLD_TOKEN}`)
  console.log(`WLD/USD oracle: ${wldOracle || "(not set — Sepolia)"}`)
  console.log(`ETH/USD oracle: ${ethOracle || "(not set — Sepolia)"}`)
  console.log(`WorldIDRouter:  ${worldIdRouter}`)
  console.log(`Randomness:     Commit-Reveal (no external oracle)`)
  console.log(`CREATE2 salt:   ${CREATE2_SALT}\n`)

  let _nonce = await deployer.provider!.getTransactionCount(deployer.address, "pending")
  const nextNonce = () => _nonce++

  // ── 1. Deploy BooztoryWorld ────────────────────────────────────────────────
  console.log("1/7  Deploying BooztoryWorld...")
  const BooztoryFactory = await ethers.getContractFactory("contracts/world/BooztoryWorld.sol:BooztoryWorld")
  const booztory = await BooztoryFactory.deploy(paymentToken, WLD_TOKEN, wldOracle, ethOracle, { nonce: nextNonce() })
  await booztory.waitForDeployment()
  const booztoryAddress = await booztory.getAddress()
  console.log(`     BooztoryWorld:       ${booztoryAddress}`)

  // ── 2. Deploy BooztoryToken via CREATE2 ────────────────────────────────────
  // Owner passed as constructor arg — msg.sender inside CREATE2 factory is the
  // factory itself, not the deployer EOA, so we encode the owner explicitly.
  // IMPORTANT: Uses the same BooztoryToken.sol as Base Mainnet — same bytecode +
  // same deployer + same salt = same address on World Chain as on Base.
  // This enables native BOOZ cross-chain bridging via SuperchainERC20 (IERC7802).
  //
  // Idempotent: if BooztoryToken is already deployed at this address (e.g. from a
  // previous testnet run), the CREATE2 factory does nothing. We detect this, skip
  // the deploy tx to save gas, and reuse the existing contract.
  console.log("2/7  Deploying BooztoryToken via CREATE2...")
  const TokenFactory = await ethers.getContractFactory("contracts/BooztoryToken.sol:BooztoryToken")
  const initcode     = ethers.concat([
    (TokenFactory as any).bytecode,
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [deployer.address]),
  ])
  const tokenAddress = ethers.getCreate2Address(CREATE2_FACTORY, CREATE2_SALT, ethers.keccak256(initcode))
  const existingCode = await deployer.provider!.getCode(tokenAddress)

  if (existingCode !== "0x") {
    console.log(`     BooztoryToken already deployed — skipping. (${tokenAddress})`)
  } else {
    console.log(`     (Same deployer + same salt → same address as Base Mainnet)`)
    const deployData = CREATE2_SALT + initcode.slice(2)
    const deployTx   = await deployer.sendTransaction({ to: CREATE2_FACTORY, data: deployData, nonce: nextNonce() })
    await deployTx.wait()
    console.log(`     BooztoryToken deployed. (${tokenAddress})`)
  }

  const token = await ethers.getContractAt("contracts/BooztoryToken.sol:BooztoryToken", tokenAddress)
  console.log(`     BooztoryToken:       ${tokenAddress}`)

  // ── 3. Deploy BooztoryRaffleWorld (commit-reveal, no oracle) ──────────────
  console.log("3/7  Deploying BooztoryRaffleWorld (commit-reveal randomness)...")
  const RaffleFactory = await ethers.getContractFactory("contracts/world/BooztoryRaffleWorld.sol:BooztoryRaffleWorld")
  const raffle = await RaffleFactory.deploy(
    booztoryAddress,
    paymentToken,
    tokenAddress,
    { nonce: nextNonce() }
  )
  await raffle.waitForDeployment()
  const raffleAddress = await raffle.getAddress()
  console.log(`     BooztoryRaffleWorld: ${raffleAddress}`)

  // ── 4. Authorize BooztoryWorld as minter on BooztoryToken ─────────────────
  console.log("4/7  setAuthorizedMinter(BooztoryWorld)...")
  const tx4 = await token.setAuthorizedMinter(booztoryAddress, true, { nonce: nextNonce() })
  await tx4.wait()
  console.log(`     Done. (tx: ${tx4.hash})`)

  // ── 5. Authorize BooztoryRaffleWorld as minter on BooztoryToken ────────────
  console.log("5/7  setAuthorizedMinter(BooztoryRaffleWorld)...")
  const tx5 = await token.setAuthorizedMinter(raffleAddress, true, { nonce: nextNonce() })
  await tx5.wait()
  console.log(`     Done. (tx: ${tx5.hash})`)

  // ── 6. setRewardToken on BooztoryWorld ─────────────────────────────────────
  console.log("6/7  setRewardToken on BooztoryWorld...")
  const tx6 = await booztory.setRewardToken(tokenAddress, { nonce: nextNonce() })
  await tx6.wait()
  console.log(`     Done. (tx: ${tx6.hash})`)

  // ── 7. setRaffle on BooztoryWorld ──────────────────────────────────────────
  console.log("7/7  setRaffle on BooztoryWorld...")
  const tx7 = await booztory.setRaffle(raffleAddress, { nonce: nextNonce() })
  await tx7.wait()
  console.log(`     Done. (tx: ${tx7.hash})`)

  // ── Testnet QA settings ────────────────────────────────────────────────────
  if (!isMainnet) {
    console.log("\n[Testnet] Applying QA settings: slotDuration=1h, drawThreshold=1, minUniqueEntrants=1...")
    const tqa1 = await booztory.setSlotDuration(3600, { nonce: nextNonce() })
    await tqa1.wait()
    const tqa2 = await raffle.setDefaultDrawThreshold(1, { nonce: nextNonce() })
    await tqa2.wait()
    const tqa3 = await raffle.setDefaultMinUniqueEntrants(1, { nonce: nextNonce() })
    await tqa3.wait()
    console.log("       Done.")
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  World Chain Deployment complete — ${network.padEnd(25)}║
╠══════════════════════════════════════════════════════════════╣
║  BooztoryWorld:       ${booztoryAddress}  ║
║  BooztoryToken:       ${tokenAddress}  ║
║  BooztoryRaffleWorld: ${raffleAddress}  ║
╚══════════════════════════════════════════════════════════════╝

Add to .env.local:
  NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS=${booztoryAddress}
  NEXT_PUBLIC_WORLD_TOKEN_ADDRESS=${tokenAddress}
  NEXT_PUBLIC_WORLD_RAFFLE_ADDRESS=${raffleAddress}
  NEXT_PUBLIC_WORLD_USDC_ADDRESS=${paymentToken}

Post-deploy setup (run setupWorld.ts — handles all steps):
  1. BooztoryWorld.setWorldId("${worldIdRouter}", "<YOUR_APP_ID>", "booztory-human")
  2. BooztoryRaffleWorld.setWorldId("${worldIdRouter}", "<YOUR_APP_ID>", "booztory-human")
  3. setRequireVerification(false) on both — cloud-only verification pattern (no on-chain gating)
  App ID from: https://developer.worldcoin.org → your app → App ID (format: app_xxxxxxxx)

Register in World Dev Portal (REQUIRED before any MiniKit transactions work):
  1. Go to https://developer.worldcoin.org → your mini app → "Incognito Actions" or "Contracts"
  2. Allowlist contracts: ${booztoryAddress}
                          ${raffleAddress}
  3. Allowlist ERC-20 tokens: ${paymentToken} (USDC)
                               ${WLD_TOKEN} (WLD)
                               ${tokenAddress} (BOOZ)
  4. Allowlist Permit2 tokens: ${paymentToken} (USDC) + ${WLD_TOKEN} (WLD)

Verify contracts on World Chain block explorer:
  npx hardhat verify --network ${network} ${booztoryAddress} "${paymentToken}" "${WLD_TOKEN}" "${wldOracle}" "${ethOracle}"
  npx hardhat verify --network ${network} ${tokenAddress} "${deployer.address}"
  npx hardhat verify --network ${network} ${raffleAddress} "${booztoryAddress}" "${paymentToken}" "${tokenAddress}"

No oracle / subscription needed. Commit-Reveal draw flow:
  1. Off-chain: generate secret = ethers.randomBytes(32)
                commitment = keccak256(abi.encode(secret, raffleId))
  2. commitDraw(raffleId, commitment)    ← locks commitment on-chain
  3. revealDraw(raffleId, secret)        ← reveal within 256 blocks (~8.5 min)
     Seed = keccak256(secret, blockhash(commitBlock), raffleId)
     If window expires: resetDraw(raffleId) → recommit with a new secret
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
