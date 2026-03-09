import hre from "hardhat"
import { ethers } from "hardhat"

// USDC on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
// USDC on Base Sepolia
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

async function main() {
  const network = hre.network.name
  const paymentToken = network === "base" ? USDC_BASE : USDC_SEPOLIA

  const [deployer] = await ethers.getSigners()
  console.log(`Deploying Booztory on ${network}...`)
  console.log(`  Deployer:      ${deployer.address}`)
  console.log(`  Payment token: ${paymentToken}`)

  const Factory = await ethers.getContractFactory("Booztory")
  const booztory = await Factory.deploy(paymentToken)
  await booztory.waitForDeployment()

  const address = await booztory.getAddress()
  console.log(`\nBooztory deployed at: ${address}`)
  console.log(`\nAdd to .env.local:`)
  console.log(`NEXT_PUBLIC_BOOZTORY_ADDRESS=${address}`)
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${paymentToken}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
