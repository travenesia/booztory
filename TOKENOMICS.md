# Booztory — Tokenomics & Roadmap

Last updated: 2026-03-31 (session 5)

---

## 1. BOOZ Token (BooztoryToken.sol)

### Token Model
- **Inflationary + Burns** — supply grows with real engagement, burns with utility spend
- Tokens mint from paid platform actions only — no free claim, no sybil farming
- **Hard cap: 100,000,000 BOOZ** (`MAX_SUPPLY`) — enforced on-chain in `mintReward`, `mintTreasury`, `crosschainMint`
- **Phase 1: Soulbound** — no trading, no farming incentive; mint and burn always allowed
- **Phase 2:** `setSoulbound(false)` → transfers enabled; seed LP from `mintTreasury()` tranches

### Reward Structure
| Action | Reward |
|---|---|
| Mint a slot (1 USDC) | 1,000 BOOZ |
| GM streak Day 1 | 5 BOOZ |
| GM streak Day 2 | 10 BOOZ |
| GM streak Day 3 | 15 BOOZ |
| GM streak Day 4 | 20 BOOZ |
| GM streak Day 5 | 25 BOOZ |
| GM streak Day 6 | 30 BOOZ |
| GM streak Day 7 | 35 BOOZ |
| GM streak Days 8–90 (flat) | 50 BOOZ/day |
| Milestone Day 7 — Warrior | +50 BOOZ |
| Milestone Day 14 — Elite | +250 BOOZ |
| Milestone Day 30 — Epic | +350 BOOZ |
| Milestone Day 60 — Legend | +500 BOOZ |
| Milestone Day 90 — Mythic | +4,560 BOOZ |

Full 90-day GM journey = ~10,000 BOOZ = exactly 1 free slot.

### Burn Sinks
| Spend | Cost | Status |
|---|---|---|
| Free slot (no USDC) | Burn 10,000 BOOZ | ✅ Implemented |
| Discounted slot (0.9 USDC) | Burn 1,000 BOOZ | ✅ Implemented |
| Boost slot visibility/position | TBD | Planned |
| Leaderboard badge (monthly) | TBD | Planned |
| Governance vote | Burn or stake | Planned |

Net BOOZ per discount mint: 1,000 earned − 1,000 burned = 0 (neutral, no farming loop).
Free slot does NOT earn BOOZ — burn path is a dead end.

### GM Streak (on-chain)
- `claimDailyGM()` — one claim per UTC day via `block.timestamp / 1 days`
- Missing a day resets streak to day 1
- Highest streak tracked separately — never resets
- Milestone bonuses at days 7, 14, 30, 60, 90 — bitmask-tracked, one-time per cycle
- Journey completes at day 90 — no further claims possible

### Treasury Mint
- `mintTreasury(address, uint256)` — owner-only, **tranche-based** (can be called multiple times)
- Cumulative cap: **10,000,000 BOOZ** (`TREASURY_CAP`) — `treasuryMinted` tracks running total
- Use cases: LP seeding, investor allocations (via `VestingWallet`), operational reserve
- Reverts `ExceedsTreasuryCap` if cumulative total would exceed 10M
- Reverts `ExceedsMaxSupply` if total supply would exceed 100M hard cap

### Investor Allocation (optional)
- If investors acquired: deploy OpenZeppelin `VestingWallet` per investor, call `mintTreasury(vestingWalletAddress, amount)`
- Supports 1 investor, 10 investors, or no investors — same `mintTreasury()` call, different recipients
- Treasury 10M budget: e.g. 1M LP seed now, 2M investor tranche later, remainder reserved
- No investor in early phase: seed LP directly with small amount (e.g. 500k BOOZ + $500–1,000 USDC)

### Contract Architecture
- `mintReward(address, uint256)` — called by Booztory after paid mint / GM claim
- `burnFrom(address, uint256)` — called by Booztory for free slot / discount redemption
- `burn(uint256)` — any holder can voluntarily burn own tokens
- `setSoulbound(bool)` — owner toggles Phase 1 → Phase 2
- `crosschainMint` / `crosschainBurn` — authorized to Superchain bridge (`0x4200...0028`)

### Mint Paths Summary
| Function | Payment | BOOZ Earned | BOOZ Burned | Raffle Entry |
|---|---|---|---|---|
| `mintSlot()` | 1 USDC | 1,000 | 0 | ✅ |
| `mintSlotWithDiscount()` | 0.9 USDC | 1,000 | 1,000 | ✅ |
| `mintSlotWithTokens()` | None | 0 | 10,000 | ✗ |
| `mintSlotWithNFTDiscount()` | 0.5 USDC | 0 | 0 | ✅ |
| `mintSlotFreeWithNFT()` | None | 0 | 0 | ✅ |

NFT paths are exclusive — cannot be combined with BOOZ discount/free paths.
NFT paths earn **no BOOZ and no points** — only the 1 raffle ticket. Holders choosing the standard mint path instead receive all normal perks.

### Admin Setters
- `setSlotMintReward`, `setFreeSlotCost`, `setDiscountBurnCost`, `setDiscountAmount`
- `setGMDayRewards(uint256[7])`, `setGMFlatDailyReward`, `setGMMilestoneRewards(uint256[5])`
- `setRewardToken(address)` — enable/disable rewards (address(0) = disabled)

---

## 2. Points System

Users earn points through platform activity. Points are tracked on-chain per wallet.

**5 points = 1 raffle ticket** (burn on conversion, irreversible)

| Action | Points | Notes |
|---|---|---|
| Mint slot | 15 pts | Standard, discount, free-token paths only — **NFT paths earn 0 pts** |
| GM daily | 1 pt | Per day, requires active streak |
| GM Day 7 bonus | +1 pt | One-time per cycle |
| GM Day 14 bonus | +1 pt | One-time per cycle |
| GM Day 30 bonus | +2 pts | One-time per cycle |
| GM Day 60 bonus | +2 pts | One-time per cycle |
| GM Day 90 bonus | +3 pts | One-time per cycle, then veteran mode |
| GM veteran (day 91+) | 1 pt/day + 3 pts every 30 days | Continues indefinitely |
| Donate (any amount) | 5 pts + 1,000 BOOZ | Once per 24h, donor ≠ creator |

**Streak rules:**
- Miss one GM day → streak counter resets to day 1
- Highest streak day tracked separately — never resets
- Bonus milestones based on current streak day, not highest streak
- Donate points only when donating to another wallet's slot (tokenId owner ≠ donor)

### 30-Day Earning Simulation
| User type | Points | Tickets | Cost |
|---|---|---|---|
| GM only (perfect streak) | ~34 pts | 6 tickets | Free |
| Daily donor only | 150 pts | 30 tickets | 30 USDC |
| 1 mint + GM | ~49 pts | 9 tickets | 1 USDC |
| 1 mint + daily donate | 165 pts | 33 tickets | 31 USDC |

---

## 3. Raffle System

### Ticket Rules
- **5 points = 1 raffle ticket** (burn on conversion)
- Tickets burned on raffle entry, win or lose
- More tickets entered = higher weight (proportional chance)
- Users decide how many tickets to commit per raffle
- Unused tickets carry over to any future raffle

### Raffle Configuration (Admin)
Owner creates and configures each raffle independently. Multiple raffles can run concurrently.

**Prize Setup:**
- Supported prize tokens: **USDC**, **BOOZ**, **ETH** (native), or **any ERC-20**
- ETH flow: `sendTransaction` ETH to raffle contract (tx 1) → `createRaffle(address(0))` (tx 2) — `address(0)` is the ETH sentinel
- USDC / custom ERC-20 flow: `approve` → `createRaffle` → `depositPrize` (3 txs)
- BOOZ flow: `createRaffle` only (1 tx) — minted directly to winners at draw time
- If draw threshold not met → draw cancelled, sponsor tokens refunded

**Winner Distribution:**
- Owner sets winner count and individual prize amounts per token
- Example (100 USDC, 5 equal winners): `20, 20, 20, 20, 20`
- Example (100 USDC + 100,000 BOOZ, 5 winners):
  - USDC: `50, 30, 20, 0, 0`
  - BOOZ: `40000, 30000, 15000, 10000, 5000`

**Duration:** 1 day minimum, 90 days maximum. Raffles numbered sequentially.

### Default Prize Structure (USDC, no sponsor)
| Place | Prize |
|---|---|
| 1st | $25 USDC |
| 2nd | $20 USDC |
| 3rd | $15 USDC |
| 4th | $10 USDC |
| 5th–10th | $5 USDC each |
| **Total** | **$100 USDC** |

Break-even at 100 mints/week. At 672 mints/week: ~85% margin after payout.

### Default BOOZ Raffle (No Sponsor)
- Total prize pool: **100,000 BOOZ**
- Winner count: configurable (1, 5, or 10 winners)
- Raffle contract mints BOOZ directly to winners (authorized minter)

### Prize Conditions
| Condition | Prize Token |
|---|---|
| Sponsor confirmed | Sponsor's ERC-20 |
| No sponsor | BOOZ (default) |
| No BOOZ funded | USDC fallback |

### Weekly Draw Mechanics
- Owner-triggered manually; USDC funded to contract before draw
- Threshold: draw only runs if ≥ 100 entries (configurable via `setDefaultDrawThreshold`)
- Minimum unique entrants: ≥ winner count (prevents VRF callback infinite loop)
- If threshold not met → draw skipped, no rollover
- **Randomness:** Chainlink VRF v2.5 — one request per draw; derive winner indices via `keccak256(seed, i)`
- One prize per wallet — duplicate winners re-rolled via linear probe
- `weeklyPrizes` mapping snapshots prizes at draw time — historical display stays accurate after `setPrizes()` updates
- Emergency: `resetDraw(week)` resets a stuck VRF draw

### BooztoryRaffle.sol Configurable Setters
- `setDefaultDrawThreshold(uint256)` — minimum entries for draw
- `setDefaultMinUniqueEntrants(uint256)` — minimum unique wallets (keep ≥ winner count)
- `setVrfConfig(...)` — update subscription ID, key hash, gas limit, confirmations
- `setWeekDuration(uint256)` — **testnet only**: shorten week for faster testing (default: `604800`)

---

## 4. NFT (ERC-721 — Booztory Spotlight)

- **Name:** Booztory Spotlight · **Symbol:** BOOST
- **Metadata:** On-chain base64 JSON — Content Type attribute only
- **Image:** Per content type, set via `setContentTypeImage(contentType, imageUrl)`
- `external_url` points to booztory.com
- `tokenURI()` returns on-chain base64-encoded JSON metadata

---

## 4b. NFT Pass — Platform Utility

A separate ERC-721 collection (not the slot token) granting permanent platform perks to holders. Multiple collections can be approved simultaneously.

### Perk Summary
| Perk | Rule |
|---|---|
| 50% slot discount | Once per 24h per NFT token ID |
| 1 free slot mint | Once per 30 days per NFT token ID |
| Cooldown on transfer | Yes — stays with token ID (anti-exploit) |

### Design Decisions
- **Per token ID, not per wallet** — hold 3 NFTs = 3 discounted/free mints available
- **Cooldown travels with NFT** — if sold, buyer inherits used/unused cooldown state; prevents borrow-use-return exploit
- **Multiple collections** — `approvedNFTContracts[address] = bool`; any approved ERC-721 contract grants perks
- **Exclusive paths** — NFT discount/free do not stack with BOOZ discount/free paths
- **No BOOZ, no points** — NFT paths yield only the mint + 1 raffle ticket; holder consciously trades rewards for cost savings
- **Holder choice** — NFT holders can always ignore the NFT path and mint normally to receive full BOOZ + points rewards

### Frontend UX (Submit Modal)
- Payment method section shows an **NFT toggle** (same pill-style as URL/Text switcher) only when the connected wallet holds ≥1 token from an approved NFT collection
- Toggle options: **Standard** (1 USDC, full perks) | **NFT Discount** (0.5 USDC, 1 ticket) | **NFT Free** (0 USDC, 1 ticket, 30d cooldown)
- NFT-path options show the NFT contract + token ID selector if the wallet holds multiple approved NFTs
- No BOOZ balance shown on NFT paths (no BOOZ involved)
- Cooldown state shown per token ID — grey out the option if cooldown is active

### Allowlist for NFT Drop
- Who qualifies: any wallet where `getSlotsByCreator(address).length > 0` (has ever minted a slot)
- Snapshot can be taken at any block, or checked live at NFT mint time
- No contract changes needed — slot history is permanently on-chain

### Contract Changes (Booztory.sol) — Implemented ✅
```solidity
mapping(address => bool) public approvedNFTContracts;
address[] public approvedNFTList;                                            // enumerable — for admin UI
mapping(address => mapping(uint256 => uint256)) public nftLastDiscountMint; // nftContract => tokenId => timestamp
mapping(address => mapping(uint256 => uint256)) public nftLastFreeMint;     // nftContract => tokenId => timestamp

function setNFTContract(address nft, bool approved) external onlyOwner      // push/swap-and-pop on approvedNFTList
function getApprovedNFTContracts() external view returns (address[] memory)
function mintSlotWithNFTDiscount(address nftContract, uint256 nftTokenId, ...) external
function mintSlotFreeWithNFT(address nftContract, uint256 nftTokenId, ...) external
```

### Implementation Status
- [ ] NFT Pass collection designed and deployed
- [x] `setNFTContract(address, bool)` added to Booztory.sol ✅
- [x] `approvedNFTList` array + `getApprovedNFTContracts()` view ✅
- [x] `mintSlotWithNFTDiscount()` + `mintSlotFreeWithNFT()` added ✅
- [x] Admin UI: `app/admin/nft/page.tsx` — approve, revoke, persistent on-chain list ✅
- [x] ABI updated in `lib/contract.ts` ✅
- [x] Redeployed on Base Sepolia block 39558013 ✅
- [x] Frontend: NFT Discount / NFT Free toggle in submit modal — visible only to NFT holders ✅
- [x] `usePayment.tsx`: `mintSlotWithNFTDiscount()` + `mintSlotFreeWithNFT()` hooks ✅
- [x] Admin: NFT-gated raffle creation section in `/admin/raffle` — localStorage raffleId→nftContract map ✅

---

## 5. Sponsorship Model

### Pricing Tiers (default, owner-configurable)
| Duration | Prize Pool | Platform Fee | Sponsor Pays Total |
|---|---|---|---|
| 7 days | 100 USDC | 100 USDC | 200 USDC |
| 14 days | 200 USDC | 200 USDC | 400 USDC |
| 30 days | 400 USDC | 300 USDC | 700 USDC |

### Application Flow
1. Sponsor submits form on `/sponsor` → USDC `approve` + `submitApplication()` sends (prize + fee) to contract
2. Status: **Pending** → owner reviews
3. Owner accepts → fee to owner, prize locked for raffle — owner creates raffle manually
4. Owner rejects → full refund (prize + fee) to sponsor
5. No response in 30 days → sponsor calls `claimRefund(applicationId)` — trustless auto-refund

### Ad Content
- **Ad Type:** Image (URL + ratio) / Embed (YouTube, TikTok, etc.) / Text (max 200 chars)
- **Sponsor Links:** website, X, Discord, Telegram
- All ad content emitted as events on submission — no database needed
- `acceptedAt` field set on acceptance — used by frontend for ad countdown
- `nextAdStartTime` on contract — new acceptances chain automatically, no overlap
- First-submitted-first-served enforced on-chain (`EarlierApplicationPending` revert)

### Ad Display
- **Homepage (all devices):** floating toggle bar above featured content
- **Desktop (other pages):** sidebar panel (`w-[315px]`, `z-30`, auto-shown)
- Mobile: sidebar hidden on non-homepage pages
- Display duration matches raffle duration (7, 14, or 30 days)
- Only active (started) sponsors show — queued sponsors invisible until their slot begins

---

## 6. Anti-Gambling / Legal Design

| Requirement | How it's met |
|---|---|
| Free entry path (no purchase necessary) | GM daily — completely free |
| Free path is meaningful | ~6 tickets per 30-day raffle |
| Paid paths give better odds, not exclusive access | ✓ |
| No direct money → prize conversion | Points intermediary breaks the chain |
| Whale resistance | Donate capped at 5 pts + 1,000 BOOZ per 24h regardless of amount |
| Self-donate farming blocked | Points only awarded when donating to another wallet's tokenId |
| Framing | Loyalty rewards program, not a lottery |

> Legal review recommended before mainnet launch — jurisdiction laws vary.

---

## 7. Chainlink VRF Setup

### Step 1 — Create a subscription
1. Go to https://vrf.chain.link
2. Select network (Base Sepolia for testing, Base for mainnet)
3. Click "Create Subscription" → note your **Subscription ID**

### Step 2 — Fund with LINK
- Base Sepolia: free testnet LINK from https://faucets.chain.link
- Base Mainnet: buy LINK, bridge to Base

### Step 3 — Deploy contracts
```bash
VRF_SUBSCRIPTION_ID=<your_id> npx hardhat run scripts/deploy.ts --network base-sepolia
VRF_SUBSCRIPTION_ID=<your_id> npx hardhat run scripts/deploy.ts --network base
```

### Step 4 — Add BooztoryRaffle as consumer
1. vrf.chain.link → your subscription → Add Consumer
2. Paste deployed BooztoryRaffle address → confirm

Without this step, `requestWeeklyDraw()` reverts.

### VRF Contract Addresses
| Network | VRF Coordinator | Key Hash (30 gwei) |
|---|---|---|
| Base Mainnet | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` | `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71` |
| Base Sepolia | `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` | `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71` |

Always verify at https://docs.chain.link/vrf/v2-5/supported-networks before deploying.

---

## 8. Deployed Addresses

### Base Sepolia (Testnet — current as of 2026-03-31)
| Contract | Address | Status |
|---|---|---|
| Booztory | `0xb73E5f05222f829397202bb2d9C2C15eE4a24132` | ✅ Redeployed block 39558013 (NFT pass + slotCursor + Pausable) |
| BooztoryToken (BOOZ) | `0xb1E1B92CD95DaAb5E15756A383BeFEF7593F8db1` | ✅ Redeployed (MAX_SUPPLY + tranche treasury) |
| BooztoryRaffle | `0xE018C70AB3eC93848Fad52dbC66A433DBCC1d9Af` | ✅ Redeployed block 39558014 (new Booztory address) |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | — |

### Base Mainnet
| Contract | Address |
|---|---|
| Booztory | Pending deployment |
| BooztoryToken (BOOZ) | Pending deployment |
| BooztoryRaffle | Pending deployment |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Confirmed on current Base Sepolia deploy:
- `setAuthorizedMinter(booztory, true)` + `setAuthorizedMinter(raffle, true)` on BooztoryToken ✅
- `setRewardToken()` and `setRaffle()` called on Booztory ✅
- BooztoryRaffle added as Chainlink VRF consumer ✅
- `acceptedAt` field in `SponsorApplication` struct ✅
- ETH prize support (`receive()`, `address(0)` sentinel, ETH branch in `withdraw()`) ✅
- NFT pass: `approvedNFTContracts`, `approvedNFTList`, `mintSlotWithNFTDiscount`, `mintSlotFreeWithNFT` ✅
- Subgraph v0.0.7 deployed — ABIs regenerated from compiled artifacts, new NFT + Pausable events ✅

---

## 9. Implementation Status

### UI / Frontend — `/reward` page
| Feature | Status |
|---|---|
| Create Raffle (owner panel) — per-winner prizes, 1d/7d/14d/30d/custom duration | ✅ Done |
| Cancel Raffle (owner) | ✅ Done |
| Trigger Draw + Reset stuck VRF | ✅ Done |
| Draw Thresholds config (default threshold + min unique entrants) | ✅ Done |
| Withdraw USDC from raffle contract | ✅ Done |
| Raffle history dropdown — switch between any raffle by ID | ✅ Done |
| Prize display — per-winner breakdown, correct decimals (USDC 6 / BOOZ 18) | ✅ Done |
| Live countdown with seconds | ✅ Done |
| Status badges — Cancelled / Drawn ✓ / VRF pending / Awaiting draw / Ends in Xs | ✅ Done |
| Entry blocked when raffle is cancelled, drawn, or ended | ✅ Done |
| Winners section with Basescan VRF tx link | ✅ Done |
| Prize table always visible — consecutive equal prizes grouped | ✅ Done |
| Points balance, raffle ticket conversion, raffle entry | ✅ Done |
| Convert Points section — inline stats (Points/Tickets/Burned) with separators | ✅ Done |
| Sponsor info in prize pool card — stacked (label → name → social icons) | ✅ Done |
| Prize amount enlarged (`text-4xl`) | ✅ Done |
| ActiveRaffleCard auto-syncs to newest raffle on creation | ✅ Done |
| USDC available balance check (total minus committed active raffles) | ✅ Done |
| Sponsor dropdown excludes queued/matched sponsors | ✅ Done |
| Prize amount `my-6` margin; BOOZ shown without ticker symbol | ✅ Done |
| Convert section always visible; disabled state when 0 points | ✅ Done |
| Winner table: "Winner" header; Requirements "wallets ✓" | ✅ Done |

### UI / Frontend — `/sponsor` page
| Feature | Status |
|---|---|
| Sponsor application form (name, ad type, content, link, duration) | ✅ Done |
| USDC approve + submitApplication flow | ✅ Done |
| Application status — Pending / Accepted / Rejected | ✅ Done |
| Owner Accept / Reject buttons | ✅ Done |
| Refund UX — Rejected: auto-refund message; Pending+30d: Claim Refund button | ✅ Done |
| Sponsor ad display — toggle (homepage) + sidebar (desktop, other pages) | ✅ Done |
| Ad countdown timer — live D:HH:MM:SS (1-second interval) | ✅ Done |
| Ad content fitting — ResizeObserver, pixel-exact sizing for all ratios/types | ✅ Done |
| Mobile sidebar removed from non-homepage pages | ✅ Done |
| Sidebar z-index — `z-30` (below wallet dropdown) | ✅ Done |
| `chainId: APP_CHAIN.id` on all writeContractAsync calls (Farcaster chain fix) | ✅ Done |
| Text ad body padding `px-6`, sponsor name not shown inside text panel | ✅ Done |
| Sponsor ad backdrop opacity `bg-black/90` | ✅ Done |
| Upcoming / Past ad schedule tabs with pagination (max 5/page) | ✅ Done |
| AdScheduleCard — platform icon, social links, clickable ad type (embed→link, image/text→popup) | ✅ Done |
| "Read before you apply" accordion (FAQ style, collapsed by default) | ✅ Done |

### UI / Frontend — Auth & Session
| Feature | Status |
|---|---|
| Session persistence across browser restarts (`maxAge: 30d` in NextAuth) | ✅ Done |
| Locked wallet shows "Connect" after 5s instead of spinning (`reconnectTimedOut`) | ✅ Done |
| Race condition fix: `prevStatusRef` triggers SIWE when wagmi reconnects before session resolves | ✅ Done |

### UI / Frontend — Submit Content Modal
| Feature | Status |
|---|---|
| BOOZ balance inline with Payment Method label (discount/free paths) | ✅ Done |
| URL/Text inline pill switcher in label row (no separate tab bar) | ✅ Done |

### UI / Frontend — Donation Modal
| Feature | Status |
|---|---|
| Non-dismissible transaction lock overlay during USDC approve → donate flow | ✅ Done |

### UI / Frontend — History & Upcoming Pages
| Feature | Status |
|---|---|
| Own-content carousel — horizontal snap scroll, separate from others' list | ✅ Done |
| Slide indicators — clickable line bars below card (active `w-6`, inactive `w-3`, `h-1`) | ✅ Done |
| Auto-slide every 5s, pauses on hover/touch | ✅ Done |
| Separator between own carousel and others' list | ✅ Done |
| Empty state — centered, bold heading, descriptive copy | ✅ Done |

### UI / Frontend — Navigation
| Feature | Status |
|---|---|
| "New" badge removed from Reward nav (topbar + pageTopbar) | ✅ Done |
| Drop shadows removed from loading skeletons (faq, history, upcoming) | ✅ Done |

### UI / Frontend — Analytics
| Feature | Status |
|---|---|
| Google Analytics 4 (`@next/third-parties/google`, ID `G-G7CY80LZ3W`) | ✅ Done |

### Smart Contracts
| Contract | Status |
|---|---|
| `Booztory.sol` — 5 mint paths (standard/discount/free/NFT-discount/NFT-free), GM streak, points, donations, Pausable, slotCursor | Deployed on Base Sepolia ✅ block 39558013 |
| `BooztoryToken.sol` (BOOZ) — MAX_SUPPLY 100M, tranche treasury, SuperchainERC20 | Deployed on Base Sepolia ✅ |
| `BooztoryRaffle.sol` — VRF v2.5, concurrent raffles, sponsor applications, ETH prize, Pausable, BOOZMintFailed event | Deployed on Base Sepolia ✅ block 39558014 |
| Base Sepolia wiring | Done ✅ |
| Subgraph v0.0.7 | Deployed ✅ — ABIs regenerated from compiled artifacts |
| Base Mainnet deployment | Pending |

---

## 10. Build Checklist

### Testnet — Immediate
- [x] Redeploy all 3 contracts to Base Sepolia ✅
- [x] Redeploy BooztoryToken (MAX_SUPPLY + tranche treasury) + BooztoryRaffle (new token) ✅
- [x] Verify all contracts on Basescan ✅
- [ ] Remove old BooztoryRaffle from Chainlink VRF subscription, add new one
- [x] Call `setDefaultDrawThreshold(1)` + `setDefaultMinUniqueEntrants(1)` for testnet ✅
- [x] End-to-end QA: mint → earn BOOZ → streak → raffle draw ✅

### After Redeployment (Booztory + BooztoryRaffle)
**Booztory.sol changes:** `Pausable` (pause/unpause), `_slotCursor` fix for `getCurrentSlot()` O(1), `advanceCursor()`, full NFT Pass infrastructure
**BooztoryRaffle.sol changes:** `BOOZMintFailed` event in VRF callback catch, `Pausable` (pause/unpause)

```bash
VRF_SUBSCRIPTION_ID=<id> npx hardhat run scripts/redeploy.ts --network base-sepolia
```

- [x] Run `scripts/redeploy.ts` on Base Sepolia ✅ (Booztory block 39558013, Raffle block 39558014)
- [ ] Verify both contracts on Basescan
- [x] Remove old BooztoryRaffle from Chainlink VRF subscription ✅
- [x] Add new BooztoryRaffle as Chainlink VRF consumer ✅
- [x] Call `setAuthorizedMinter(newRaffle, true)` on BooztoryToken ✅
- [x] Call `setRewardToken(tokenAddress)` on new Booztory ✅
- [x] Call `setRaffle(newRaffleAddress)` on new Booztory ✅
- [x] Update `NEXT_PUBLIC_BOOZTORY_ADDRESS` + `NEXT_PUBLIC_RAFFLE_ADDRESS` in `.env.local` ✅
- [x] Update `BOOZTORY_ABI` in `lib/contract.ts` (add `pause`/`unpause`, `advanceCursor`, NFT pass functions) ✅
- [x] Update `RAFFLE_ABI` in `lib/contract.ts` (add `BOOZMintFailed` event, `pause`/`unpause`) ✅
- [x] Call `setDefaultDrawThreshold(1)` + `setDefaultMinUniqueEntrants(1)` for testnet ✅ (done via redeploy script step 9)

### Mainnet Launch
- [ ] `lib/wagmi.ts` — change `APP_CHAIN = baseSepolia` → `APP_CHAIN = base`
- [ ] Deploy all 3 contracts to Base Mainnet
- [ ] Add BooztoryRaffle (mainnet) as VRF consumer
- [ ] Update `.env.local` with mainnet addresses
- [ ] Set production thresholds: `setDefaultDrawThreshold(100)` + `setDefaultMinUniqueEntrants(20)`
- [ ] Fund raffle contract with USDC for first draw
- [ ] Set up Dune analytics dashboard

### Post-Launch
- [x] Rate limiting on API endpoints (Upstash Redis) ✅
- [ ] Creator analytics dashboard
- [ ] ~~Instagram embed + custom video upload~~ (cancelled)
- [ ] BOOZ Phase 2: `setSoulbound(false)` → `mintTreasury()` tranche → seed Aerodrome/Uniswap v3 BOOZ/USDC pool
- [ ] Additional BOOZ burn sinks: slot boost, leaderboard badge, governance
- [ ] NFT Pass collection: design, deploy, snapshot slot minters for allowlist
- [ ] Call `setContentTypeImage(contentType, imageUrl)` for each platform — after NFT design is finalized
- [x] Add NFT pass infrastructure to `Booztory.sol` (`setNFTContract`, `getApprovedNFTContracts`, `approvedNFTList`, `mintSlotWithNFTDiscount`, `mintSlotFreeWithNFT`) ✅
- [x] Admin UI: `app/admin/nft/page.tsx` — approve/revoke collections, persistent on-chain list ✅
- [x] Frontend: NFT Discount / NFT Free toggle in submit modal ✅
- [x] NFT-gated raffle admin section in `/admin/raffle` ✅
- [x] Subgraph v0.0.7 — ABIs regenerated from Hardhat artifacts, NFT + Pausable events, deployed to Studio ✅
- [x] Leaderboard: deploy The Graph subgraph + `/api/leaderboard` + `/leaderboard` page (see §14) ✅
- [x] Profile page `/profile/[address]` — per-wallet stats ✅

---

## 11. Open Questions & Todos

### Resolved ✅
- Concurrent sponsor + BOOZ raffle → **only sponsor ads show; BOOZ raffles have no ad placement**
- Consecutive sponsor applications → **chain via `nextAdStartTime`; first-submitted-first-served enforced on-chain**
- Cancelled raffles in history → **show all raffles including cancelled**

### `/reward` page — Pending
- [ ] `setRaffleThresholds(raffleId, threshold, minUnique)` UI — override on a specific raffle post-creation
- [ ] Show raffle start date alongside end date
- [ ] Winner ENS/Basename display (currently truncated hex)
- [ ] Ticket entry: validate input doesn't exceed user's available balance
- [ ] Decide: should cancelled raffles show the prize table or hide it?
- [ ] Test full lifecycle: create → enter → draw → winners displayed
- [ ] Test USDC raffle (3-tx: approve → createRaffle → depositPrize)
- [ ] Test BOOZ raffle (1-tx: createRaffle only, minted at draw)

### `/sponsor` page — Pending
- [x] Show countdown to auto-refund deadline on Pending applications — reads `refundTimeout` live from contract ✅
- [ ] Validate ad image URL is reachable before submit
- [ ] After Accept: consider linking owner directly to raffle creation panel

### Known Frontend Issues
- [x] Wallet disconnect dropdown hidden behind sidebar ads on desktop — portalled to `document.body` via `createPortal`, `position: fixed`, `z-[60]` ✅
- [x] GM modal blocked at day 90 — `journeyComplete` replaced with `isVeteran`, veteran mode UI active, `isConsecutive` no longer capped at day 90 ✅

---

## 12. Token Supply Plan

### Supply Breakdown
| Bucket | Amount | Source |
|---|---|---|
| User rewards (mint, GM, donate, raffle) | Up to ~90M | `mintReward` via Booztory + Raffle |
| Treasury (LP + investors) | Up to 10M | `mintTreasury` owner-only, tranche-based |
| **Hard cap** | **100,000,000 BOOZ** | On-chain `MAX_SUPPLY` constant |

### Projected Emission (current activity baseline)
| Source | BOOZ/year |
|---|---|
| Slot mints (96/day × 1,000 BOOZ) | ~35,040,000 |
| GM streaks (10k users, avg 1–3/day) | ~3,650,000–10,950,000 |
| Raffle rewards (100k BOOZ/week) | ~5,200,000 |
| Donations (est. 100 donors/day × 1,000 BOOZ) | ~36,500,000 |
| **Total rewards/year (approx)** | **~80–87M BOOZ** |

100M cap is a credibility ceiling — natural burn rate (10k BOOZ free slots) makes it practically deflationary at scale.

### LP Seeding Strategy
| Scenario | BOOZ minted | USDC paired | Implied price |
|---|---|---|---|
| No investor (bootstrap) | 500k–1M BOOZ | $500–1,000 | ~$0.001/BOOZ |
| 1 investor ($10k) | 2M BOOZ (vested) | $10,000 | ~$0.005/BOOZ |
| Multiple investors | Up to 10M BOOZ total | per deal | — |

Remaining treasury budget stays reserved — no obligation to mint it all upfront.

### Implementation Status
- [x] Treasury cap (10M, tranche-based) — in `BooztoryToken.sol` ✅
- [x] Hard cap (100M `MAX_SUPPLY`) — in `BooztoryToken.sol` ✅
- [x] `ExceedsMaxSupply` error on `mintReward`, `mintTreasury`, `crosschainMint` ✅
- [ ] Investor vesting script (`scripts/createVesting.ts`) — when needed

---

## 13. Superchain Expansion

### Architecture
- **One codebase** — single Next.js project, runtime detection determines behavior
- **Chain-specific content** — each chain has its own slot queue, raffle, and GM streaks
- **Shared token** — BOOZ is SuperchainERC20 (IERC7802); same CREATE2 address on every OP Stack chain; native bridging, no wrapped tokens
- **Liquidity** — one Uniswap pool on Base; users from other chains bridge BOOZ to trade there

### Runtime Detection
| Context | Wallet | Content |
|---|---|---|
| World Mini App | MiniKit | World Chain always |
| Farcaster Mini App | Farcaster SDK + QuickAuth | Base by default |
| Regular browser | RainbowKit / wagmi | Base by default |

### Contract Changes (before Base mainnet deploy)
- `BooztoryToken.sol` — `crosschainMint` + `crosschainBurn` authorized to Superchain bridge predeploy `0x4200...0028`; deploy via CREATE2 factory (`0x4e59b44847b379578588920cA78FbF26c0B4956C`) with deterministic salt
- `Booztory.sol`, `BooztoryRaffle.sol` — no changes needed; chain-specific, normal deploy

### World Chain
- **Chain ID:** 480
- **World ID:** available natively — enables sybil-resistant GM streaks
- Deploy order: run `deploy.ts` on World Chain → `BooztoryToken` lands at same CREATE2 address automatically → call `setBooztory()`, `setRewardToken()`, `setRaffle()` → add VRF consumer

### Roadmap
- [ ] Deploy BooztoryToken via CREATE2 factory (deterministic address)
- [ ] World Chain deployment + World Mini App
- [ ] OP Mainnet and other OP Stack chains
- [ ] Frontend chain toggle in browser (Base ↔ World Chain)

---

## 14. Leaderboard

### Categories (top 10 each)
| Category | Contract | Source event | Value tracked |
|---|---|---|---|
| Top Minters | Booztory | `SlotMinted` | Total slots minted (all-time) |
| Top Streakers | Booztory | `GMClaimed` | Highest streak ever reached |
| Top Points | Booztory | `PointsEarned` | Total points accumulated (all-time) |
| Top Creators | Booztory | `DonationReceived` → tokenId lookup | Total USDC received as creator |
| Top Donors | Booztory | `DonationReceived` | Total USDC donated (all-time) |
| Top Winners | BooztoryRaffle | `DrawCompleted` (address[] winners) | Total raffle wins (all-time) |

Connected wallet: show their value + position if in top 10, otherwise show value + "Outside top 10".

### Architecture
- **No contract changes** — indexes existing events already emitted
- **The Graph subgraph** — indexes both `Booztory.sol` + `BooztoryRaffle.sol` (one subgraph, two data sources)
- **`/api/leaderboard`** — queries The Graph, caches 30 min, serves frontend
- **`/leaderboard`** page — reads from API route only, zero RPC pressure

### Notes
- `DonationReceived` doesn't include creator address — subgraph stores `tokenId → creator` from `SlotMinted` and looks it up on each donation
- `DrawCompleted` emits `address[] winners` — subgraph increments win count for each address in the array
- `GMClaimed` event is in `Booztory.sol` but **missing from frontend ABI** in `lib/contract.ts` — must be added before building profile page GM history (not blocking for subgraph)

### Cache
- 30 min server-side cache on `/api/leaderboard`
- ~1,440 queries/month to The Graph — well within 100k free tier
- Show "Updated every 30 minutes" label on page

### Monthly Prize (future)
- Owner reviews top ranks at month end
- Manually distributes prize from accumulated fees
- No contract changes needed — manual send or simple `distributeLeaderboardPrizes(address[], uint256[])` owner function

### Implementation Steps

**Step 1 — Subgraph**
```bash
npm install -g @graphprotocol/graph-cli
graph init --from-contract <BOOZTORY_ADDRESS> --network base-sepolia
```
- Define entities in `schema.graphql`
- Write event handlers in `src/mappings.ts` for both contracts
- Deploy to Subgraph Studio (free) — update network to `base` at mainnet launch

**Step 2 — API route**
```
/api/leaderboard — query The Graph GraphQL endpoint, cache 30 min
```

**Step 3 — Frontend**
```
/leaderboard — 6 category tabs, top 10 each, wallet position
```

### Status
- [x] Subgraph v0.0.6 deployed (Base Sepolia, Booztory startBlock 39430960, Raffle startBlock 39429911) ✅
- [x] `/api/leaderboard` route — queries subgraph, 30 min cache ✅
- [x] `/leaderboard` page — 6 tabs, 30d/All Time, connected wallet row, mock fallback ✅
- [ ] Update subgraph to Base mainnet at launch (change network + addresses + USDC address in raffle.ts)

---

## 15. Profile Page

### Route
`/profile/[address]` — public per-wallet profile page

### Data to display
| Section | Source | Notes |
|---|---|---|
| Display name | Farcaster (mini app, own address) → Basename → ENS → truncated address | `useIdentity().displayName` |
| Total slots minted | `SlotMinted` events (The Graph) | All 3 mint paths |
| Total USDC received | `DonationReceived` events (The Graph) | Creator earnings |
| Total USDC donated | `DonationReceived` events (The Graph) | As donor |
| Current GM streak | `gmStreaks[address]` on-chain read | Live |
| Highest streak ever | `highestStreak[address]` on-chain read | Live |
| GM claim history | `GMClaimed` events (The Graph) | Full history |
| Points balance | `points[address]` on-chain read | Live |
| Slot history | `SlotMinted` events (The Graph) | Past content cards |
| Total raffle wins | `DrawCompleted` events (The Graph) | All-time wins |
| Leaderboard positions | From `/api/leaderboard` cache | Rank badges |

### ABI Note
`GMClaimed(address indexed user, uint16 streakCount, uint256 reward)` is defined in `Booztory.sol` but **missing from the frontend ABI** in `lib/contract.ts`. Must be added before building the profile page GM history feature.

### Architecture
- On-chain reads (name, streak, points) — wagmi `useReadContracts` multicall
- Historical data (slots, donations, GM history) — The Graph (same subgraph as leaderboard)
- No extra RPC pressure — reuses leaderboard subgraph

### Status
- [ ] Post-mainnet — depends on The Graph subgraph being deployed first

---

## 16. AI Integration Plan

### Overview
AI features are additive — none require smart contract changes. All integrations sit at the API layer (Next.js route handlers) using the Claude API (`claude-haiku-4-5` for speed and low cost).

---

### Feature Roadmap

#### Phase 1 — At Launch (low effort, high value)

| Feature | Where | How |
|---|---|---|
| **Content Moderation** | `/api/moderate` — called at slot submission | Pass URL + metadata to Claude; flag spam, adult content, scams before or after mint |
| **Smart Title & Description** | Submit content modal | On URL paste, fetch oEmbed metadata → Claude suggests optimized title + description for the slot |
| **AI Chatbot** | Floating chat button (all pages) | Claude answers app mechanics, on-chain data queries, wallet-specific questions |

#### Phase 2 — Post-Launch

| Feature | Where | How |
|---|---|---|
| **Content Categorization** | At mint time | Auto-tag content (music, gaming, art, news, etc.) — enables filtering on history/upcoming pages |
| **Spam / Sybil Detection** | `/api/moderate` | Detect wallets submitting repetitive or low-quality content; flag for review without blocking on-chain action |
| **Weekly Spotlight Report** | Cron job or owner-triggered | Auto-written weekly recap — "Top content this week on Booztory" — shareable on Farcaster/X |

#### Phase 3 — Growth Stage

| Feature | Where | How |
|---|---|---|
| **Personalized Feed** | Homepage | Track wallet engagement history → surface relevant upcoming slots first |
| **Creator Coach** | `/reward` or profile page | After slot ends, AI gives creator feedback on performance vs. week's trends |

---

### Chatbot Architecture

- **Route:** `/api/chat` — POST, streaming response
- **Model:** `claude-haiku-4-5-20251001` (fast, cheap)
- **System prompt:** App mechanics (FAQ), tokenomics, mint paths, raffle rules
- **Context injection:** Pass wallet address, BOOZ balance, current slot data per request
- **UI:** Floating chat button → bottom sheet (mobile) / popover (desktop)
- **Cost:** Negligible at current scale — thousands of messages per dollar

---

### Status
- [ ] Post-mainnet — chatbot first, moderation second
