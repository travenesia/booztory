# Booztory

**Decentralized content spotlight on Base.**

Pay 1 USDC. Your content goes live for 15 minutes. No algorithm. No gatekeepers. Everything on-chain.

---

## What It Is

Booztory is a permissionless promotion platform built on Base. Anyone with a wallet and 1 USDC can feature their content — YouTube, TikTok, X, Spotify, Vimeo, or Twitch — in the live spotlight. Each slot is minted as an ERC-721 token. The entire queue, payment history, and metadata live on-chain. No database. No backend for content data.

Fans can send USDC donations directly to creators through the contract (95% to creator, 5% protocol fee). Minters earn **BOOZ** reward tokens and are entered into a weekly Chainlink VRF raffle with USDC prizes. Daily GM streaks earn more BOOZ over a 90-day journey.

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
Weekly Chainlink VRF raffle → USDC prizes paid on-chain
```

---

## Contracts

Three contracts deployed on Base, wired together:

| Contract | Role |
|---|---|
| `Booztory.sol` | ERC-721 slot minting · donations · GM streak · reward wiring |
| `BooztoryToken.sol` | BOOZ ERC-20 · soulbound Phase 1 · SuperchainERC20-ready |
| `BooztoryRaffle.sol` | Weekly raffle · Chainlink VRF v2.5 · USDC payouts |

### Booztory.sol — Mint Paths

| Function | Payment | BOOZ Earned | BOOZ Burned | Raffle Entry |
|---|---|---|---|---|
| `mintSlot()` | 1 USDC | 1,000 | 0 | ✅ |
| `mintSlotWithDiscount()` | 0.9 USDC | 1,000 | 1,000 | ✅ |
| `mintSlotWithTokens()` | None | 0 | 10,000 | ✗ |

**Donation:** `donate(tokenId, amount)` — pulls USDC, 95% to creator, 5% kept as protocol fee. One atomic call.

**GM Streak:** `claimDailyGM()` — one claim per UTC day. Tracked fully on-chain via `block.timestamp / 1 days`.

### BooztoryToken.sol — BOOZ

- ERC-20 reward token, **soulbound in Phase 1** (no wallet-to-wallet transfers; mint and burn always allowed)
- Phase 2: `setSoulbound(false)` enables transfers; seed Uniswap v3 BOOZ/USDC pool from one-time `mintTreasury()`
- Built as **SuperchainERC20** (IERC7802) — same address across all OP Stack chains via CREATE2; no token migration for Superchain expansion

### BooztoryRaffle.sol — Weekly Draw

- Chainlink VRF v2.5 for provably fair randomness
- 10 winners per week, one prize per wallet (duplicate re-roll via linear probe)
- Draw only runs if ≥ 100 entries and ≥ winner-count unique minters
- Owner triggers manually; USDC funded by treasury before each draw
- `setWeekDuration()` for testnet fast-forwarding (default: `1 weeks`)

---

## BOOZ Rewards

| Action | Reward |
|---|---|
| Mint a slot (1 USDC) | 1,000 BOOZ |
| GM streak Days 1–7 | 5 / 10 / 15 / 20 / 25 / 30 / 35 BOOZ |
| GM streak Days 8–90 | 50 BOOZ/day |
| Milestone Day 7 — Warrior | +50 BOOZ |
| Milestone Day 14 — Elite | +250 BOOZ |
| Milestone Day 30 — Epic | +350 BOOZ |
| Milestone Day 60 — Legend | +500 BOOZ |
| Milestone Day 90 — Mythic | +4,560 BOOZ |

**Full 90-day journey = ~10,000 BOOZ = 1 free slot.**

**Burn sinks:**
- Burn 1,000 BOOZ → 0.1 USDC discount on next slot
- Burn 10,000 BOOZ → free slot (no USDC, no raffle entry)

---

## Weekly Raffle — Default Prize Structure

| Place | Prize |
|---|---|
| 1st | $25 USDC |
| 2nd | $20 USDC |
| 3rd | $15 USDC |
| 4th | $10 USDC |
| 5th–10th | $5 USDC each |
| **Total** | **$100 USDC** |

Break-even at 100 mints/week. Fully configurable via `setPrizes()` — no redeploy needed.

---

## Frontend Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 · React 19 · TypeScript |
| Styling | Tailwind CSS |
| Wallet | wagmi v2 · RainbowKit · viem |
| Auth | NextAuth 4 · SIWE (browser) · Farcaster QuickAuth (Mini App) |
| Mini App | `@farcaster/miniapp-sdk` |
| Drawers | Vaul (mobile bottom sheets) |
| Chain reads | wagmi `useReadContract` — no database |

### Pages

| Route | Description |
|---|---|
| `/` | Live content · countdown · donation modal · submit drawer |
| `/upcoming` | Queued slots with infinite scroll |
| `/history` | Past slots with infinite scroll |
| `/reward` | BOOZ balance · GM streak · raffle entries · weekly draw status |
| `/faq` | FAQ accordion |
| `/tweet/[tweet]` | Dynamic tweet embed with metadata |

### Key Components

- **ContentCard** — live slot embed + countdown + donation button
- **SubmitContent** — submission drawer with URL validation, TikTok short URL resolution, 3 mint paths
- **GMModal** — desktop Dialog + mobile Vaul Drawer; streak day, milestone progress, confetti on claim
- **DonationModal** — preset amounts (1/5/10 USDC); ENS/Basename display for donor and creator
- **ConnectWallet** — RainbowKit + auto SIWE; Farcaster Mini App detection with QuickAuth fallback

### Identity

Display name priority: `authorName` (content creator field) → Basename (`.base.eth`) → ENS (`.eth`) → truncated address.

---

## Authentication

**Browser (SIWE):**
1. Wallet connects → GET `/api/nonce` → UUID stored in httpOnly cookie
2. Frontend signs `SiweMessage` → POST to NextAuth credentials provider
3. JWT created: `{ userId: address, walletAddress, username }`

**Farcaster Mini App (QuickAuth):**
1. `sdk.isInMiniApp()` → true → injected provider connected automatically
2. `sdk.quickAuth.getToken()` → Farcaster JWT → NextAuth verifies
3. Same session shape as SIWE

No database — wallet address is the user identity.

---

## Deployed Addresses

### Base Sepolia (Testnet)

| Contract | Address | Status |
|---|---|---|
| Booztory | `0xF94E370201E9C3FaDDA1d61Ee7797E7592964b68` | ✅ Current |
| BooztoryToken (BOOZ) | `0x02A2830552Da5caA0173a0fcbbc005FC70339855` | ✅ Current |
| BooztoryRaffle | `0xd7f8AC77392f6C1D21eA6B5fb57861e759e250B5` | ✅ Current |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | — |

### Base Mainnet

| Contract | Address |
|---|---|
| Booztory | Pending mainnet deployment |
| BooztoryToken (BOOZ) | Pending mainnet deployment |
| BooztoryRaffle | Pending mainnet deployment |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

---

## Supported Platforms

| Platform | Status |
|---|---|
| YouTube & Shorts | ✅ Live |
| X (Twitter) | ✅ Live |
| TikTok | ✅ Live |
| Spotify | ✅ Live |
| Vimeo | ✅ Live |
| Twitch | ✅ Live |
| Instagram | Planned |
| Custom uploads | Planned |

---

## What's On-Chain

Everything core to the product:

- Slot metadata (URL, type, title, author, thumbnail, times) — stored in ERC-721 struct
- Queue management — `queueEndTime` schedules slots without any off-chain coordination
- Payments — USDC `approve` + `mintSlot` in two transactions
- Donations — atomic 95/5 split in a single `donate()` call
- BOOZ reward minting and burning — triggered by Booztory contract, no off-chain scheduler
- GM streak — day counter via `block.timestamp / 1 days`, milestones via bitmask
- Raffle entries — added per paid mint; winner selection via Chainlink VRF
- History and discovery — `getCurrentSlot()`, `getUpcomingSlots()`, `getPastSlots()` are pure on-chain reads

---

## Roadmap

### Immediate (Testnet)
- [x] Redeploy all 3 contracts to Base Sepolia ✅
- [x] Add BooztoryRaffle as Chainlink VRF consumer ✅
- [ ] Set content type images on-chain
- [ ] Verify all 3 contracts on Basescan
- [ ] End-to-end QA: mint → GM → raffle draw

### Mainnet Launch
- [ ] Deploy all 3 contracts to Base Mainnet
- [ ] Fund raffle, configure VRF consumer
- [ ] Dune analytics dashboard

### Near-Term
- [ ] Rate limiting on API endpoints
- [ ] Creator analytics dashboard
- [ ] Instagram embed support

### BOOZ Phase 2
- [ ] `setSoulbound(false)` → enable transfers
- [ ] `mintTreasury()` → seed Uniswap v3 BOOZ/USDC pool
- [ ] Boost slot burn sink (visibility/queue position)
- [ ] Leaderboard badge (monthly burn)

### Superchain Expansion
- [ ] BooztoryToken via CREATE2 (same address on every chain)
- [ ] World Chain deployment + World Mini App
- [ ] OP Mainnet and other OP Stack chains
