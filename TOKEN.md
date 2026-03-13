# Booztory Token & Raffle System

Design notes for the ERC-20 reward token and weekly raffle mechanic.

---

## 1. ERC-20 Reward Token (BooztoryToken / BZTK)

### Token Model
- **Inflationary + Burns** (Ethereum model, not fixed cap like Bitcoin)
- Tokens mint from paid platform actions only → supply grows with real engagement
- Tokens burn when spent on platform utilities → deflationary pressure
- No hard cap — supply naturally tied to platform growth

### Soulbound vs Tradeable
- **Phase 1: Soulbound** — no market, no USD value, no farming incentive
- **Phase 2: Tradeable** — after utility is live; seed a Uniswap v3 BZTK/USDC pool from treasury
- Don't launch tradeable until at least one burn sink is live (discount mechanic)

### Reward Structure (paid actions only — no free claim)
| Action | Tokens |
|---|---|
| Mint a slot (1 USDC) | 1,000 |
| Donate (per 0.1 USDC, capped 500/day) | 100 |
| Daily GM streak day 1–7 | 5, 10, 15, 20, 25, 30, 35 |
| 7-day streak completion bonus | +50 |

No hourly free claim — eliminates sybil farming entirely (no World ID on Base).

### Burn Sinks (Token Utility)
| Spend | Cost |
|---|---|
| Discount on next slot (0.1 USDC off) | Burn 500 tokens |
| Boost slot visibility/position | Burn X tokens |
| Leaderboard badge (monthly) | Burn X tokens/month |
| Governance vote | Burn or stake |

### "Buy 10, Get 1 Free" Mechanic — FINALIZED
- Mint 10 slots with USDC → earn 10,000 BZTK
- Burn 10,000 BZTK → get 1 free slot (15 min)
- **Free slot does NOT earn tokens** — burn path is a dead end
- No infinite loop; platform still earns $10 USDC from the 10 paid mints

### Contract Architecture
- **Separate contract** from Booztory.sol — `BooztoryToken.sol`
- **Tight coupling**: Booztory.sol calls into BooztoryToken
  - `mintReward(address to, uint256 amount)` — called by Booztory after USDC-paid mint
  - `burnFrom(address from, uint256 amount)` — called by Booztory for free slot redemption
- New function in Booztory.sol: `mintSlotWithTokens(...)` — burns 10,000 BZTK, mints slot, no token reward
- Token contract address set on Booztory.sol via owner-only setter after both deployed

### Open Questions
- Token name/symbol: BZTK? Something else?
- GM streak: on-chain timestamp mapping or off-chain backend?
- Governance: snapshot voting or on-chain?
- Liquidity seeding: what % of supply reserved for treasury allocation at deploy?

---

## 2. Weekly Raffle (Booztory.sol addition)

### Rules — FINALIZED
- **Weekly** draw (not daily)
- **Multiple entries per wallet**: each mint = 1 entry (mint 5× = 5 entries)
- **One prize per wallet**: once selected, all that wallet's entries are removed
- **Threshold**: draw only runs if ≥ 350 mints that week (= 350 USDC revenue)
- **Minimum unique minters**: ≥ 5 unique wallets that week (need 5 distinct winners)
- **Skip**: if threshold or unique count not met, no draw that week (no rollover)
- **Trigger**: owner-triggered manually for V1; Chainlink Automation later

### Prize Structure
| Place | Prize |
|---|---|
| 1st | 50 USDC |
| 2nd | 40 USDC |
| 3rd | 30 USDC |
| 4th | 20 USDC |
| 5th | 10 USDC |
| **Total** | **150 USDC** |

Treasury keeps: 350 - 150 = **200 USDC minimum** per eligible week (~43% payout ratio).

### Randomness
- **Chainlink VRF v2.5** required — `block.timestamp`/`block.prevrandao` are manipulable by validators
- VRF coordinator on Base Mainnet: `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634`
- Requires LINK-funded subscription; contract must be added as VRF consumer after deploy
- One VRF request per draw; derive 5 winner indices from single seed using `keccak256(seed, i)`

### Contract Changes to Booztory.sol
- **Inherits `VRFConsumerBaseV2Plus`** instead of OZ Ownable (Chainlink brings its own ownership via `ConfirmedOwner`)
- **New constructor args**: `_vrfCoordinator`, `_subscriptionId`, `_keyHash`
- **`mintSlot()` change**: push `msg.sender` to `weeklyEntries[week]`; track unique count
- **`withdraw()` change**: subtracts `prizeReserve` — locked funds can't be drained before draw completes
- **New state**: `weeklyEntries`, `weeklyUniqueMinters`, `weekDrawn`, `prizeReserve`, `drawPrizes` (snapshot)
- **New functions**: `requestWeeklyDraw(week)`, `fulfillRandomWords()`, `setPrizes()`, `setDrawThreshold()`, `setVrfConfig()`

### Dependency
- `@chainlink/contracts` already installed

### Build Order
1. Implement raffle in Booztory.sol first (simpler, single contract)
2. Then build BooztoryToken.sol (separate contract, more complex coupling)
3. Resolve token utility (burn sinks) before making token tradeable
