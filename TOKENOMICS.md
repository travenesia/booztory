# Booztory Raffle & Tokenomics Design

Last updated: 2026-03-21

---

## Points System

Users earn points through platform activity. Points are tracked on-chain per wallet.

**5 points = 1 raffle ticket** (burn on conversion, irreversible)

| Action | Points | Notes |
|---|---|---|
| Mint slot | 15 pts | Per mint (all 3 paths) |
| GM daily | 1 pt | Per day, requires active streak |
| GM Day 7 bonus | +1 pt | One-time per cycle |
| GM Day 14 bonus | +1 pt | One-time per cycle |
| GM Day 30 bonus | +2 pts | One-time per cycle |
| GM Day 60 bonus | +2 pts | One-time per cycle |
| GM Day 90 bonus | +3 pts | One-time per cycle, then veteran mode |
| GM veteran (day 91+) | 1 pt/day + 3 pts every 30 days | Continues indefinitely |
| Donate (any amount) | 5 pts + 1,000 BOOZ | Once per 24h, donor != creator. Extra donations beyond first earn no additional BOOZ or points. |

**Streak rules:**
- Miss one GM day → streak counter resets to day 1
- Highest streak day is tracked separately and displayed in UI — never resets
- Highest streak updates whenever current streak surpasses previous best (e.g. reach day 180, miss → highest = 180; reach day 185 next time → highest updates to 185)
- Bonus milestones are based on current streak day, not highest streak
- Donate points only apply when donating to another wallet's slot (tokenId owner ≠ donor)

### 30-Day Earning Simulation

| User type | Points | Tickets | Cost |
|---|---|---|---|
| GM only (perfect streak) | ~34 pts | 6 tickets | Free |
| Daily donor only | 150 pts | 30 tickets | 30 USDC |
| 1 mint + GM | ~49 pts | 9 tickets | 1 USDC |
| 1 mint + daily donate | 165 pts | 33 tickets | 31 USDC |

---

## Raffle Ticket System

- **5 points = 1 raffle ticket** (burn on conversion)
- Tickets are burned on raffle entry, win or lose
- More tickets entered in a raffle = higher weight (proportional chance)
- Users decide how many tickets to commit per raffle
- Unused tickets carry over to any future raffle

---

## Raffle Configuration (Admin)

Owner creates and configures each raffle independently. Multiple raffles can run concurrently.

### Prize Setup
- One or more ERC-20 token types per raffle (paste contract address)
- Default: BOOZ → fallback: USDC
- Sponsor ERC-20 supported — sponsor deposits tokens to raffle contract before draw
- If draw threshold not met → draw cancelled, sponsor tokens refunded

### Winner Distribution
- Owner sets winner count and individual prize amounts per token
- Example (100 USDC, 5 winners): `20, 20, 20, 20, 20`
- Example (100 USDC + 100,000 BOOZ, 5 winners):
  - USDC: `50, 30, 20, 0, 0`
  - BOOZ: `40000, 30000, 15000, 10000, 5000`
- Sum of prize arrays must equal total deposited amount

### Duration
- Owner sets duration: 1 day minimum, 90 days maximum
- Timer starts when owner hits create/start
- Raffles are numbered sequentially: Raffle #1, #2, #3...
- New raffle can start before previous one ends (concurrent)

---

## Prize Structure

| Condition | Prize Token |
|---|---|
| Sponsor confirmed | Sponsor's ERC-20 |
| No sponsor | BOOZ (default) |
| No BOOZ funded | USDC fallback |

---

## Sponsorship Model

### Pricing Tiers (default, owner-configurable)

| Duration | Prize Pool | Platform Fee | Sponsor Pays Total |
|---|---|---|---|
| 7 days | 100 USDC | 100 USDC | 200 USDC |
| 14 days | 200 USDC | 200 USDC | 400 USDC |
| 30 days | 400 USDC | 300 USDC | 700 USDC |

- Prize token: **USDC only** (default) — owner can whitelist other ERC-20s later
- Minimum amounts and fee rates are owner-configurable

### Application Flow

1. Sponsor submits form on `/sponsor` page → USDC `approve` + `submitApplication()` sends (prize + fee) to raffle contract
2. Application status: **Pending** (visible to submitter + admin only, filtered by wallet address)
3. Owner reviews and either:
   - **Accepts** → fee transferred to owner, prize locked for raffle — owner then creates raffle manually
   - **Rejects** → full refund (prize + fee) to sponsor
   - **No response in 3 days** → sponsor can call `claimRefund(applicationId)` — trustless auto-refund, no cron needed

### Ad Content (submitted with application)

- **Sponsor Name** — text field
- **Ad Type** — radio: Image / Embed Content / Text
  - Image: paste URL (jpeg, jpg, png, webp) + select ratio (1:1, 16:9, 9:16) + preview
  - Embed: auto-detect platform (YouTube, TikTok, etc.) — reuses existing `contentEmbed.tsx`
  - Text: max **200 characters** (including spaces)
- **Sponsor Link** — one URL (Discord, X, Telegram, or Website)

### Ad Data Storage

All ad content emitted as contract events on submission:
`SponsorApplicationSubmitted(id, sponsor, adType, adContent, adLink, duration, timestamp)`

No database needed — frontend reads events to show application status. Admin reads events to review.

### Ad Activation (on acceptance)

Owner signs a message off-chain:
```json
{
  "applicationId": 1,
  "sponsorAddress": "0x...",
  "adType": "image",
  "adContent": "https://...",
  "adLink": "https://...",
  "displayDays": 7,
  "startTimestamp": 1234567890
}
```
Frontend verifies signature = owner address → displays ad. No on-chain transaction needed.

### Ad Display

- **All devices (homepage):** floating toggle above featured content — visitor switches to show/hide sponsor ad
- **Desktop (other pages):** sidebar panels left/right alongside content
- Toggle is non-intrusive — users can dismiss
- Display duration: 7, 14, or 30 days (matches raffle duration)

---

## Anti-Gambling / Legal Design

| Requirement | How it's met |
|---|---|
| Free entry path (no purchase necessary) | GM daily — completely free |
| Free path is meaningful | ~6 tickets per 30-day raffle |
| Paid paths give better odds, not exclusive access | ✓ |
| No direct money → prize conversion | Points intermediary breaks the chain |
| Whale resistance | Donate capped at 5 pts + 1,000 BOOZ per 24h regardless of amount donated |
| Self-donate farming blocked | Points only awarded when donating to another wallet's tokenId |
| Framing | Loyalty rewards program, not a lottery |

> Legal review recommended before mainnet launch — jurisdiction laws vary (Germany, Belgium, some US states have stricter rules).

---

## Contract Changes Required

### BooztoryToken.sol
- Add raffle contract as authorized minter alongside Booztory.sol
- Allows raffle to mint fresh BOOZ directly to winners (no pre-funding needed)

### Booztory.sol
- Add `points` mapping: `mapping(address => uint256) public points`
- Add `streakDay` tracking per wallet (already partially exists via GM streak)
- `mintSlot` / `mintSlotWithDiscount` / `mintSlotWithTokens` → award 15 pts to caller
- `claimDailyGM` → award 1 pt + milestone bonus based on current streak day
- Milestone bonus logic inside `claimDailyGM`:
  - Day 7, 14 → +1 pt
  - Day 30, 60 → +2 pts
  - Day 91+ every 30 days → +3 pts
- `donate()` → award 5 pts + 1,000 BOOZ to donor if `donor != slot.creator` and 24h cooldown met (any amount qualifies; extra donations same day earn nothing more)
- Add `convertToTickets(uint256 points)` — burns points, mints raffle tickets

### BooztoryRaffle.sol (full redesign)
- Per-raffle struct: id, prizeTokens[], prizeAmounts[][], winners[], duration, startTime, status
- Sequential raffle IDs (auto-increment)
- Concurrent raffles supported (no dependency between raffles)
- `enterRaffle(uint256 raffleId, uint256 ticketAmount)` — burns tickets, records weighted entry
- Admin: `createRaffle(tokens[], amounts[][], winnerCount, duration)`
- Admin: `depositPrize(raffleId, token, amount)` — sponsor deposits
- Admin: `triggerDraw(raffleId)` — calls Chainlink VRF
- Chainlink VRF callback → selects winners by weight, one prize per wallet (re-roll duplicates)
- If threshold not met → `cancelRaffle(raffleId)` refunds sponsor tokens
- Tickets burned on entry (win or lose)

---

## What Stays the Same

- Chainlink VRF v2.5 for verifiable randomness
- One prize per wallet — duplicates re-rolled via linear probe
- Owner triggers draw manually
- `raffleDrawBlock` for UI to find draw transaction hash

---

## Default BOOZ Raffle (No Sponsor)

- Total prize pool: **100,000 BOOZ**
- Winner count: configurable by owner at raffle creation (1, 5, or 10 winners)
- Prize distribution: owner sets individual amounts that sum to 100,000 BOOZ
- Example (10 winners equal split): `10000, 10000, 10000, ..., 10000`
- Example (5 winners weighted): `40000, 25000, 15000, 12000, 8000`
- Raffle contract mints BOOZ directly to winners (authorized minter in BooztoryToken.sol)

---

## Implementation Status (as of 2026-03-24)

### UI / Frontend — `/reward` page
| Feature | Status |
|---|---|
| Create Raffle (owner panel) — per-winner prizes, 1d/7d/14d/30d/custom duration | ✅ Done |
| Cancel Raffle (owner) — hidden after raffle ends or is drawn | ✅ Done |
| Trigger Draw + Reset stuck VRF | ✅ Done |
| Draw Thresholds config (default threshold + min unique entrants) | ✅ Done |
| Withdraw USDC from raffle contract | ✅ Done |
| Raffle history dropdown — switch between any raffle by ID | ✅ Done |
| Prize display — per-winner breakdown, correct decimals (USDC 6 / BOOZ 18) | ✅ Done |
| `$BOOZ` token label on all prize displays | ✅ Done |
| Live countdown with seconds | ✅ Done |
| Status badges — Cancelled / Drawn ✓ / VRF pending / Awaiting draw / Ends in Xs | ✅ Done |
| Entry blocked when raffle is cancelled, drawn, or ended | ✅ Done |
| Max button on ticket entry input | ✅ Done |
| Winners in separate results section below card — with Basescan VRF tx link | ✅ Done |
| Prize table always visible — consecutive equal prizes grouped (e.g. 5–10) | ✅ Done |
| BOOZ raffle correctly shows no sponsor label (owner-funded) | ✅ Done |
| Sponsor dropdown excludes sponsors already matched to a live raffle | ✅ Done |
| Sponsor dropdown excludes queued (not-yet-started) sponsors — shown only once their ad slot begins | ✅ Done |
| Points balance, raffle ticket conversion, raffle entry | ✅ Done |
| RPC optimised — batch reads capped to last 5 raffles, 60s poll interval | ✅ Done |
| USDC raffle creation balance check uses available balance (total minus committed active raffles) | ✅ Done |
| `ActiveRaffleCard` auto-syncs to newest raffle when new one is created by owner | ✅ Done |

### UI / Frontend — `/sponsor` page
| Feature | Status |
|---|---|
| Sponsor application form (name, ad type, content, link, duration) | ✅ Done |
| USDC approve + submitApplication flow | ✅ Done |
| Application status visible to submitter (Pending / Accepted / Rejected) | ✅ Done |
| Owner Accept / Reject buttons (visible to owner wallet only) | ✅ Done |
| Sponsor ad display — toggle (homepage) + sidebar (desktop, other pages) | ✅ Done |
| Active ad correctly shows current (not queued) sponsor — `useSponsorAd` guards `acceptedAt <= now` | ✅ Done |
| Refund UX — Rejected shows info message (auto-refunded); Pending+3d shows Claim Refund | ✅ Done |
| Sponsor ad popup modal — panel header / body / footer layout | ✅ Done |
| Ad countdown timer — live D:HH:MM:SS format (1-second interval) | ✅ Done |
| Ad panel footer — tagline left, social links right (all 3 display variants) | ✅ Done |
| Ad body padding — 4px (p-1) | ✅ Done |
| Ad content fitting — ResizeObserver width measurement, pixel-exact sizing for all ratios/types | ✅ Done |
| Full-viewport-width desktop popup modal (48px top/bottom) | ⏳ In progress — layout refinement pending |

### Smart Contracts
| Contract | Status |
|---|---|
| `Booztory.sol` — 3 mint paths, GM streak, points, donations | Deployed on Base Sepolia ✅ |
| `BooztoryToken.sol` (BOOZ) | Deployed on Base Sepolia ✅ |
| `BooztoryRaffle.sol` — VRF v2.5, concurrent raffles, sponsor applications, `acceptedAt`, ETH prize support, ad queue (`nextAdStartTime`), first-submitted-first-served enforcement, 30d refund timeout | Redeployed on Base Sepolia ✅ |
| Base Sepolia wiring (setAuthorizedMinter × 2, setRewardToken, setRaffle) | Done ✅ |
| Add BooztoryRaffle as Chainlink VRF consumer | Done ✅ |
| Base Mainnet deployment | Pending |

---

## Open Questions (finalize before mainnet)

- [x] When a sponsor raffle runs alongside a default BOOZ raffle, do both show ads or only the sponsor ad? → **Only sponsor ads show. BOOZ (owner-funded) raffles have no ad placement — ad slots are paid-only.** ✅
- [x] Can a sponsor submit multiple applications for consecutive periods? → **Yes. Accepted ads chain automatically via `nextAdStartTime`. Acceptance enforces first-submitted-first-served order on-chain — reject earlier submissions to skip the queue.** ✅
- [x] Should cancelled raffles still appear in the raffle history dropdown, or be hidden? → **Show all raffles including cancelled ones.** ✅

---

## To Do — `/reward` Page

### Owner panel
- [ ] Add `setRaffleThresholds(raffleId, threshold, minUnique)` UI — override thresholds on a specific raffle after creation
- [ ] Show contract BOOZ balance (for BOOZ-prize raffles funded by sponsor deposit, if needed)
- [ ] Consider: progress indicator during multi-step USDC raffle creation (approve → create → deposit)

### Raffle card (`ActiveRaffleCard`)
- [ ] Show raffle start date alongside end date
- [ ] On drawn raffle: show winner ENS/Basename instead of raw address (currently truncated hex)
- [ ] Ticket entry: validate input doesn't exceed user's available ticket balance before submitting
- [ ] Decide: should cancelled raffles show the prize table or hide it?

### General
- [ ] Test full raffle lifecycle on Base Sepolia: create → enter → draw → winners displayed
- [ ] Test USDC raffle (3-tx flow: approve → createRaffle → depositPrize)
- [ ] Test BOOZ raffle (1-tx flow: createRaffle only, minted at draw)
- [ ] Set `defaultDrawThreshold` and `defaultMinUniqueEntrants` to low values for testnet (e.g. 1 / 1)
- [ ] Decide final production threshold values before mainnet

---

## To Do — `/sponsor` Page

### Application flow
- [x] Refund claim UI — Rejected: auto-refund message; Pending+3d: Claim Refund button ✅
- [ ] Show countdown to auto-refund deadline on Pending applications (submitter view)
- [ ] Validate ad image URL is reachable before submit (optional but helpful)
- [ ] After Accept: owner still needs to manually create raffle via owner panel — consider linking directly

### Ad display
- [x] Resolve open question: concurrent sponsor + BOOZ raffle — which ad shows? → **Only active (started) sponsor ads show. Queued sponsors are invisible until their slot begins.** ✅
- [x] Ad queuing — `acceptedAt = max(now, nextAdStartTime)` implemented in contract. Ads chain automatically, no overlap. First-submitted-first-served enforced on-chain. ✅
- [~] Full-viewport-width desktop popup modal — in progress, layout refinement pending (2026-03-24)
- [ ] Test ad display on all pages (homepage toggle + desktop sidebar)
- [ ] Verify ad content renders correctly for all 3 ad types (image, embed, text)

---

## Future Token Plan

### Projected Emission (current activity baseline)

| Source | BOOZ/year |
|---|---|
| Slot mints (96/day × 1,000 BOOZ) | ~35,040,000 |
| GM streaks (10k users, avg 1–3/day) | ~3,650,000–10,950,000 |
| Raffle rewards (100k BOOZ/week) | ~5,200,000 |
| Donations (est. 100 donors/day × 1,000 BOOZ, once per 24h) | ~36,500,000 |
| **Total (approx)** | **~80–87M BOOZ/year** |

### Mint Cap Design — Option B (Total Minted Cap)

- **Hard cap: 250,000,000 BOOZ** total ever minted across all time
- Cap tracks **gross mints only** — burns do not refill the budget
- Treasury allocation (10M, one-time) already capped in contract
- Reward minting (slots, GM, raffles) currently unlimited — cap to be added before DEX listing

**Why Option B over total supply cap:**
- Burns reduce circulating supply freely without affecting the minting ceiling
- Investors see two numbers: total ever minted vs current circulating supply
- Predictable, transparent ceiling — max 250M BOOZ will ever exist

**Projected timeline:**
- Year 1: ~60M minted (50M rewards + 10M treasury)
- Year 5: ~250M cap reached at current growth rate
- After cap: burn-only economy — users must buy BOOZ on DEX to access utility

**After cap is reached:**
- `mintReward()` reverts — no new BOOZ created
- Platform shifts to circulation economy (buy on DEX → burn for slots/tickets)
- Cap can be raised by owner via `setMaxSupply(newCap)` — same contract, no migration, no token redeployment
- Recommended: raise cap only with community consent

### Burning Mechanism
- `mintSlotWithTokens()` — burns 10,000 BOOZ for a free slot
- `convertToTickets()` — burns points (indirectly reduces earning incentive)
- `burn()` — any holder can voluntarily burn
- As platform scales, burn rate grows with usage — natural deflationary pressure

### Implementation Status
- [x] Treasury cap (10M, one-time) — implemented in `BooztoryToken.sol` ✅
- [ ] Total minted cap (250M) — to be added to `BooztoryToken.sol` before DEX listing
- [ ] `setMaxSupply()` owner function — allows raising cap without redeployment

---

## To Do — Deployment

### Base Sepolia (testing)
- [ ] Set `defaultDrawThreshold(1)` + `setDefaultMinUniqueEntrants(1)` for testnet (currently 100 / 20)
- [ ] Call `setContentTypeImage()` for each platform (youtube, tiktok, twitter, vimeo, spotify, twitch)
- [ ] Add `BooztoryRaffle` as consumer on Chainlink VRF subscription (if not already)

### Base Mainnet
- [ ] Answer open questions (see above) before launch
- [ ] Remove vestigial `IRaffle.addEntry()` from `Booztory.sol` (silently fails, harmless but dead code)
- [ ] Set production values: `defaultDrawThreshold`, `defaultMinUniqueEntrants`
- [ ] Full deploy: `npx hardhat run scripts/deploy.ts --network base`
- [ ] Verify all 3 contracts on Basescan
- [ ] Add `BooztoryRaffle` as consumer on Chainlink VRF subscription (mainnet)
