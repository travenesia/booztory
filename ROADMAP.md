# Booztory Roadmap

Token system, raffle mechanics, and deployment progress.

---

## 1. ERC-20 Reward Token (BooztoryToken / BOOZ) — IMPLEMENTED

### Token Model
- **Inflationary + Burns** (Ethereum model, not fixed cap like Bitcoin)
- Tokens mint from paid platform actions only → supply grows with real engagement
- Tokens burn when spent on platform utilities → deflationary pressure
- No hard cap — supply naturally tied to platform growth

### Soulbound vs Tradeable
- **Phase 1: Soulbound** — no market, no USD value, no farming incentive
- **Phase 2: Tradeable** — owner calls `setSoulbound(false)` to enable transfers; seed a Uniswap v3 BOOZ/USDC pool from treasury
- Don't launch tradeable until at least one burn sink is live (discount mechanic)
- Enforcement: `_update()` override in ERC-20 blocks wallet-to-wallet transfers while soulbound; mint (`from == 0`) and burn (`to == 0`) always allowed

### Reward Structure (paid actions only — no free claim)
| Action | Tokens |
|---|---|
| Mint a slot (1 USDC) | 1,000 BOOZ |
| GM streak day 1 | 5 BOOZ |
| GM streak day 2 | 10 BOOZ |
| GM streak day 3 | 15 BOOZ |
| GM streak day 4 | 20 BOOZ |
| GM streak day 5 | 25 BOOZ |
| GM streak day 6 | 30 BOOZ |
| GM streak day 7 | 35 BOOZ |
| GM streak days 8–90 (flat) | 50 BOOZ/day |
| Milestone: Day 7 — Warrior | +50 BOOZ |
| Milestone: Day 14 — Elite | +250 BOOZ |
| Milestone: Day 30 — Epic | +350 BOOZ |
| Milestone: Day 60 — Legend | +500 BOOZ |
| Milestone: Day 90 — Mythic | +4,560 BOOZ |

Total earnable over full 90-day journey: ~10,000 BOOZ.

**Donation rewards removed** — too risky for self-farming (donate to own alt → earn BOOZ → 95% comes back). Donations remain 95/5 split with no token reward.

No hourly free claim — eliminates sybil farming entirely (no World ID on Base).

### Burn Sinks (Token Utility)
| Spend | Cost | Status |
|---|---|---|
| Free slot (burn only, no USDC) | Burn 10,000 BOOZ | ✅ Implemented |
| Discount on next slot (0.1 USDC off) | Burn 1,000 BOOZ | ✅ Implemented |
| Boost slot visibility/position | Burn X tokens | Planned |
| Leaderboard badge (monthly) | Burn X tokens/month | Planned |
| Governance vote | Burn or stake | Planned |

### "Buy 10, Get 1 Free" Mechanic — IMPLEMENTED
- Mint 10 slots with USDC → earn 10,000 BOOZ
- Burn 10,000 BOOZ via `mintSlotWithTokens()` → get 1 free slot (15 min)
- **Free slot does NOT earn tokens** — burn path is a dead end
- No infinite loop; platform still earns $10 USDC from the 10 paid mints

### Discount Mechanic — IMPLEMENTED
- Burn 1,000 BOOZ via `mintSlotWithDiscount()` → pay 0.9 USDC instead of 1 USDC
- **Discount path still earns full 1,000 BOOZ reward**
- Net BOOZ per discount mint: 1,000 earned - 1,000 burned = 0 (neutral, no farming loop)
- Max 1 discount per mint (not stackable)

### GM Streak — IMPLEMENTED (on-chain)
- Daily check-in via `claimDailyGM()`, one claim per UTC day
- Days 1–7: escalating rewards (5, 10, 15, 20, 25, 30, 35 BOOZ)
- Days 8–90: flat 50 BOOZ/day
- Missing a day resets streak to day 1
- Milestone bonuses at days 7, 14, 30, 60, 90 (one-time, bitmask-tracked)
- Journey completes at day 90 — no further claims possible
- On-chain via `block.timestamp / 1 days` for UTC day tracking

### Treasury Mint — IMPLEMENTED
- `mintTreasury(address to, uint256 amount)` — owner-only, **one-time** call
- Amount is not hardcoded — owner decides at call time (e.g. 2.5M, 10M, whatever)
- After first call, `treasuryMinted = true` and any second call reverts with `TreasuryAlreadyMinted`
- Use case: mint BOOZ to seed Uniswap v3 BOOZ/USDC liquidity pool before Phase 2
- Starting price determined by the ratio you deposit (e.g. 2.5M BOOZ + 2,500 USDC = $0.001/BOOZ)

### Contract Architecture — IMPLEMENTED
- **Separate contract**: `contracts/BooztoryToken.sol` (ERC-20, OZ5 ERC20 + Ownable)
- **Tight coupling**: Booztory.sol calls into BooztoryToken via `IBooztoryToken` interface
  - `mintReward(address to, uint256 amount)` — called by Booztory after paid mint / GM claim
  - `burnFrom(address from, uint256 amount)` — called by Booztory for free slot / discount redemption
  - `burn(uint256 amount)` — any holder can voluntarily burn own tokens
  - `mintTreasury(address to, uint256 amount)` — owner-only, one-time LP seed mint
- **Authorization**: `onlyBooztory` modifier on mint/burn; `onlyOwner` on treasury mint and admin
- **Deploy order**: Booztory first → BooztoryToken(booztoryAddress) → `setRewardToken(booztoryTokenAddress)` on Booztory

### Booztory.sol Mint Paths
| Function | Payment | BOOZ Earned | BOOZ Burned |
|---|---|---|---|
| `mintSlot()` | 1 USDC | 1,000 | 0 |
| `mintSlotWithTokens()` | None | 0 | 10,000 |
| `mintSlotWithDiscount()` | 0.9 USDC | 1,000 | 1,000 |

### Admin Setters (owner only)
- `setRewardToken(address)` — enable/disable rewards (address(0) = disabled)
- `setSlotMintReward(uint256)` — BOOZ per paid mint
- `setFreeSlotCost(uint256)` — BOOZ cost for free slot
- `setDiscountBurnCost(uint256)` — BOOZ cost for discount
- `setDiscountAmount(uint256)` — payment token discount (must be < slotPrice)
- `setGMDayRewards(uint256[7])` — rewards for streak days 1–7
- `setGMFlatDailyReward(uint256)` — flat reward for streak days 8–90
- `setGMMilestoneRewards(uint256[5])` — one-time bonuses at days 7, 14, 30, 60, 90

---

## 2. NFT (ERC-721 — Booztory Spotlight) — IMPLEMENTED

- **Name**: Booztory Spotlight
- **Symbol**: BOOST
- **Description**: "Every spotlight is a moment. Yours, forever on-chain."
- **Metadata**: On-chain base64 JSON — Content Type attribute only
- **Image**: Per content type, set via `setContentTypeImage(contentType, imageUrl)` — no image shown until set
- `external_url` points to booztory.com

### Admin Setters
- `setContentTypeImage(string, string)` — set NFT image per content type (youtube, tiktok, twitter, vimeo, spotify, or any future platform)

---

## 3. Weekly Raffle (BooztoryRaffle.sol) — IMPLEMENTED

Separate contract from Booztory.sol — keeps VRF complexity isolated, allows independent redeployment, avoids withdraw lockup issues.

### Rules
- **Weekly** draw (not daily)
- **Multiple entries per wallet**: each mint = 1 entry (mint 5× = 5 entries)
- **One prize per wallet**: duplicate winners re-rolled via linear probe
- **Threshold**: draw only runs if ≥ 100 entries that week (configurable via `setDrawThreshold()`)
- **Minimum unique minters**: ≥ winner count (enforced on-chain to prevent infinite loop in VRF callback)
- **Skip**: if threshold or unique count not met, no draw that week (no rollover)
- **Trigger**: owner-triggered manually; transfer USDC to raffle contract first, then call `requestWeeklyDraw(week)`
- **Funding**: manual — owner transfers USDC to raffle contract before triggering draw; `withdraw()` recovers unused funds

### Prize Structure (default, fully configurable via `setPrizes()`)
| Place | Prize |
|---|---|
| 1st | $25 USDC |
| 2nd | $20 USDC |
| 3rd | $15 USDC |
| 4th | $10 USDC |
| 5th–10th | $5 USDC each |
| **Total** | **$100 USDC** |

At 100 entries/week: treasury keeps 100 USDC revenue - 100 USDC prizes = **break-even minimum**.
At 96 mints/day (672/week): treasury keeps 572 USDC after 100 USDC payout (~85% margin).

### Configurable Setters (no redeploy needed)
- `setPrizes(uint256[])` — array length = winner count, each value = prize in USDC (6 decimals)
- `setDrawThreshold(uint256)` — minimum entries required
- `setMinUniqueMinters(uint256)` — minimum unique wallets (keep ≥ winner count)
- `setVrfConfig(...)` — update subscription ID, key hash, gas limit, confirmations
- `setBooztory(address)` — update Booztory contract address

### Randomness
- **Chainlink VRF v2.5** — `block.timestamp`/`block.prevrandao` are manipulable by validators
- One VRF request per draw; derive winner indices from single seed via `keccak256(seed, i)`
- Emergency: `resetDraw(week)` resets a stuck draw if VRF callback never arrives

### Chainlink VRF Setup (per network)

**Step 1 — Create a subscription**
1. Go to https://vrf.chain.link
2. Select the correct network (Base Sepolia for testing, Base for mainnet)
3. Click "Create Subscription" → confirm transaction
4. Note your **Subscription ID** (uint256)

**Step 2 — Fund the subscription with LINK**
- Base Sepolia: get free testnet LINK from https://faucets.chain.link
- Base Mainnet: buy LINK on an exchange or Uniswap, bridge to Base

**Step 3 — Deploy contracts**
```bash
# Testnet
VRF_SUBSCRIPTION_ID=<your_id> npx hardhat run scripts/deploy.ts --network base-sepolia

# Mainnet
VRF_SUBSCRIPTION_ID=<your_id> npx hardhat run scripts/deploy.ts --network base
```

**Step 4 — Add BooztoryRaffle as a consumer**
1. Go back to vrf.chain.link → your subscription
2. Click "Add Consumer"
3. Paste the deployed BooztoryRaffle address
4. Confirm transaction

Without this step, `requestWeeklyDraw()` will revert.

**VRF Contract Addresses (Base)**
| Network | VRF Coordinator | Key Hash (30 gwei) |
|---|---|---|
| Base Mainnet | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` | `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71` |
| Base Sepolia | `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` | `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71` |

Always verify these addresses at https://docs.chain.link/vrf/v2-5/supported-networks before deploying.

### Raffle Hook in Booztory.sol
- `raffle` state variable (default `address(0)` = disabled)
- `setRaffle(address)` — owner enables raffle after BooztoryRaffle is deployed
- `mintSlot()` and `mintSlotWithDiscount()` call `IRaffle(raffle).addEntry(msg.sender)` conditionally
- `mintSlotWithTokens()` (free/burn path) does NOT add entry — no USDC paid

### Deploy Order
1. Deploy Booztory.sol
2. Deploy BooztoryToken.sol (pass Booztory address)
3. Deploy BooztoryRaffle.sol (pass Booztory, USDC, VRF coordinator, subscriptionId, keyHash)
4. Call `setRewardToken(booztoryTokenAddress)` on Booztory
5. Call `setRaffle(raffleAddress)` on Booztory
6. Add BooztoryRaffle as consumer on Chainlink VRF subscription

---

## 4. Deployed Addresses (Base Sepolia — Testnet)

> ⚠️ These addresses are from a previous deployment. Contracts need redeployment with latest changes:
> contentTypeImage mapping, ERC-721 name/symbol (Booztory Spotlight / BOOST), tokenURI cleanup.

| Contract | Address |
|---|---|
| Booztory | `0xeA31644aC7b2E03bd8951795A6ccE0c858F2B12b` |
| BooztoryToken | `0x3B648BE7E66E89d5b7f5AEA78F5559Ce60E62721` |
| BooztoryRaffle | `0x96ce8856e8D9D789E58FDd171887e104e95204Db` |

Previously confirmed on old deploy:
- `setRewardToken()` and `setRaffle()` called on Booztory ✅
- Mint → 1,000 BOOZ confirmed working ✅
- Donation flow confirmed working ✅
- GM streak claim → BOOZ in wallet confirmed working ✅

---

## 5. Build Order

1. ~~Implement BooztoryToken.sol~~ ✅ Done
2. ~~Integrate rewards into Booztory.sol~~ ✅ Done (3 mint paths, GM streak, discount)
3. ~~Build BooztoryRaffle.sol~~ ✅ Done (Chainlink VRF v2.5, 10 winners, configurable)
4. ~~Write deploy script for all 3 contracts~~ ✅ Done
5. **Redeploy to Base Sepolia** — pending (contracts updated: contentTypeImage, NFT name/symbol, tokenURI)
   - After deploy: call `setRewardToken()`, `setRaffle()` on Booztory
   - Add BooztoryRaffle as consumer on Chainlink VRF subscription
6. Frontend integration:
   - ~~BOOZ balance in wallet dropdown~~ ✅ Done
   - ~~GM streak claim UI (modal + mobile drawer + confetti)~~ ✅ Done
   - `/reward` page (raffle progress, streak history, BOOZ stats) — **Next**
   - `mintSlotWithDiscount()` path in submission drawer — Planned
   - `mintSlotWithTokens()` path in submission drawer — Planned
7. Verify all 3 contracts on Basescan
8. Resolve remaining burn sinks (boost, badge, governance) before making token tradeable
9. Mainnet deployment (Base) — after testnet validation complete
10. Phase 2: `setSoulbound(false)` → `mintTreasury()` → seed Uniswap v3 BOOZ/USDC pool

---

## 6. Superchain Expansion (World Mini App + Multi-Chain)

### Architecture Decision
- **One codebase** — single Next.js project, runtime detection determines behavior
- **Chain-specific content** — each chain has its own slot queue, raffle, and GM streaks
- **Shared token** — BOOZ is a SuperchainERC20; same address on every OP Stack chain; native bridging via Superchain bridge (no wrapped tokens, no slippage)
- **Liquidity** — one Uniswap pool on Base; users from other chains bridge BOOZ there to trade; no fragmented liquidity

### Runtime Detection
| Context | Wallet | Content | Toggle |
|---|---|---|---|
| World Mini App (World App) | MiniKit | World Chain always | None |
| Regular browser | RainbowKit / wagmi | Base by default | Toggle to World available |

In regular browser, default chain is Base. Toggle button lets user switch to view World Chain content. Inside World App, content is always World Chain — no toggle needed.

### What SuperchainERC20 Enables
- BOOZ earned on Base can be bridged to World Chain natively (burn on source, mint on destination)
- World Chain deployment reuses same BOOZ address — no token migration ever needed
- Same earn/burn/discount/GM streak mechanics on every chain
- Phase 2 liquidity pool on Base serves all chains

### Contract Changes (before Base mainnet deploy)
- **`BooztoryToken.sol`** — add `IERC7802` (`crosschainMint` + `crosschainBurn` authorized to Superchain bridge predeploy `0x4200...0028`); remove `_booztory` from constructor (set via `setBooztory()` post-deploy)
- **`scripts/deploy.ts`** — deploy `BooztoryToken` via CREATE2 factory (`0x4e59b44847b379578588920cA78FbF26c0B4956C`) with deterministic salt; call `setBooztory()` after deploy
- **`Booztory.sol`**, **`BooztoryRaffle.sol`** — no changes needed; chain-specific, normal deploy

### World Mini App Deploy Order (future)
1. Run deploy script on World Chain — `Booztory.sol` + `BooztoryRaffle.sol` deploy normally; `BooztoryToken` lands at same CREATE2 address automatically
2. Call `setBooztory()`, `setRewardToken()`, `setRaffle()` on World Chain deployment
3. Add BooztoryRaffle (World Chain) as consumer on Chainlink VRF subscription for World Chain
4. Frontend: `MiniKit.isInstalled()` detects World App context → switches wallet, payment, and contract addresses to World Chain automatically

### World Chain Details
- **Chain ID**: 480
- **VRF**: Chainlink VRF v2.5 (confirm coordinator address at docs.chain.link before deploy)
- **World ID**: available natively — enables Sybil-resistant GM streaks and future anti-farming mechanics not possible on Base
