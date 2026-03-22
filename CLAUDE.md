# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## AI Instructions

- Always read `CLAUDE.md` before modifying the project.
- Follow the architecture and tech stack defined here.
- Understand the full file before editing any code.
- Prefer minimal and safe changes.
- Explain important decisions.
- Update this file if major structural changes are introduced.

---

## Commands

```bash
# Development
pnpm dev          # Next.js dev server
pnpm build        # Production build
pnpm lint         # ESLint

# Smart contract
npx hardhat compile
npx hardhat run scripts/deploy.ts --network base-sepolia
npx hardhat run scripts/deploy.ts --network base
npx hardhat verify --network base-sepolia <address> <paymentTokenAddress>
```

No test runner is configured. Use `pnpm build` to catch TypeScript errors.

---

## Project Overview

**Booztory** is a fully on-chain digital spotlight platform on **Base**. Creators rent 15-minute featured content slots by minting an ERC-721 token for **1 USDC**. All slot data is stored on-chain. Donations are pulled by the contract (95% forwarded to creator, 5% fee kept). Minters earn **BOOZ** reward tokens and gain raffle entries. Daily GM streaks earn additional BOOZ. No database — all reads go through wagmi `useReadContract`.

**Stack:** Next.js 16.1.6 · React 19 · TypeScript · Tailwind CSS · wagmi v2 + RainbowKit · viem · NextAuth 4 (SIWE) · Farcaster Mini App SDK (`@farcaster/miniapp-sdk`) · Hardhat 2.28.6 · Base chain (8453)

**Key addresses:**
- USDC on Base mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Booztory contract: `NEXT_PUBLIC_BOOZTORY_ADDRESS` (set after deployment)
- BooztoryToken (BOOZ): `NEXT_PUBLIC_TOKEN_ADDRESS`
- BooztoryRaffle: `NEXT_PUBLIC_RAFFLE_ADDRESS`

**Env vars:**
- `NEXT_PUBLIC_BOOZTORY_ADDRESS` — deployed Booztory contract address
- `NEXT_PUBLIC_TOKEN_ADDRESS` — deployed BooztoryToken (BOOZ) address
- `NEXT_PUBLIC_RAFFLE_ADDRESS` — deployed BooztoryRaffle address
- `NEXT_PUBLIC_USDC_ADDRESS` — defaults to Base mainnet USDC; override for Sepolia
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — from cloud.walletconnect.com
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

---

## App Routes

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Featured content display with countdown, donation modal, submission drawer |
| `/faq` | `app/faq/page.tsx` | Accordion FAQ |
| `/history` | `app/history/page.tsx` | Past content with infinite scroll |
| `/upcoming` | `app/upcoming/page.tsx` | Queued content with infinite scroll |
| `/reward` | `app/reward/page.tsx` | BOOZ balance, GM streak, raffle entries, weekly draw status |
| `/tweet/[tweet]` | `app/tweet/[tweet]/page.tsx` | Dynamic tweet rendering with metadata |

---

## API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/nonce` | GET | Generate UUID nonce, store in httpOnly cookie |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler (`app/api/auth/auth.ts`) |
| `/api/complete-siwe` | POST | Verify signed SIWE message |
| `/api/getTweetData` | GET | Fetch enriched tweet data via react-tweet API |
| `/api/resolveTiktok` | GET | Resolve vm.tiktok.com / vt.tiktok.com short URLs |

---

## Components

Components are organized into subfolders. Import using `@/components/<subfolder>/<file>`.

### `components/layout/`
- `navbar.tsx` — Fixed bottom nav (Home, Upcoming, History)
- `topbar.tsx` — Fixed top bar on home page: logo, nav, GM button, X link, wallet connect (desktop), mobile icons
- `pageTopbar.tsx` — Sub-page top bar with back arrow + centered title (mobile), logo + nav (desktop). Connect wallet hidden on mobile.
- `scrollToTop.tsx` — Floating scroll-to-top button
- `usersOnline.tsx` — Live users online indicator
- `theme-provider.tsx` — next-themes wrapper

### `components/content/`
- `contentCard.tsx` — Main featured content card: embed, countdown, donations. Accepts `tokenId: bigint`, `submittedBy: string`, `authorName?: string`. Display name = `authorName` (content creator) → ENS/Basename → truncated address. Donation modal shows wallet identity only.
- `contentEmbed.tsx` — Routes to platform-specific embed, uses ResizeObserver for responsive sizing
- `contentStats.tsx` — Displays time left + USDC donations amount
- `historyCard.tsx` — Card for expired content. Display name = `content.authorName` → ENS/Basename of submitter. No border, gradient header.
- `upcomingCard.tsx` — Card for queued content. Same display name priority as `historyCard`. No border, gradient header.
- `icon.tsx` — Platform icon helper

### `components/modals/`
- `submitContent.tsx` — Full submission drawer: URL validation, TikTok short URL resolution, content preview, approve + mintSlot flow (standard / discount / free token-burn paths), mobile keyboard detection
- `donationModal.tsx` — Donation dialog: preset amounts (1/5/10 USDC). Calls `processDonation(amount, tokenId)`. Resolves recipient and donor addresses via `useWalletName` for ENS/Basename display.
- `gmModal.tsx` — GM daily streak modal (desktop Dialog) and mobile bottom sheet (Vaul `Drawer`). Shows streak day, rewards, milestone progress, confetti on claim. Background gradient lives on the wrapper (`DialogContent` / `Drawer.Content`), not on `GMContent` itself.

### `components/wallet/`
- `connectWallet.tsx` — RainbowKit connect button with auto SIWE sign-in via `useAccountEffect`. Farcaster Mini App detection via `sdk.isInMiniApp()` — uses QuickAuth instead of SIWE. Resolves ENS (mainnet) and Basename (Base L2). Desktop: click-outside dropdown. Mobile: bottom Sheet.
- `walletDropdown.tsx` — Wallet dropdown/sheet content: display name, BOOZ balance, disconnect button.

---

## Providers

- `providers/wagmi-provider.tsx` — `WagmiProvider` + `QueryClient` + `RainbowKitProvider`
- `providers/session-provider.tsx` — NextAuth `SessionProvider` wrapper

Both are composed in `app/layout.tsx`. Also includes `MiniappInit` component for Farcaster SDK `ready()` call.

---

## Lib / Utilities

| File | Purpose |
|---|---|
| `lib/contract.ts` | `BOOZTORY_ADDRESS`, `USDC_ADDRESS`, `TOKEN_ADDRESS`, `RAFFLE_ADDRESS`, `BOOZTORY_ABI`, `ERC20_ABI`, `TOKEN_ABI`, `RAFFLE_ABI`, `ContentItem` type, `OnChainSlot` type, `parseSlot()`, `getPlaceholderContent()` |
| `lib/wagmi.ts` | wagmiConfig — chains: APP_CHAIN (base or baseSepolia) + mainnet (for ENS); exports `APP_CHAIN` |
| `lib/cache.ts` | In-memory + localStorage dual cache with TTL, auto-cleanup every 5 min |
| `lib/auth-utils.ts` | Nonce hashing utility + UUID generation |
| `lib/youtubeMetadata.ts` | YouTube oEmbed API with 8 URL regex patterns, `isYouTubeShort()`, `extractTwitterId()` |
| `lib/tiktokMetadata.ts` | TikTok oEmbed API + short URL handling |
| `lib/spotifyMetadata.ts` | Spotify oEmbed API for tracks/albums/playlists/artists |
| `lib/vimeoMetadata.ts` | Vimeo oEmbed API |
| `lib/utils.ts` | `cn()` Tailwind class merging utility |

---

## Hooks

| Hook | Purpose |
|---|---|
| `hooks/useContractContent.ts` | `useCurrentSlot()`, `useUpcomingSlots()`, `useAllPastSlots()` — wagmi `useReadContract` wrappers. Placeholder is a stable module-level singleton to prevent re-renders. |
| `hooks/usePayment.tsx` | `mintSlot(slotData)`, `mintSlotWithDiscount(slotData)`, `mintSlotWithTokens(slotData)` — handles USDC approve + contract call for all three mint paths |
| `hooks/useDonation.tsx` | `processDonation(amount: number, tokenId: bigint)` — USDC `approve(BOOZTORY_ADDRESS, amount)` → `donate(tokenId, amount)` |
| `hooks/useWalletName.ts` | `useWalletName(address)` — resolves wallet to Basename → ENS → truncated address. Used in cards and donation modal. |
| `hooks/use-toast.ts` | Shadcn toast system |
| `hooks/use-mobile.tsx` | Mobile device detection |

---

## On-Chain Data Model (ERC-721)

Contract: `contracts/Booztory.sol` — Solidity 0.8.28, EVM `cancun`, optimizer 200 runs, `viaIR: true`.

### Slot struct
```
contentUrl, contentType, aspectRatio, title, authorName, imageUrl  (strings)
scheduledTime, endTime  (uint256, Unix seconds)
creator  (address)
donations  (uint256, cumulative total donated before fee split, 6-decimal units)
```

### Key contract functions
| Function | Description |
|---|---|
| `mintSlot(url, type, ratio, title, author, imageUrl)` | Pay slotPrice → mint ERC-721 slot, earn 1,000 BOOZ, add raffle entry |
| `mintSlotWithDiscount(...)` | Burn 1,000 BOOZ, pay 0.9 USDC → mint slot, earn 1,000 BOOZ, add raffle entry |
| `mintSlotWithTokens(...)` | Burn 10,000 BOOZ → free slot, no BOOZ earned, no raffle entry |
| `donate(tokenId, amount)` | Pull full amount, forward 95% to creator, keep 5% fee in contract |
| `claimDailyGM()` | One claim per UTC day, earns BOOZ per streak day |
| `withdraw()` | Owner withdraws all accumulated fees |
| `withdrawToken(address)` | Owner withdraws any arbitrary ERC-20 (emergency recovery) |
| `getCurrentSlot()` | Returns live slot or `(0, empty, false)` |
| `getUpcomingSlots()` | All future slots ascending |
| `getPastSlots(offset, limit)` | Done slots newest-first with pagination |
| `getSlotsByCreator(address)` | All slots for a wallet |
| `getSlotStatus(tokenId)` | `"queue"` / `"live"` / `"done"` |
| `setSlotPrice(uint256)` | Owner only |
| `setSlotDuration(uint256)` | Owner only (900 = 15 min, 3600 = 1 hr) |
| `setPaymentToken(address, uint256)` | Owner only — changes token + price atomically |
| `setDonationFeeBps(uint256)` | Owner only — max 1000 (10%) |
| `setRewardToken(address)` | Owner only — set BOOZ token contract |
| `setRaffle(address)` | Owner only — set raffle contract |

### Events
- `SlotMinted(tokenId, creator, scheduledTime, endTime)`
- `DonationReceived(tokenId, donor, creatorAmount, feeAmount)`
- `GMClaimed(user, day, amount)`
- `SlotPriceChanged`, `SlotDurationChanged`, `PaymentTokenChanged`, `DonationFeeBpsChanged`, `Withdrawn`

### Payment flow (content submission)
1. `USDC.approve(BOOZTORY_ADDRESS, slotPrice)` (or `TOKEN.approve` for burn paths)
2. `Booztory.mintSlot(...)` / `mintSlotWithDiscount(...)` / `mintSlotWithTokens(...)`
3. Both txs wait for `waitForTransactionReceipt`

### Donation flow
1. `USDC.approve(BOOZTORY_ADDRESS, amount)`
2. `Booztory.donate(tokenId, amount)` — contract pulls funds, forwards 95% to creator, keeps 5%

---

## Authentication Flow (wagmi + SIWE/QuickAuth + NextAuth)

### Browser (SIWE)
1. Wallet connects → `useAccountEffect.onConnect` fires
2. **GET /api/nonce** → UUID nonce stored in httpOnly cookie
3. Frontend builds `SiweMessage` (domain, address, chainId: APP_CHAIN.id, nonce)
4. `signMessageAsync()` → user signs
5. **POST /api/auth/callback/credentials** → NextAuth `authorize()` verifies SIWE
6. NextAuth creates JWT `{ userId: address, walletAddress, username }`
7. No database — wallet address IS the user identity

### Farcaster Mini App (QuickAuth)
1. `sdk.isInMiniApp()` → true → connect injected Farcaster provider automatically
2. `sdk.quickAuth.getToken()` → Farcaster-issued JWT
3. **POST /api/auth/callback/farcaster-quickauth** → NextAuth verifies token
4. Session created with same shape as SIWE

---

## Caching Strategy

- **In-memory + localStorage** dual cache with TTL (`lib/cache.ts`)
- Metadata (thumbnails, oEmbed): 1 hr TTL
- On-chain slot data: refetched every 30s via wagmi `refetchInterval`

---

## Known Issues & TODOs

- [ ] TikTok short URL resolution may fail on CDN-cached HEAD responses
- [ ] No rate limiting on API endpoints (spam prevention relies solely on slot cost)
- [ ] **More platforms**: Instagram, custom uploads — mentioned in FAQ, not implemented
- [ ] **Optimism Superchain expansion** — planned but not started
- [ ] **Creator dashboard** — no analytics or revenue history
- [ ] Set content type images on-chain via `setContentTypeImage()` (owner, post-deploy)

---

## Project Status

| Area | Status |
|---|---|
| ERC-721 slot contract (Booztory.sol) — 3 mint paths | Written, compiled |
| BooztoryToken (BOOZ) ERC-20 reward token | Written, compiled |
| BooztoryRaffle — Chainlink VRF v2.5 | Written, compiled |
| wagmi + RainbowKit wallet auth (Base) | Working |
| SIWE sign-in (auto on wallet connect) | Working |
| Farcaster Mini App + QuickAuth | Working |
| ENS + Basename display on wallet button | Working |
| Content submission — standard, discount, free paths | Implemented |
| Donation flow (approve + donate) | Implemented |
| Daily GM streak UI + claim | Implemented |
| BOOZ balance in wallet dropdown | Implemented |
| Reward page (/reward) | Implemented |
| YouTube / TikTok / Twitter / Vimeo / Spotify / Twitch embeds | Working |
| History & Upcoming pages | Working — skeleton shows only on first load (no cached data) |
| FAQ page | Working — mount-based skeleton on first render |
| GM modal mobile drawer | Working — Vaul Drawer (replaces shadcn Sheet), handles safe areas natively |
| BooztoryRaffle redeployment (Base Sepolia) | Done ✅ |
| Add BooztoryRaffle as VRF consumer (Base Sepolia) | Done ✅ |
| Base Mainnet deployment | Pending |
| Rate limiting | Not implemented |
| Creator dashboard | Not implemented |
