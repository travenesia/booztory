# Booztory

**Booztory** is a decentralized content spotlight built on [Base](https://base.org). Pay 1 USDC to feature your content — YouTube, TikTok, X, Spotify, or Vimeo — in a live 15-minute slot. Each slot is minted as an ERC-721 token. Fans can support creators directly through on-chain USDC donations. No algorithms. No gatekeepers. No database.

> Currently live on **Base Sepolia Testnet** · Mainnet launch coming soon.

---

## How It Works

1. Connect your Web3 wallet
2. Submit a content URL and approve 1 USDC
3. Your slot is minted as an ERC-721 token and added to the on-chain queue
4. Content goes live for 15 minutes when it reaches the front of the queue
5. Viewers can send USDC donations directly to the creator through the contract (95% to creator, 5% protocol fee)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS |
| Wallet | wagmi v2 · RainbowKit · viem |
| Auth | NextAuth 4 · SIWE (Sign-In with Ethereum) |
| Smart Contract | Solidity 0.8.28 · OpenZeppelin ERC-721 · Hardhat |
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
| Twitch | 🔜 Coming soon |
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
│   ├── faq/page.tsx        # FAQ accordion
│   └── api/                # API routes (nonce, SIWE, tweet data, TikTok resolver)
├── components/
│   ├── content/            # ContentCard, ContentEmbed, HistoryCard, UpcomingCard
│   ├── layout/             # Navbar, Topbar, ScrollToTop
│   ├── modals/             # SubmitContent drawer, DonationModal
│   └── wallet/             # ConnectWallet button
├── contracts/
│   └── Booztory.sol        # ERC-721 slot contract
├── hooks/                  # useContractContent, usePayment, useDonation, useWalletName
├── lib/                    # Contract ABI, wagmi config, cache, metadata fetchers
├── providers/              # WagmiProvider, SessionProvider
└── scripts/
    └── deploy.ts           # Hardhat deploy script
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
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Contract addresses (set after deployment)
NEXT_PUBLIC_BOOZTORY_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=

# NextAuth
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### 3. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Smart Contract

### Compile

```bash
npx hardhat compile
```

### Deploy

**Base Sepolia (testnet):**
```bash
npx hardhat run scripts/deploy.ts --network base-sepolia
```

**Base Mainnet:**
```bash
npx hardhat run scripts/deploy.ts --network base
```

After deployment, copy the output addresses into your `.env.local`:
```env
NEXT_PUBLIC_BOOZTORY_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
```

### Verify

```bash
npx hardhat verify --network base-sepolia <DEPLOYED_ADDRESS> <USDC_ADDRESS>
```

### Key Contract Functions

| Function | Description |
|---|---|
| `mintSlot(url, type, ratio, title, author, imageUrl)` | Pay 1 USDC → mint ERC-721 slot |
| `donate(tokenId, amount)` | Send USDC to creator (95%) + protocol fee (5%) |
| `getCurrentSlot()` | Returns the currently live slot |
| `getUpcomingSlots()` | Returns all queued slots in order |
| `getPastSlots(offset, limit)` | Returns past slots, newest first |
| `withdraw()` | Owner withdraws accumulated fees |
| `setSlotPrice(uint256)` | Owner — update slot price |
| `setSlotDuration(uint256)` | Owner — update slot duration (default: 900s) |

---

## Known Addresses

| Token | Network | Address |
|---|---|---|
| USDC | Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC | Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

---

## Authentication Flow

1. Wallet connects → nonce fetched from `/api/nonce`
2. Frontend builds a [SIWE](https://login.xyz/) message and prompts user to sign
3. Signature verified via NextAuth credentials provider
4. JWT session created: `{ userId: address, walletAddress, username }`
5. No database — wallet address is the user identity

---

## Development Commands

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build (also type-checks)
pnpm lint         # Run ESLint
```

> No test runner is configured. Use `pnpm build` to catch TypeScript errors.

---

## Roadmap

- [x] ERC-721 slot contract
- [x] wagmi + RainbowKit wallet connection
- [x] SIWE authentication
- [x] Content submission (approve + mintSlot)
- [x] Donation flow (approve + donate)
- [x] ENS + Basename display
- [x] YouTube, TikTok, X, Spotify, Vimeo embeds
- [x] History & Upcoming pages
- [ ] Base Mainnet deployment
- [ ] Base Mini App
- [ ] Farcaster Mini App
- [ ] Creator analytics dashboard
- [ ] Reward pool for top creators

---

## License

MIT
