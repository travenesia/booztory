# World Mini App Integration — Progress Tracker

> **Base Mainnet app is LIVE and UNAFFECTED.** All World Chain work is additive.
> World Mini App path is gated behind `MiniKit.isInstalled()` — only activates inside World App.

---

## Network Details

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| World Chain Mainnet | 480 | `https://worldchain-mainnet.g.alchemy.com/public` | https://worldscan.org |
| World Chain Sepolia | 4801 | `https://worldchain-sepolia.g.alchemy.com/public` | https://worldchain-sepolia.explorer.alchemy.com |

---

## Architecture Overview

```
World App (phone)
    └─ MiniKit.isInstalled() = true
           └─ World Chain (480) contracts
           └─ MiniKit.sendTransaction() + waitForWorldOp() polling
           └─ World wallet auth (MiniKit.walletAuth → SIWE-compatible)
           └─ World ID cloud-only verification (session-gated; requireVerification = false on-chain)

Warpcast / Browser / Base App
    └─ MiniKit.isInstalled() = false  ← existing paths untouched
           └─ Base Mainnet (8453) contracts
           └─ wagmi writeContractAsync / sendBatchWithAttribution
           └─ Farcaster QuickAuth / SIWE + RainbowKit
```

---

## Phase 1 — Smart Contracts ✅ COMPLETE

| File | Status | Notes |
|---|---|---|
| `contracts/world/BooztoryWorld.sol` | ✅ Done | ERC-721 spotlight + World ID v3 gate + commit-reveal randomness support |
| `contracts/world/BooztoryRaffleWorld.sol` | ✅ Done | Commit-reveal randomness (no VRF) + World ID v3 gate |
| `contracts/BooztoryToken.sol` | ✅ Shared | No changes — CREATE2 same address on World Chain as Base |

### Key differences: World Chain contracts vs Base contracts

| Aspect | Base | World Chain |
|---|---|---|
| Randomness | Chainlink VRF v2.5 (push callback) | Commit-Reveal — `commitDraw()` → `revealDraw()` |
| Human gate | None | Cloud-only World ID verification — session/frontend enforced; `requireVerification = false` on-chain |
| NFT pass | ✅ Included | Removed (fresh deployment, add later if needed) |
| VRF subscription | Required | None |
| External oracle | Chainlink | None — pure Solidity |
| Draw steps | 1 tx (auto callback) | 2 txs within 256 blocks (~8.5 min) |

### World ID Implementation — Address Book Gate (2026-04-19)

**Gate (on-chain, trustworthy):**
- `getIsUserVerified(address, rpcUrl)` from `@worldcoin/minikit-js/address-book`
- Queries WorldIDAddressBook contract `0x57b930D551e677CC36e2fA036Ae2fe8FdaE0330D` on World Chain
- Returns `true` if user is orb-verified — no ZK proof flow needed in-app
- Called in `useVerifyHuman` via `useEffect` on address change
- `canProceed = !isWorldApp() || isWorldVerified || isOrbVerified`

**Why not IDKit inside World App:**
- `IDKitRequestWidget` renders `null` when `window.WorldApp` is detected (IDKit source confirmed)
- WASM init (`initIDKit()`) loads from `world-id-assets.com` CDN — fails silently in World App WebView
- Result: widget silently resets after 2.5s, `/api/worldid/rp-signature` called repeatedly with no modal

**IDKit ZK flow (browser/desktop only — still wired as fallback):**
- `WorldIDVerifyButton` → `/api/worldid/rp-signature` → IDKit modal → `/api/worldid/verify` → Redis nullifier
- Session `worldVerified: true` — JWT now always re-checks Redis on refresh (key deletion resets it)

**Gated actions (frontend/session — contract never blocks):**
- GM, Submit content, Convert tickets, Enter raffle — show `WorldIDVerifyButton` if `!canProceed`
- Non-World App users always proceed (`canProceed = true`)

**Not gated:** Donate, Sponsor application, Claim refund

**On-chain:** `requireVerification = false` on both contracts. No on-chain ZK proof required.

⚠ **World ID v4 migration required before April 1, 2027.** See: https://docs.world.org/world-id/migration

### Confirmed addresses

| Item | Mainnet | Sepolia |
|---|---|---|
| WorldIDRouter | `0x17B354dD2595411ff79041f930e491A4Df39A278` | `0x57f928158C3EE7CDad1e4D8642503c4D0201f611` |
| USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` | `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` |
| CREATE2 Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | same |

---

## Phase 2 — Deploy Script ✅ COMPLETE

| File | Status | Notes |
|---|---|---|
| `scripts/deployWorld.ts` | ✅ Done | 7-step deploy + WorldIDRouter addresses + post-deploy instructions |
| `hardhat.config.ts` | ✅ Done | world-chain (480) + world-chain-sepolia (4801) + Worldscan explorer |

### Deploy commands

```bash
# Testnet (get ETH first: https://www.l2faucet.com/world)
npx hardhat compile
npx hardhat run scripts/deployWorld.ts --network world-chain-sepolia

# Mainnet (after testnet QA passes)
npx hardhat run scripts/deployWorld.ts --network world-chain
```

### Post-deploy: enable World ID (from owner wallet)

```bash
# Replace <APP_ID> with your app ID from developer.worldcoin.org (format: app_xxxxxxxx)
# Call on both BooztoryWorld and BooztoryRaffleWorld:

BooztoryWorld.setWorldId("<WORLDID_ROUTER>", "<APP_ID>", "verify-human")
BooztoryRaffleWorld.setWorldId("<WORLDID_ROUTER>", "<APP_ID>", "verify-human")

# Enable enforcement on MAINNET only (leave false on Sepolia for QA):
BooztoryWorld.setRequireVerification(true)
BooztoryRaffleWorld.setRequireVerification(true)

# On SEPOLIA — bypass verification for QA testing:
BooztoryWorld.setVerifiedHuman(<YOUR_TEST_WALLET>, true)
BooztoryRaffleWorld.setVerifiedHuman(<YOUR_TEST_WALLET>, true)
```

---

## Phase 3 — Frontend Integration ✅ COMPLETE

### 3a. Install MiniKit

```bash
pnpm add @worldcoin/minikit-js
```

### 3b. Add `MiniKitProvider` to `app/layout.tsx`

```tsx
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider"

<WagmiProvider>
  <SessionProvider>
    <MiniKitProvider appId={process.env.NEXT_PUBLIC_WORLD_APP_ID}>
      {children}
    </MiniKitProvider>
  </SessionProvider>
</WagmiProvider>
```

### 3c. Add `isWorldApp()` to `lib/miniapp-flag.ts`

```ts
import { MiniKit } from "@worldcoin/minikit-js"

export function isWorldApp(): boolean {
  return typeof window !== "undefined" && MiniKit.isInstalled()
}
```

### 3d. Add World Chain to wagmi config (`lib/wagmi.ts`)

```ts
import { worldchain } from "viem/chains"
// or define manually:
// id: 480, name: "World Chain", nativeCurrency: { ETH }
// Add to chains array alongside existing base chain
```

### 3e. World-specific contract addresses (`lib/contract.ts` or new `lib/contractWorld.ts`)

```ts
export const WORLD_BOOZTORY_ADDRESS = process.env.NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS!
export const WORLD_RAFFLE_ADDRESS   = process.env.NEXT_PUBLIC_WORLD_RAFFLE_ADDRESS!
export const WORLD_TOKEN_ADDRESS    = process.env.NEXT_PUBLIC_WORLD_TOKEN_ADDRESS!
export const WORLD_USDC_ADDRESS     = process.env.NEXT_PUBLIC_WORLD_USDC_ADDRESS!
// ABIs: BooztoryWorld uses same ABI shape as Booztory.sol (minus NFT pass functions)
//       BooztoryRaffleWorld uses same ABI shape minus Chainlink, plus commit-reveal views
```

### 3f. New hook: `hooks/usePaymentWorld.tsx`

Mirror of `hooks/usePayment.tsx` using `MiniKit.sendTransaction()`:
- Uses `MiniKit.commandsAsync.sendTransaction({ transaction: [...] })`
- Returns `userOpHash` (not a tx hash)
- Confirmation via `useWaitForTransactionReceipt` with the finalised tx hash from the receipt
- Contracts are `WORLD_BOOZTORY_ADDRESS`

### 3g. New hook: `hooks/useDonationWorld.tsx`

Mirror of `hooks/useDonation.tsx` for World Chain path.

### 3h. World ID verification hook: `hooks/useVerifyHuman.ts`

Cloud-only pattern — no on-chain ZK proof submission:
- `handleIDKitSuccess(result)` → `POST /api/worldid/verify` → session `worldVerified: true`
- `canProceed = !isWorldApp() || isWorldVerified` — gates GM, Submit, Convert, Raffle
- `isWorldVerified` sourced from `session.user.worldVerified` (Redis-backed, permanent)
- `WorldIDVerifyButton` in `components/world/WorldIDVerifyButton.tsx` — fetches RP signature, opens IDKit modal

### 3i. Auth — World wallet auth path in `connectWallet.tsx`

```ts
if (isWorldApp()) {
  // MiniKit.commandsAsync.walletAuth({ nonce, ... }) → SIWE-compatible
  // POST to /api/complete-siwe (reuse existing endpoint)
} else if (isMiniApp()) {
  // Farcaster QuickAuth (existing)
} else {
  // SIWE + RainbowKit (existing)
}
```

### 3j. World-specific env vars

```bash
# .env.local — add after existing Base vars
NEXT_PUBLIC_WORLD_APP_ID=              # from developer.worldcoin.org
NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS=    # from deployWorld.ts output
NEXT_PUBLIC_WORLD_TOKEN_ADDRESS=       # same as Base (CREATE2)
NEXT_PUBLIC_WORLD_RAFFLE_ADDRESS=      # from deployWorld.ts output
NEXT_PUBLIC_WORLD_USDC_ADDRESS=        # USDC on World Chain
```

### 3k. Dev Portal contract allowlisting (REQUIRED before any MiniKit tx works)

Register in https://developer.worldcoin.org → your mini app → Contracts:
- `NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS`
- `NEXT_PUBLIC_WORLD_RAFFLE_ADDRESS`
- `NEXT_PUBLIC_WORLD_USDC_ADDRESS` (USDC)
- `NEXT_PUBLIC_WORLD_TOKEN_ADDRESS` (BOOZ)

---

## Phase 4 — Testing (Sepolia + ngrok) 🔄 IN PROGRESS

### Setup

```bash
pnpm dev                   # terminal 1
ngrok http 3000            # terminal 2 → copy https://xxx.ngrok.io
```

In World Developer Portal:
1. Create staging app "Booztory Dev"
2. Set App URL → ngrok https URL
3. Allowlist World Chain **Sepolia** contracts

### Test checklist

| Feature | Contract call | Status |
|---|---|---|
| World ID verify (cloud-only) | `POST /api/worldid/verify` → session | ✅ confirmed 2026-04-13 |
| Mint slot (standard — USDC) | `BooztoryWorld.mintSlot()` | ✅ confirmed on-chain |
| Mint slot (discount, burn BOOZ) | `BooztoryWorld.mintSlotWithDiscount()` | ✅ confirmed on-chain |
| Mint slot (WLD) | `BooztoryWorld.mintSlotWithWLD()` | ✅ confirmed on-chain |
| Mint slot (WLD + discount) | `BooztoryWorld.mintSlotWithWLDDiscount()` | ✅ wired |
| Mint slot (free, burn BOOZ) | `BooztoryWorld.mintSlotWithTokens()` | ⬜ |
| Donate (USDC) | `BooztoryWorld.donate()` | ✅ confirmed 2026-04-13 |
| Donate (WLD) | `BooztoryWorld.donateWithWLD()` | ✅ confirmed 2026-04-13 |
| Claim daily GM | `BooztoryWorld.claimDailyGM()` | ✅ confirmed 2026-04-13 |
| Convert tickets | `BooztoryWorld.convertToTickets()` | ✅ confirmed 2026-04-13 |
| Enter raffle | `BooztoryRaffleWorld.enterRaffle()` | ✅ confirmed 2026-04-19 |
| Commit draw | `BooztoryRaffleWorld.commitDraw()` | ⬜ |
| Reveal draw | `BooztoryRaffleWorld.revealDraw()` (within 256 blocks) | ⬜ |
| Sponsor apply | `BooztoryRaffleWorld.submitApplication()` | ⬜ 200 USDC fee |
| Admin: accept/reject | `BooztoryRaffleWorld.acceptApplication()` | ⬜ |
| World wallet auth | `MiniKit.walletAuth()` → `/api/complete-siwe` | ✅ working |
| `userOpHash` confirmation | `waitForWorldOp()` polling Developer Portal API | ✅ implemented |
| BOOZ reward received | After mint/GM on World Chain | ✅ confirmed (1,000 BOOZ per mint) |
| Admin panel overview | `nextTokenId` read (World tokens start at 0) | ✅ fixed 2026-04-13 |

---

## Phase 5 — World Chain Mainnet Launch 🔄 IN PROGRESS

- [x] Deploy to World Chain Mainnet ✅ 2026-04-06
- [x] Update `NEXT_PUBLIC_WORLD_*` env vars in .env.local ✅
- [x] Register Mainnet contracts in Dev Portal production app (allowlist 4 addresses) ✅ 2026-04-07
- [x] Frontend fully wired — all pages World-aware (stats, leaderboard, profile, history, upcoming, sponsor, admin) ✅
- [x] `usePaymentWorld` + `useDonationWorld` — `waitForWorldOp()` confirmation polling ✅
- [x] `useIdentity` — World ID username/avatar resolution via `MiniKit.getUserByAddress` ✅
- [x] Goldsky subgraph deployed + live — `booztory-world/1.0.3` indexing from block 28,076,390 ✅ 2026-04-08
- [x] `WORLD_SUBGRAPH_URL` in `.env.local` ✅
- [x] Cloud-only World ID verification ✅ 2026-04-08 — `useVerifyHuman` rewritten, `/api/worldid/verify` cloud-only, `requireVerification = false` on both contracts, WorldIDVerifyButton gates removed from donate + sponsor
- [x] World admin panel (`/admin/world/*`) — full parity with Base admin ✅ 2026-04-08 — all contract setters, createRaffle UI, commit-reveal draw (commitDraw/revealDraw/resetDraw), sponsor accept/reject, token admin, verification controls, auto chain switch on layout mount
- [x] Re-register new BooztoryWorld address in Dev Portal allowlist ✅ 2026-04-13
- [x] QA — World ID verify, GM, donate USDC/WLD, convert tickets, admin panel ✅ 2026-04-13
- [x] Verify contracts on Worldscan ✅ 2026-04-13 (BooztoryWorld, RaffleWorld, USDC, WLD, Permit2)
- [x] Update `NEXT_PUBLIC_WORLD_*` env vars in Vercel ✅ 2026-04-13
- [x] **Fix donation stats + WLD tracking** — new BooztoryWorld `0x14Fb9124b2E376c250DCf73336912eD6EB6e1219` (block 28,382,487); adds `WLDSlotMinted` event (mintType "wld"/"wld-discount" in subgraph) + `paymentToken` param on `DonationReceived`; subgraph `booztory-world/1.0.12` ✅ 2026-04-14
- [x] Subgraph `booztory-world/1.0.12` deployed to Goldsky ✅ 2026-04-14
- [x] **Subgraph v1.0.13** — `GMMilestoneReached` handler (milestone bonus BOOZ summed into GMClaimEvent) + `RaffleCancelled` handler (cancelled entries show "Cancelled" instead of "Awaiting Draw") ✅ 2026-04-14
- [x] **Profile/dropdown Base fix** — `profileQuery(addr, isWorld)` now gates World-only fields (`wldAmount`, `paymentToken`, `cancelledRaffles`) — Base was silently broken ✅ 2026-04-14
- [x] **Profile WLD display** — mint shows `-3.45 $WLD` (actual amount from `wldAmount`); donations show `-$1.00 (WLD)` (USD-equiv) ✅ 2026-04-14
- [x] **GM modal** — "Highest Streak · Day X" fixed to "Day X · Best: ⚔️ Warrior" with CSS hover tooltip ✅ 2026-04-14
- [x] Deploy subgraph `booztory-world/1.0.13` to Goldsky + update `WORLD_SUBGRAPH_URL` in `.env.local` and Vercel ✅ 2026-04-14
- [x] Re-register `0x14Fb9124b2E376c250DCf73336912eD6EB6e1219` in Dev Portal ✅ 2026-04-14
  - ERC-20 (Permit2): USDC `0x79A02482...` · BOOZ `0x48A7199f...` · WLD `0x2cFc85d8...`
  - Contract entrypoints: BooztoryWorld `0x14Fb9124...` · RaffleWorld `0x5DED6db7...` · USDC · WLD · Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- [x] Deploy subgraph `booztory-world/1.0.13` to Goldsky + update `WORLD_SUBGRAPH_URL` in `.env.local` ✅ 2026-04-14
- [x] Update `NEXT_PUBLIC_WORLD_BOOZTORY_ADDRESS` + `WORLD_SUBGRAPH_URL` in Vercel ✅ 2026-04-14
- [x] Push code to Vercel ✅ 2026-04-19
- [x] Goldsky subgraph `booztory-world/1.0.14` redeployed — fixed writer crash ✅ 2026-04-19
- [x] Live raffle pill — World App now queries World Chain raffle contract ✅ 2026-04-19
- [x] World raffle tuple fix — 11 fields (World) vs 10 fields (Base) corrected ✅ 2026-04-19
- [x] World ID gate — replaced IDKit WebView flow with `getIsUserVerified` Address Book ✅ 2026-04-19
- [x] Reward page — `waitForWorldOp` awaited before refetch on convert + enter raffle ✅ 2026-04-19
- [x] Stats cache reduced to 60s, leaderboard to 5 min ✅ 2026-04-19
- [ ] Submit mini app to World App Store for review
- [ ] QA remaining: Sponsor apply (200 USDC), Commit+Reveal draw (admin)

---

## Deployed Addresses

### World Chain Sepolia (testnet — 4801)

| Contract | Address | Status |
|---|---|---|
| BooztoryWorld | — | ⬜ pending |
| BooztoryToken (BOOZ) | — (same as Base via CREATE2) | ⬜ pending |
| BooztoryRaffleWorld | — | ⬜ pending |
| USDC | `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` | ✅ confirmed |
| WorldIDRouter | `0x57f928158C3EE7CDad1e4D8642503c4D0201f611` | ✅ confirmed |

### World Chain Mainnet (480) — DEPLOYED ✅ 2026-04-13 (redeployed)

| Contract | Address | Status |
|---|---|---|
| BooztoryWorld | `0x14Fb9124b2E376c250DCf73336912eD6EB6e1219` | ✅ deployed (block 28,382,487) |
| BooztoryToken (BOOZ) | `0x48A7199f8ebFBFd108cE497cCe582c410D40d5D9` | ✅ deployed (CREATE2) |
| BooztoryRaffleWorld | `0x5DED6db77ea2C0476402145A984DD32bc6cAD89C` | ✅ deployed |
| USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` | ✅ confirmed |
| WorldIDRouter | `0x17B354dD2595411ff79041f930e491A4Df39A278` | ✅ confirmed |
| Deployer/Owner | `0xA49CEE842116A89299A721D831BCf0511E8F6A15` | ✅ confirmed |

### Post-deploy status

| Step | Status | Notes |
|---|---|---|
| .env.local updated | ✅ Done | All `NEXT_PUBLIC_WORLD_*` vars set |
| Dev Portal contract allowlist | ⚠️ Re-register | BooztoryWorld redeployed — register `0x7F4799C48cFb11e1fdfE8e05e0B9DbC3e8Cf51b4` |
| Contract verification (Worldscan) | ⬜ Pending | Needs `WORLDSCAN_API_KEY` in .env.local |
| World ID (`setWorldId`) | ✅ Done | `scripts/setupWorld.ts` ran post-redeploy |
| `setRequireVerification(false)` | ✅ Done | Both contracts — cloud-only pattern, no on-chain gating |

### Dev Portal allowlist (REQUIRED before MiniKit transactions work)

```
Go to: https://developer.worldcoin.org → app_8d4c76e0cea57e5f01c3c51699b96dac → Contracts

Contracts (World Chain 480):
  0x7F4799C48cFb11e1fdfE8e05e0B9DbC3e8Cf51b4  (BooztoryWorld — redeployed 2026-04-13)
  0x5DED6db77ea2C0476402145A984DD32bc6cAD89C  (BooztoryRaffleWorld)

ERC-20 tokens (World Chain 480):
  0x79A02482A880bCE3F13e09Da970dC34db4CD24d1  (USDC)
  0x48A7199f8ebFBFd108cE497cCe582c410D40d5D9  (BOOZ)
  0x2cFc85d8E48F8EAB294be644d9E25C3030863003  (WLD — for WLD donation/payment paths)
```

### Contract verification commands (run when WORLDSCAN_API_KEY is ready)

```bash
npx hardhat verify --network world-chain 0x7F4799C48cFb11e1fdfE8e05e0B9DbC3e8Cf51b4 "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1"
npx hardhat verify --network world-chain 0x48A7199f8ebFBFd108cE497cCe582c410D40d5D9 "0xA49CEE842116A89299A721D831BCf0511E8F6A15"
npx hardhat verify --network world-chain 0x5DED6db77ea2C0476402145A984DD32bc6cAD89C "0x7F4799C48cFb11e1fdfE8e05e0B9DbC3e8Cf51b4" "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1" "0x48A7199f8ebFBFd108cE497cCe582c410D40d5D9"
```

### World ID setup — DONE ✅ (cloud-only pattern)

`requireVerification = false` on both contracts (2026-04-08). No on-chain ZK proof required.
Cloud verification via `WORLD_RP_ID` + `WORLD_RP_SIGNING_KEY` — set in `.env.local`.

If ever needed to re-run (e.g. after redeployment):
```bash
npx hardhat run scripts/setupWorld.ts --network world-chain
# setupWorld.ts now calls setRequireVerification(false) — NOT true
```

---

## Known Blockers

| Blocker | Resolution |
|---|---|
| Need testnet ETH | https://www.l2faucet.com/world |
| Dev Portal contract allowlisting | Must register all contracts after each deploy — done ✅ 2026-04-07 |
| `userOpHash` ≠ tx hash | Use `useWaitForTransactionReceipt` — do NOT pass to `waitForTransactionReceipt` |
| Commit-reveal 256-block window | Call `revealDraw()` within ~8.5 min of `commitDraw()`; monitor via `blocksUntilExpiry()` |
| Secret management | Store secret off-chain between `commitDraw()` + `revealDraw()` — losing it requires `resetDraw()` + recommit |
| World ID v4 deadline | Migrate contracts before April 1, 2027 — v4 mainnet not deployed yet |

---

## Notes

- **Goldsky subgraph live** — `booztory-world/1.0.6` deployed, indexing from block 28,339,787 (new BooztoryWorld deploy); endpoint in `WORLD_SUBGRAPH_URL`. Previous: 1.0.3–1.0.5 (old address). Key fix: schema change required to force fresh reindex — comments/yaml-only changes insufficient.
- **Oracle interface fix** — BooztoryWorld redeployed 2026-04-13 after oracle calls reverted. Root cause: contract used `IApi3Proxy.read()` but oracle proxy exposes `AggregatorV3Interface.latestRoundData()`. Fixed interface + bumped `ORACLE_STALENESS` to 48h (oracle updates every ~30h). WLD price: `answer` is 18-decimal int256 (e.g. `290456757703677100` ≈ $0.29/WLD).
- **WLD payment paths** — all wired: `mintSlotWithWLD`, `mintSlotWithWLDDiscount` in `usePaymentWorld`; `processDonationWithWLD` in `useDonationWorld`. All use 3-tx batch: `WLD.approve(Permit2)` → `Permit2.approve(BooztoryWorld)` → contract call. World App does NOT auto-approve WLD to Permit2 (only USDC), hence the explicit approve step.
- **Donation modal WLD** — preset amounts 1/5/10 are direct WLD (not USD-converted). `processDonationWithWLD` takes `wldAmount: bigint` (18 dec) directly.
- **No VRF subscription** — commit-reveal needs no setup, just ETH for gas
- **BOOZ is unified** — same address on World Chain and Base via CREATE2 + SuperchainERC20; bridgeable in Phase 2 when soulbound disabled
- **Base Mainnet stays live** — existing contracts, subgraph, and frontend untouched
- **World ID verification** — `requireVerification = false` on both mainnet contracts. Primary gate: `getIsUserVerified(address)` from `@worldcoin/minikit-js/address-book` (on-chain Address Book `0x57b930D551e677CC36e2fA036Ae2fe8FdaE0330D`). IDKit ZK flow wired as fallback for browser but does NOT work inside World App WebView (renders `null`). JWT always re-checks Redis on refresh.
- **IDKit config:** `environment="production"` on `IDKitRequestWidget` is required — without it proofs are generated for staging and fail. Keep for browser/desktop path only.
- **Emergency script:** `scripts/setVerifiedHumans.ts` — manually grants `verifiedHumans[address]=true` on both contracts for wallets stuck due to relayer/tx failure.
- **`waitForWorldOp`** — logs `debug_url` on failed status; throws immediately on `failed/reverted/error` instead of waiting for timeout.
- **Env vars for World ID:** `WORLD_RP_ID` (cloud verify) + `WORLD_RP_SIGNING_KEY` (IDKit RP signature) — both server-side only.
