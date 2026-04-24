# Booztory

**Booztory** is a decentralized content spotlight built on [Base](https://base.org) and [World Chain](https://world.org). Pay 1 USDC to feature your content — YouTube, TikTok, X, Spotify, Vimeo, or Twitch — in a live 15-minute slot. Each slot is minted as an ERC-721 token. Fans can support creators directly through on-chain USDC donations. Minters earn **BOOZ** reward tokens, build daily GM streaks, and are entered into a weekly raffle. No algorithms. No gatekeepers. No database.

> **Live on Base Mainnet** · **Live as World Mini App** · [booztory.com](https://www.booztory.com)

---

## Core Loop

```
Connect wallet
    ↓
Submit content URL + approve 1 USDC
    ↓
Slot minted as ERC-721 — enters the queue
    ↓
Earn 1,000 BOOZ + 1 raffle entry
    ↓
Content goes live for 15 min when it reaches the front
    ↓
Viewers donate USDC directly to creator (on-chain split)
    ↓
Claim daily GM streak → earn more BOOZ
    ↓
Weekly raffle → USDC prizes paid on-chain
    (Base: Chainlink VRF v2.5 · World Chain: commit-reveal randomness)
```

---

## What's On-Chain

Everything core to the product:

- **Slot metadata** — URL, type, title, author, thumbnail, times — stored in ERC-721 struct
- **Queue management** — `queueEndTime` schedules slots without any off-chain coordination
- **Payments** — USDC `approve` + `mintSlot` in two transactions
- **Donations** — atomic 95/5 split in a single `donate()` call
- **BOOZ minting and burning** — triggered by contract, no off-chain scheduler
- **GM streak** — day counter via `block.timestamp / 1 days`, milestones via bitmask
- **Raffle entries** — added per paid mint; winner selection via Chainlink VRF
- **History and discovery** — `getCurrentSlot()`, `getUpcomingSlots()`, `getPastSlots()` are pure on-chain reads
- **Token metadata** — `tokenURI()` returns on-chain base64-encoded JSON

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS |
| Wallet | wagmi v2 · RainbowKit · viem |
| Auth | NextAuth 4 · SIWE · Farcaster QuickAuth · World wallet auth |
| Mini Apps | Farcaster Mini App SDK · World MiniKit (`@worldcoin/minikit-js`) |
| Smart Contracts | Solidity 0.8.28 · OpenZeppelin · Hardhat 2.28.6 |
| Randomness | Chainlink VRF v2.5 (Base) · Commit-reveal (World Chain) |
| Chain | Base (8453) · World Chain (480) |
| Identity | ENS · Basenames · Farcaster · World ID (`useIdentity`) |
| Subgraph | The Graph (Base) · Goldsky (World Chain) |

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
| Instagram | — |
| Custom uploads | — |

---

## Project Structure

```
booztory/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home — live content, countdown, donation modal
│   ├── history/page.tsx    # Past content with infinite scroll
│   ├── upcoming/page.tsx   # Queued content with infinite scroll
│   ├── reward/page.tsx     # BOOZ balance, GM streak, raffle entries, weekly draw
│   ├── leaderboard/page.tsx # 6-category leaderboard with podium
│   ├── sponsor/page.tsx    # Sponsor application form and ad schedule
│   ├── stats/page.tsx      # Platform-wide stats
│   ├── profile/[address]/page.tsx # Per-wallet profile and activity feed
│   ├── faq/page.tsx        # FAQ accordion
│   ├── admin/
│   │   ├── base/           # Base Mainnet admin (owner-gated, auto chain switch to 8453)
│   │   │   ├── page.tsx    # Overview
│   │   │   ├── raffle/     # Raffle management + sponsor accept/reject (Base)
│   │   │   ├── sponsors/   # Sponsor applications (Base)
│   │   │   ├── nft/        # NFT Pass management
│   │   │   ├── token/      # BOOZ token admin
│   │   │   └── contract/   # All Base contract setters
│   │   └── world/          # World Chain admin (owner-gated, auto chain switch to 480)
│   │       ├── page.tsx    # Overview
│   │       ├── raffle/     # Commit-reveal draw + createRaffle + sponsor accept/reject (World)
│   │       ├── sponsors/   # Sponsor applications (World)
│   │       ├── verification/ # World ID verification controls
│   │       ├── token/      # BOOZ token admin (World Chain)
│   │       └── contract/   # All World contract setters
│   └── api/                # API routes (nonce, SIWE, tweet data, TikTok resolver, World ID verify)
├── components/
│   ├── admin/              # AdminSidebar (Base admin)
│   ├── content/            # ContentCard, ContentEmbed, HistoryCard, UpcomingCard
│   ├── layout/             # Navbar, Topbar, PageTopbar, AdGuard, ScrollToTop, UsersOnline
│   ├── modals/             # SubmitContent drawer, DonationModal, GMModal
│   ├── wallet/             # ConnectWallet button, WalletDropdown
│   ├── world/              # WorldIDVerifyButton, WorldSidebar (World admin)
│   └── embeds/             # YouTube, TikTok, Twitter, Vimeo, Spotify, Twitch embeds
├── contracts/
│   ├── Booztory.sol        # ERC-721 slot contract with donation and reward hooks
│   ├── BooztoryToken.sol   # BOOZ ERC-20 reward token (SuperchainERC20 / IERC7802)
│   ├── BooztoryRaffle.sol  # Weekly raffle powered by Chainlink VRF v2.5
│   └── world/              # BooztoryWorld.sol + BooztoryRaffleWorld.sol (World Chain)
├── hooks/                  # useContractContent, usePayment, useDonation, usePaymentWorld,
│                           # useDonationWorld, useVerifyHuman, useIdentity, useWalletName
├── lib/                    # contract.ts (Base ABI), contractWorld.ts (World ABI), wagmi config, cache
├── providers/              # WagmiProvider, SessionProvider, MiniKitClientProvider
├── subgraph-world/         # Goldsky subgraph for World Chain indexing
└── scripts/
    ├── deploy.ts           # Hardhat deploy (Base — all 3 contracts + wiring)
    ├── redeployBase.ts     # Hardhat redeploy (Base — BooztoryRaffle only, keeps Booztory + token)
    ├── deployWorld.ts      # Hardhat deploy (World Chain)
    └── setupWorld.ts       # Post-deploy World Chain config
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
NEXT_PUBLIC_USDC_ADDRESS=

# Deployer private key (for Hardhat scripts only — never expose)
PRIVATE_KEY=0x...

# Chainlink VRF subscription ID — https://vrf.chain.link
VRF_SUBSCRIPTION_ID=

# Basescan API key — https://basescan.org/apis
BASESCAN_API_KEY=

# Upstash Redis — rate limiting + World ID verified state (https://upstash.com)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# The Graph subgraph endpoint (Base)
SUBGRAPH_URL=

# ── World Mini App (optional — only needed for World Chain path) ──────────────
NEXT_PUBLIC_WORLD_APP_ID=            # from developer.worldcoin.org (format: app_xxxxxxxx)
NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS=  # BooztoryWorld on World Chain
NEXT_PUBLIC_WORLD_RAFFLE_ADDRESS=    # BooztoryRaffleWorld on World Chain
NEXT_PUBLIC_WORLD_TOKEN_ADDRESS=     # BOOZ on World Chain (CREATE2 — same address as Base)
NEXT_PUBLIC_WORLD_USDC_ADDRESS=      # USDC on World Chain: 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1
WORLD_RP_ID=                         # RP identifier from developer.worldcoin.org (rp_...)
WORLD_RP_SIGNING_KEY=                # ECDSA private key from Dev Portal (server-side only)
WORLD_SUBGRAPH_URL=                  # Goldsky subgraph endpoint for World Chain
```

### 3. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Smart Contracts

### Base Contracts

| Contract | Description |
|---|---|
| `Booztory.sol` | ERC-721 slot minting, donations, reward wiring, GM streak |
| `BooztoryToken.sol` | BOOZ ERC-20 reward token (soulbound Phase 1, SuperchainERC20-ready) |
| `BooztoryRaffle.sol` | Weekly raffle with Chainlink VRF v2.5 randomness |

### World Chain Contracts

| Contract | Description |
|---|---|
| `contracts/world/BooztoryWorld.sol` | ERC-721 slot contract for World Chain — same core as Base + World ID cloud verification |
| `contracts/world/BooztoryRaffleWorld.sol` | Raffle for World Chain — commit-reveal randomness (no Chainlink VRF) |
| `BooztoryToken.sol` | Shared — same address on World Chain via CREATE2 |

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
npx hardhat verify --network base <BOOZTORY_ADDRESS> "<USDC_ADDRESS>"
```

**BooztoryToken** — requires the deployer address as constructor argument:
```bash
npx hardhat verify --network base <TOKEN_ADDRESS> "<DEPLOYER_ADDRESS>"
```

**BooztoryRaffle:**
```bash
npx hardhat verify --network base <RAFFLE_ADDRESS> \
  "<VRF_COORDINATOR>" \
  "<BOOZTORY_ADDRESS>" \
  "<USDC_ADDRESS>" \
  <VRF_SUBSCRIPTION_ID> \
  "<KEY_HASH>"
```

VRF coordinator and key hash constants (30 gwei gas lane):

| Network | VRF Coordinator | Key Hash |
|---|---|---|
| Base Mainnet | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` | `0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70` |
| Base Sepolia | `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` | `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71` |

> **Tip:** The deploy script output also prints the exact verify commands for all three contracts with the correct arguments filled in.

---

## Deployed Addresses

### Base Mainnet ✅ Live

| Contract | Address |
|---|---|
| Booztory | `0x59d764E631C3382cd89B104BF1e4846053Be5c35` |
| BooztoryToken (BOOZ) | `0x749fd925485B70190f03afa8676Bb22b5060E990` |
| BooztoryRaffle | `0x8AD73ba2C5a0BEa7E22B78081441ABA6c80A602a` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### World Chain Mainnet (480) ✅ Live

| Contract | Address |
|---|---|
| BooztoryWorld | `0x14Fb9124b2E376c250DCf73336912eD6EB6e1219` |
| BooztoryToken (BOOZ) | `0x48A7199f8ebFBFd108cE497cCe582c410D40d5D9` |
| BooztoryRaffleWorld | `0x5DED6db77ea2C0476402145A984DD32bc6cAD89C` |
| USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` |
| WLD | `0x2cFc85d8E48F8EAB294be644d9E25C3030863003` |

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
| `setAuthorizedMinter(address, bool)` | Owner — grant/revoke minting rights (Booztory + Raffle) |
| `mintTreasury(address, uint256)` | Owner — tranche treasury mint (max 10M BOOZ cumulative) |
| `crosschainMint(address, uint256)` | Superchain bridge only — mint on bridge-in |
| `crosschainBurn(address, uint256)` | Superchain bridge only — burn on bridge-out (blocked while soulbound) |

### BooztoryRaffle.sol

| Function | Description |
|---|---|
| `createRaffle(tokens, amounts[][], winnerCount, duration)` | Owner — create raffle with per-winner prize breakdown |
| `enterRaffle(raffleId, ticketAmount)` | User — burn tickets to enter, weighted draw |
| `triggerDraw(raffleId)` | Owner — request Chainlink VRF randomness after endTime + thresholds met |
| `cancelRaffle(raffleId)` | Owner — cancel active raffle; tickets auto-refunded to all entrants |
| `depositPrize(token, amount)` | Anyone — deposit ERC-20 prize (not needed for BOOZ) |
| `submitApplication(adType, content, link, duration)` | Sponsor — submit sponsorship application |
| `acceptApplication(appId)` | Owner — accept sponsor, auto-chains ad schedule |
| `rejectApplication(appId)` | Owner — reject and refund sponsor |
| `claimRefund(appId)` | Sponsor — trustless refund after 30-day timeout |
| `creditTickets(address, uint256)` | Booztory only — credit raffle tickets from points conversion |
| `setDefaultDrawThreshold(uint256)` | Owner — minimum total tickets for draw |
| `setDefaultMinUniqueEntrants(uint256)` | Owner — minimum unique wallets for draw |
| `setRaffleThresholds(raffleId, threshold, minUnique)` | Owner — override thresholds on a specific raffle |
| `setPriceTier(duration, minPrize, fee)` | Owner — configure sponsorship price tier |
| `setVrfConfig(subId, keyHash, gasLimit, confirmations)` | Owner — update VRF parameters |
| `withdraw(token)` | Owner — withdraw ETH or any ERC-20; `address(0)` for ETH |

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
- [x] ENS + Basename + Farcaster identity display (`useIdentity` — avatar, name, graceful fallback)
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
- [x] BooztoryRaffle redeployment to Base Sepolia
- [x] Leaderboard page — 6 categories, podium, connected wallet row
- [x] Sponsor page — application form, ad schedule, admin panel
- [x] Profile page — per-wallet identity, on-chain activity feed
- [x] Stats page
- [x] Rate limiting on API endpoints (Upstash Redis)
- [x] NFT Pass infrastructure — `mintSlotWithNFTDiscount` + `mintSlotFreeWithNFT` (50% discount / free, per-token cooldown)
- [x] NFT Pass UI — payment path toggle in submit modal (NFT holders only)
- [x] NFT-gated raffle admin section (frontend-enforced NFT requirement + localStorage gate map)
- [x] Subgraph v0.0.8 — fixed double-count bug (discount/free mints were counted as standard AND duplicated `totalSlots`); `handleSlotMinted` is now the sole record creator using `tokenId` as stable ID
- [x] ABI audit + TOKEN_ABI fixes (`ExceedsMaxSupply`, `treasuryMinted` uint256, `MAX_SUPPLY`)
- [x] Submit content — desktop uses centered Dialog modal; mobile keeps bottom Sheet drawer (`useIsMobile` conditional)
- [x] Deterministic avatar fallback on mobile connect button — `addressAvatar(addr)` hash-based index into avatar pool when no Farcaster/ENS/Basename identity
- [x] Topbar nav centering — `absolute left-1/2 -translate-x-1/2` pattern on both `topbar.tsx` and `pageTopbar.tsx`
- [x] Homepage desktop — two-column layout with inline sponsor ad pill above "Live Spotlight"; mobile sponsor pill in topbar center
- [x] Base Mainnet deployment ✅
- [x] Farcaster Mini App published (Warpcast UA gating; splash screen fix via `sdk.isInMiniApp()`)
- [x] Dynamic slot price + duration (LIMITED label when non-default)
- [x] CDP Paymaster — gas sponsored for all smart account transactions (Coinbase Smart Wallet / Base Account); EOA falls back gracefully
- [x] ERC-8021 Builder Code attribution (`bc_qaqhzzqp`) — all 11 write functions covered on both EOA and smart account paths; verified on-chain
- [x] World Chain deployment — BooztoryWorld + BooztoryRaffleWorld live on World Chain Mainnet (480)
- [x] World Mini App — MiniKit auth, sendTransaction, World ID cloud verification, Goldsky subgraph
- [x] World ID verification — on-chain Address Book gate (`getIsUserVerified` from `@worldcoin/minikit-js/address-book`); Redis nullifier fallback for IDKit ZK flow
- [x] Creator profile & analytics dashboard (`/profile/[address]`)
- [x] Base admin panel (`/admin/base/*`) — owner-gated, full contract setter coverage, auto chain switch
- [x] World admin panel (`/admin/world/*`) — full parity with Base admin; commit-reveal draw UI; createRaffle; verification controls; auto chain switch to World Chain (480)
- [x] WLD payment paths — mint slot and donate with WLD via oracle-priced Permit2 flow (World App only)
- [x] Oracle fix — BooztoryWorld redeployed with correct AggregatorV3 interface + 48h staleness window
- [ ] Set content type images on-chain (`setContentTypeImage`)
- [x] Verify all 3 Base contracts on Basescan ✅
- [x] Verify World Chain contracts on Worldscan ✅ 2026-04-13
- [x] Re-register BooztoryWorld `0x14Fb9124b2E376c250DCf73336912eD6EB6e1219` in Dev Portal allowlist ✅ 2026-04-13
- [x] WLD mint/donation subgraph tracking — `WLDSlotMinted` event + `paymentToken` on `DonationReceived`; subgraph `booztory-world/v1.0.12` ✅ 2026-04-13
- [x] BooztoryRaffle redeployed (Base) — `cancelRaffle` now refunds tickets to all entrants ✅ 2026-04-14
- [x] Add BooztoryRaffle as Chainlink VRF consumer (Base Mainnet) ✅ 2026-04-14
- [x] Fund raffle with initial prize (200,000 BOOZ) ✅ 2026-04-14
- [x] GMMilestoneReached bonus BOOZ tracked in subgraphs — Base `v0.0.12` · World `v1.0.13` ✅ 2026-04-14
- [x] RaffleCancelled indexed in subgraphs — Base `v0.0.13` · World `v1.0.13` ✅ 2026-04-14
- [x] Dev Portal re-registered — BooztoryWorld + RaffleWorld + USDC + WLD + Permit2 entrypoints ✅ 2026-04-14
- [x] Goldsky subgraph `booztory-world/1.0.14` — fixed writer crash, redeployed ✅ 2026-04-19
- [x] Live raffle pill — World App now correctly queries World Chain raffle contract ✅ 2026-04-19
- [x] World raffle tuple fix — `getRaffle()` returns 11 fields on World vs 10 on Base; parsing corrected ✅ 2026-04-19
- [x] World ID gate — replaced IDKit WebView flow (broken) with `getIsUserVerified` Address Book on-chain check ✅ 2026-04-19
- [x] Reward page World UX — `waitForWorldOp` now awaited before refetch on convert + enter raffle ✅ 2026-04-19
- [x] IDKit v4.1.x — `signRequest` API updated (positional args → options object) ✅ 2026-04-24
- [x] WLD mint oracle resilience — ERC20/Permit2 approvals include +2% slippage buffer for oracle delta between static call and block inclusion ✅ 2026-04-24
- [x] WLD discount guard — discount paths disabled in UI when `discountAmount ≥ slotPrice` (prevents contract revert) ✅ 2026-04-24
- [x] Profile activity — USDC mint amounts removed (not stored in contract events); replaced with "USDC paid*" note and footnote ✅ 2026-04-24
- [ ] BOOZ Phase 2 — trading enabled, DEX liquidity
- [ ] Submit World Mini App to World App Store
- [ ] Superchain expansion (OP Mainnet, etc.)

---

## License

MIT
