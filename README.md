# Booztory

**Booztory** is a decentralized content spotlight built on [Base](https://base.org). Pay 1 USDC to feature your content — YouTube, TikTok, X, Spotify, Vimeo, or Twitch — in a live 15-minute slot. Each slot is minted as an ERC-721 token. Fans can support creators directly through on-chain USDC donations. Minters earn **BOOZ** reward tokens, build daily GM streaks, and are entered into a weekly **Chainlink VRF raffle**. No algorithms. No gatekeepers. No database.

> Currently live on **Base Sepolia Testnet** · Mainnet launch coming soon.

---

## How It Works

1. Connect your Web3 wallet
2. Submit a content URL and approve 1 USDC
3. Your slot is minted as an ERC-721 token and added to the on-chain queue
4. You earn **1,000 BOOZ** reward tokens and one raffle entry per mint
5. Content goes live for 15 minutes when it reaches the front of the queue
6. Viewers can send USDC donations directly to the creator (95% to creator, 5% protocol fee)
7. Weekly raffle winners are drawn via Chainlink VRF and paid out in USDC automatically
8. Claim your daily GM streak for additional BOOZ — up to 10,000 BOOZ over a 90-day journey

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS |
| Wallet | wagmi v2 · RainbowKit · viem |
| Auth | NextAuth 4 · SIWE (Sign-In with Ethereum) |
| Mini App | Farcaster Mini App SDK (`@farcaster/miniapp-sdk`) · Farcaster QuickAuth |
| Smart Contracts | Solidity 0.8.28 · OpenZeppelin · Hardhat 2.28.6 |
| Randomness | Chainlink VRF v2.5 |
| Chain | Base (8453) · Base Sepolia (84532) |
| Identity | ENS · Basenames |

---

## Supported Content Platforms

| Platform | Status |
|---|---|
| YouTube & YouTube Shorts | ✅ Live |
| X (Twitter) | ✅ Live |
| TikTok | ✅ Live |
| Spotify | ✅ Live |
| Vimeo | ✅ Live |
| Twitch | ✅ Live |
| Instagram | 🔜 Coming soon |
| Custom uploads | 🔜 Coming soon |

---

## Project Structure

```
booztory/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home — live content, countdown, donation modal
│   ├── history/page.tsx    # Past content with infinite scroll
│   ├── upcoming/page.tsx   # Queued content with infinite scroll
│   ├── reward/page.tsx     # BOOZ balance, GM streak, raffle entries, weekly draw
│   ├── faq/page.tsx        # FAQ accordion
│   └── api/                # API routes (nonce, SIWE, tweet data, TikTok resolver)
├── components/
│   ├── content/            # ContentCard, ContentEmbed, HistoryCard, UpcomingCard
│   ├── layout/             # Navbar, Topbar, PageTopbar, ScrollToTop, UsersOnline
│   ├── modals/             # SubmitContent drawer, DonationModal, GMModal
│   ├── wallet/             # ConnectWallet button, WalletDropdown
│   └── embeds/             # YouTube, TikTok, Twitter, Vimeo, Spotify, Twitch embeds
├── contracts/
│   ├── Booztory.sol        # ERC-721 slot contract with donation and reward hooks
│   ├── BooztoryToken.sol   # BOOZ ERC-20 reward token (SuperchainERC20 / IERC7802)
│   └── BooztoryRaffle.sol  # Weekly raffle powered by Chainlink VRF v2.5
├── hooks/                  # useContractContent, usePayment, useDonation, useWalletName
├── lib/                    # Contract ABI, wagmi config, cache, metadata fetchers
├── providers/              # WagmiProvider, SessionProvider
└── scripts/
    └── deploy.ts           # Hardhat deploy script (all 3 contracts + wiring)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- A WalletConnect Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com)

### 1. Clone and install

```bash
git clone https://github.com/your-username/booztory.git
cd booztory
pnpm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# App URL
NEXT_PUBLIC_URL=http://localhost:3000

# NextAuth
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000

# Alchemy API key — https://dashboard.alchemy.com
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key

# WalletConnect — https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Contract addresses (set after deployment — see Smart Contract section)
NEXT_PUBLIC_BOOZTORY_ADDRESS=
NEXT_PUBLIC_RAFFLE_ADDRESS=
NEXT_PUBLIC_TOKEN_ADDRESS=

# USDC token address
# Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
# Base Sepolia:  0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Deployer private key (for Hardhat scripts only — never expose)
PRIVATE_KEY=0x...

# Chainlink VRF subscription ID — https://vrf.chain.link
VRF_SUBSCRIPTION_ID=

# Basescan API key — https://basescan.org/apis
BASESCAN_API_KEY=
```

### 3. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Smart Contracts

Three contracts deployed together and wired up:

| Contract | Description |
|---|---|
| `Booztory.sol` | ERC-721 slot minting, donations, reward wiring, GM streak |
| `BooztoryToken.sol` | BOOZ ERC-20 reward token (soulbound Phase 1, SuperchainERC20-ready) |
| `BooztoryRaffle.sol` | Weekly raffle with Chainlink VRF v2.5 randomness |

### Compile

```bash
npx hardhat compile
```

### Deploy

The deploy script handles all 6 steps automatically:
1. Deploy `Booztory`
2. Deploy `BooztoryToken` via CREATE2 factory (deterministic address across chains)
3. Deploy `BooztoryRaffle`
4. `BooztoryToken.setBooztory(booztoryAddress)`
5. `Booztory.setRewardToken(tokenAddress)`
6. `Booztory.setRaffle(raffleAddress)`

**Before deploying**, make sure `.env.local` contains:
- `PRIVATE_KEY` — deployer wallet private key
- `VRF_SUBSCRIPTION_ID` — your Chainlink VRF subscription ID (from [vrf.chain.link](https://vrf.chain.link))

**Base Sepolia (testnet):**
```bash
npx hardhat run scripts/deploy.ts --network base-sepolia
```

**Base Mainnet:**
```bash
npx hardhat run scripts/deploy.ts --network base
```

The script prints all deployed addresses and the exact `.env.local` values to copy:

```
╔══════════════════════════════════════════════════════════╗
║  Deployment complete — base-sepolia                      ║
╠══════════════════════════════════════════════════════════╣
║  Booztory:       0x...                                   ║
║  BooztoryToken:  0x...                                   ║
║  BooztoryRaffle: 0x...                                   ║
╚══════════════════════════════════════════════════════════╝
```

Copy the three addresses into `.env.local`:

```env
NEXT_PUBLIC_BOOZTORY_ADDRESS=0x...
NEXT_PUBLIC_RAFFLE_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
```

### Post-deploy: Chainlink VRF setup

After deploying, add `BooztoryRaffle` as a consumer on your VRF subscription:

1. Go to [vrf.chain.link](https://vrf.chain.link)
2. Open your subscription
3. Click **Add consumer** and paste the `BooztoryRaffle` address
4. Ensure the subscription is funded with LINK

Without this step, the raffle contract cannot request randomness.

### Verify on Basescan

Make sure `BASESCAN_API_KEY` is set in `.env.local`, then run:

**Booztory:**
```bash
npx hardhat verify --network base-sepolia <BOOZTORY_ADDRESS> "<USDC_ADDRESS>"
```

**BooztoryToken** — requires the deployer address as constructor argument:
```bash
npx hardhat verify --network base-sepolia <TOKEN_ADDRESS> "<DEPLOYER_ADDRESS>"
```

**BooztoryRaffle:**
```bash
npx hardhat verify --network base-sepolia <RAFFLE_ADDRESS> \
  "<VRF_COORDINATOR>" \
  "<BOOZTORY_ADDRESS>" \
  "<USDC_ADDRESS>" \
  <VRF_SUBSCRIPTION_ID> \
  "<KEY_HASH>"
```

VRF coordinator and key hash constants (30 gwei gas lane):

| Network | VRF Coordinator | Key Hash |
|---|---|---|
| Base Mainnet | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` | `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71` |
| Base Sepolia | `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` | `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71` |

> **Tip:** The deploy script output also prints the exact verify commands for all three contracts with the correct arguments filled in.

---

## Deployed Addresses

### Base Sepolia (Testnet)

| Contract | Address |
|---|---|
| Booztory | `0x9D644381cd8bFA5fdba46C94BdB2A131aaeEF892` |
| BooztoryToken (BOOZ) | `0x3b3C0EF1f9072A435BE1B5860d674e9E0e47FAfE` |
| BooztoryRaffle | `0xee7a205dA0D3E16ca9384Feb1852A78aBf34285e` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

### Base Mainnet

| Contract | Address |
|---|---|
| Booztory | _pending mainnet deployment_ |
| BooztoryToken (BOOZ) | _pending mainnet deployment_ |
| BooztoryRaffle | _pending mainnet deployment_ |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

---

## Key Contract Functions

### Booztory.sol

| Function | Description |
|---|---|
| `mintSlot(url, type, ratio, title, author, imageUrl)` | Pay slotPrice USDC → mint ERC-721 slot, earn 1,000 BOOZ, add raffle entry |
| `mintSlotWithDiscount(...)` | Burn 1,000 BOOZ → pay 0.9 USDC, still earn 1,000 BOOZ + raffle entry |
| `mintSlotWithTokens(...)` | Burn 10,000 BOOZ → free slot, no BOOZ earned, no raffle entry |
| `donate(tokenId, amount)` | Send USDC to creator (95%) + protocol fee (5%) |
| `claimDailyGM()` | Claim daily GM streak reward — earns BOOZ, one claim per UTC day |
| `getCurrentSlot()` | Returns the currently live slot |
| `getUpcomingSlots()` | Returns all queued slots in order |
| `getPastSlots(offset, limit)` | Returns past slots, newest first |
| `withdraw()` | Owner withdraws accumulated fees |
| `setSlotPrice(uint256)` | Owner — update slot price |
| `setSlotDuration(uint256)` | Owner — update slot duration (default: 900s = 15 min) |
| `setRewardToken(address)` | Owner — set BOOZ token address |
| `setRaffle(address)` | Owner — set raffle contract address |

### BooztoryToken.sol (BOOZ)

| Function | Description |
|---|---|
| `mintReward(address, uint256)` | Booztory only — mint BOOZ to a user |
| `burnFrom(address, uint256)` | Booztory only — burn BOOZ for free slot / discount redemption |
| `burn(uint256)` | Any holder — voluntarily burn own tokens |
| `setSoulbound(bool)` | Owner — toggle soulbound mode (Phase 1 → Phase 2) |
| `setBooztory(address)` | Owner — set authorized Booztory contract |
| `mintTreasury(address, uint256)` | Owner — one-time treasury mint (max 10M BOOZ) |
| `crosschainMint(address, uint256)` | Superchain bridge only — mint on bridge-in |
| `crosschainBurn(address, uint256)` | Superchain bridge only — burn on bridge-out (blocked while soulbound) |

### BooztoryRaffle.sol

| Function | Description |
|---|---|
| `addEntry(address)` | Booztory only — add one raffle entry per paid mint |
| `requestWeeklyDraw(uint256 week)` | Owner — trigger VRF randomness request |
| `setPrizes(amounts[])` | Owner — set prize tiers in USDC |
| `setDrawThreshold(uint256)` | Owner — minimum entries to allow a draw |

---

## BOOZ Reward Token

**BOOZ** is the native reward token of Booztory. It is earned by participating in the platform — no purchase required.

| Action | Reward |
|---|---|
| Mint a slot (1 USDC) | 1,000 BOOZ |
| GM streak Day 1–7 | 5 / 10 / 15 / 20 / 25 / 30 / 35 BOOZ |
| GM streak Days 8–90 | 50 BOOZ/day |
| Milestone Day 7 (Warrior) | +50 BOOZ |
| Milestone Day 14 (Elite) | +250 BOOZ |
| Milestone Day 30 (Epic) | +350 BOOZ |
| Milestone Day 60 (Legend) | +500 BOOZ |
| Milestone Day 90 (Mythic) | +4,560 BOOZ |

**Burn sinks:**
- Burn 10,000 BOOZ → free slot (no USDC needed, no raffle entry)
- Burn 1,000 BOOZ → discounted slot (0.9 USDC, still earns BOOZ + raffle entry)

Complete the full 90-day GM journey = 10,000 BOOZ = exactly 1 free slot.

**Phase 1:** Soulbound — no trading, no farming incentive.
**Phase 2:** `setSoulbound(false)` → transfers enabled, seed Uniswap v3 BOOZ/USDC pool from treasury.

---

## Authentication Flow

1. Wallet connects → nonce fetched from `/api/nonce`
2. Frontend builds a [SIWE](https://login.xyz/) message and prompts user to sign
3. Signature verified via NextAuth credentials provider
4. JWT session created: `{ userId: address, walletAddress, username }`
5. No database — wallet address is the user identity
6. **Farcaster Mini App:** QuickAuth via `sdk.quickAuth.getToken()` replaces SIWE automatically

---

## Development Commands

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build (also type-checks)
pnpm lint         # Run ESLint

npx hardhat compile                                          # Compile contracts
npx hardhat run scripts/deploy.ts --network base-sepolia    # Deploy to testnet
npx hardhat run scripts/deploy.ts --network base            # Deploy to mainnet
```

> No test runner is configured. Use `pnpm build` to catch TypeScript errors.

---

## Roadmap

- [x] ERC-721 slot contract
- [x] wagmi + RainbowKit wallet connection
- [x] SIWE authentication
- [x] Farcaster Mini App + QuickAuth
- [x] Content submission — standard, discount, and free (token burn) paths
- [x] Donation flow (approve + donate, 95/5 split)
- [x] ENS + Basename display
- [x] YouTube, TikTok, X, Spotify, Vimeo, Twitch embeds
- [x] History & Upcoming pages
- [x] BOOZ reward token (ERC-20, soulbound Phase 1)
- [x] Daily GM streak (90-day journey, on-chain)
- [x] Weekly raffle (Chainlink VRF v2.5)
- [x] Reward page (`/reward`) — BOOZ balance, streak, raffle entries
- [x] SuperchainERC20 / IERC7802 support (cross-chain ready)
- [x] Skeleton loading states across all pages
- [x] Mobile drawer (Vaul) for GM streak — safe-area safe on all devices
- [x] Base Sepolia deployment (Booztory + BooztoryToken)
- [ ] BooztoryRaffle redeployment to Base Sepolia (weeklyPrizes snapshot fix)
- [ ] Set content type images on-chain (`setContentTypeImage`)
- [ ] Verify all 3 contracts on Basescan
- [ ] Base Mainnet deployment
- [ ] BOOZ Phase 2 — trading enabled, DEX liquidity
- [ ] World Chain deployment (World Mini App)
- [ ] Superchain expansion (OP Mainnet, etc.)
- [ ] Creator analytics dashboard
- [ ] Rate limiting on API endpoints
- [ ] Instagram and custom upload support

---

## License

MIT
