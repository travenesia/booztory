# Base Batches Application — Booztory

> Answers prepared for: https://base-batches-startup-track-3.devfolio.co/overview
> Items marked `[TODO: ...]` require personal input from the founder.

---

## 1. Company Information

**1. Company Name**
Booztory

**2. Website / Product URL**
https://booztory.com

**3. Demo URL**
https://booztory.com

**4. Location**
Currently based in Indonesia. Company will remain based in Indonesia after the program.

---

## 2. Product Overview

**5. Describe what your company does** *(~50 characters or less)*

> Pay 1 USDC to spotlight your content on Base.

*(43 characters)*

**6. What is your product's unique value proposition?**

Booztory is the first fully on-chain content spotlight built on Base. Anyone can pay 1 USDC to feature their content — YouTube, TikTok, X, Spotify, Vimeo, Twitch — in a live 15-minute slot, minted as an ERC-721 token. There are no algorithms, no gatekeepers, and no backend database. The entire content queue is managed trustlessly on-chain: slot scheduling, donation splits, and metadata are all stored in the contract. Creators receive USDC donations directly through the contract (95% to creator, 5% fee). Minters earn **BOOZ** reward tokens and are entered into a weekly Chainlink VRF raffle with USDC prizes. It's permissionless promotion for the open internet.

**7. Which category best describes your company?**

Consumer / Creator Economy (Web3-native content promotion)

**8. What is your ideal customer profile?**

- **Content creators** — YouTubers, TikTokers, Spotify artists, indie filmmakers, Twitch streamers, and X (Twitter) personalities who want decentralized, algorithm-free exposure.
- **Web3 projects and brands** — Teams launching tokens, NFT collections, or protocols who want transparent, on-chain promotion without relying on centralized ad platforms.
- **Web3-native audiences** — Users already comfortable with wallets (RainbowKit, MetaMask, Rabby, Farcaster) who want to discover and support creators on-chain.

---

## 3. Onchain & Base Integration

**9. What part of your product is onchain?**

Everything core to the product is on-chain:

- **Content slots** — Each slot is minted as an ERC-721 NFT (`Booztory.sol`) when a creator pays 1 USDC. The slot's content URL, content type, aspect ratio, title, author, thumbnail, scheduled time, and end time are all stored in the token's on-chain struct.
- **Slot queue** — The contract manages the content schedule via `queueEndTime`, ensuring slots are stacked sequentially without any off-chain coordination.
- **Payments** — Slot fees (1 USDC) are transferred directly from user wallet to the contract via `approve` + `mintSlot`.
- **Donations** — Fans send USDC to the contract via `approve` + `donate(tokenId, amount)`. The contract splits it 95% to the creator, 5% to the protocol — all in a single transaction.
- **Reward token** — `BooztoryToken.sol` (BOOZ) is an ERC-20 that mints on paid actions and burns for discount/free slots. Soulbound in Phase 1. SuperchainERC20-ready.
- **GM streak** — Daily check-ins (`claimDailyGM()`) tracked fully on-chain using `block.timestamp`. Streak resets, milestones, and journey completion are all contract-enforced.
- **Weekly raffle** — `BooztoryRaffle.sol` uses Chainlink VRF v2.5 for verifiable randomness. Winners are paid USDC directly by the contract.
- **History & Discovery** — `getCurrentSlot()`, `getUpcomingSlots()`, and `getPastSlots()` are all pure on-chain reads. No database, no API backend for content data.
- **Token metadata** — `tokenURI()` returns on-chain base64-encoded JSON metadata.

**10. What part of your product uses Base?**

Booztory is exclusively deployed on Base. There is no multi-chain deployment — Base was chosen as the primary and only network.

- **Base-exclusive:** The `Booztory.sol` ERC-721 contract, `BooztoryToken.sol` BOOZ reward token, `BooztoryRaffle.sol` raffle contract, USDC payments (using Base native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), all on-chain reads and writes.
- **Mainnet USDC ENS resolution:** We also connect to Ethereum mainnet read-only for ENS name resolution (displaying `.eth` names), but all transactions happen on Base.
- **Basenames:** We resolve `.base.eth` names via Base's Universal Resolver to display creator identities on the platform.
- **Farcaster Mini App:** The app works natively inside Farcaster clients via `@farcaster/miniapp-sdk` with QuickAuth replacing SIWE for a seamless wallet connection experience.

**11. Do you already have a token?**

Yes. **BOOZ** (`BooztoryToken.sol`) is an ERC-20 reward token deployed on Base Sepolia. It is earned by minting slots and completing daily GM streaks, and spent to get discounted or free slots. Currently soulbound (Phase 1, no trading). Designed as a SuperchainERC20 for future cross-chain expansion. Contract address: `0x3b3C0EF1f9072A435BE1B5860d674e9E0e47FAfE` (testnet).

**12. Contract addresses** *(if applicable)*

Base Sepolia (testnet):
- Booztory (ERC-721): `0x9D644381cd8bFA5fdba46C94BdB2A131aaeEF892`
- BooztoryToken (BOOZ): `0x3b3C0EF1f9072A435BE1B5860d674e9E0e47FAfE`
- BooztoryRaffle: `0xee7a205dA0D3E16ca9384Feb1852A78aBf34285e`

Base Mainnet: _pending deployment_

---

## 4. Founder Information

**13. Founder(s) Names and Contact Information**

`[TODO: Your name, email, Telegram/X handle]`

**14. Founder Background(s) and LinkedIn**

I hold a Bachelor's degree in Informatics Engineering with a focus on Software Engineering (graduated 2016). Since then, I've been a self-taught Web3 builder.

My journey into Web3 started in 2021 as an NFT collector. That curiosity quickly turned into building — I launched my own NFT project, then started learning independently: writing ERC-721 contracts in Solidity, experimenting with React to generate NFT trait layers, and eventually shipping on-chain games deployed via Remix. I've built Mini Apps for Base and Farcaster, run validator nodes for projects like Boundless, Genysn, and Nexus, and actively participate in governance communities including Optimism. I have over 1,000 consecutive days of on-chain activity.

Booztory is the most complete project I've built to date — a full-stack Web3 product with three custom smart contracts (ERC-721 slot, ERC-20 reward token with SuperchainERC20 support, and a Chainlink VRF raffle), a Next.js frontend, wagmi/RainbowKit wallet integration, SIWE and Farcaster QuickAuth flows, and a Farcaster Mini App integration. Built entirely solo.

LinkedIn: `[TODO: Add LinkedIn URL]`

**15. ~1-Minute Founder Video Script**

Below is a ready-to-record script for a ~60-second unlisted video:

---

> **[ON CAMERA — casual, direct tone]**
>
> "Hey, I'm [Name] — a self-taught Web3 builder from Indonesia and the solo founder of Booztory.
>
> I started in Web3 in 2021 as an NFT collector, then learned Solidity, built on-chain games, ran validator nodes, and shipped Mini Apps for Base and Farcaster. Booztory is the most ambitious thing I've built so far.
>
> So — what is Booztory? It's a decentralized content spotlight on Base. Pay 1 USDC, and your content goes live for 15 minutes. No algorithm. No gatekeepers. Just your content, on-chain.
>
> Each slot is minted as an ERC-721 token. YouTube, TikTok, Spotify, X, Twitch — whatever you're creating, you can feature it here. Fans can send USDC donations directly to creators through the contract. No middlemen.
>
> You also earn BOOZ reward tokens every time you mint or complete your daily GM streak. Burn them for discounted or free slots. And every week, Chainlink VRF draws 10 raffle winners from all paid minters and pays them in USDC automatically.
>
> Everything lives on-chain — the queue, the payments, the metadata. No database. No backend. Three smart contracts and a clean UI.
>
> I'm applying to Base Batches because Base is where this belongs — low fees make 1 USDC slots practical, and the Base ecosystem is exactly the audience Booztory is built for.
>
> [smiling] Thanks for watching."

---

*Video URL: `[TODO: Record and add unlisted YouTube/Loom link]`*

**16. Who writes code or handles technical development?**

I ([TODO: your name]) handle all technical development. Booztory is a solo build — no co-founders, no contractors, no outsourced code.

Stack: Next.js 16, React 19, TypeScript, wagmi v2, RainbowKit, viem, Hardhat, and `@farcaster/miniapp-sdk`. Three smart contracts written in Solidity 0.8.28 with OpenZeppelin. All frontend and contract work was done by me independently.

**17. How long have the founders known each other and how did you meet?**

Booztory is a solo-founder project. There are no co-founders.

---

## 5. Product Stage

**18. How far along are you?**

**MVP** — The full product is built and functional on Base Sepolia testnet:
- Three smart contracts: ERC-721 slot, BOOZ ERC-20 reward token, Chainlink VRF raffle
- Wallet connection (RainbowKit + SIWE + Farcaster QuickAuth)
- Content submission — standard (1 USDC), discount (0.9 USDC + burn 1K BOOZ), and free (burn 10K BOOZ) paths
- Donation flow (approve USDC → donate → 95/5 split on-chain)
- Live content display, history, and upcoming queue — all from on-chain reads
- BOOZ balance display in wallet dropdown
- Daily GM streak UI with confetti, milestone badges, and 90-day journey tracking
- Reward page (`/reward`) — raffle entries, weekly draw status, BOOZ stats
- Weekly raffle with Chainlink VRF — configurable prizes, automatic on-chain payouts
- YouTube, TikTok, X, Vimeo, Spotify, Twitch embeds working
- ENS + Basename display for creators and donors
- Farcaster Mini App support (works inside Warpcast)
- FAQ page, mobile-responsive UI with bottom navigation
- Mobile-native drawer (Vaul) for GM streak, no safe-area gaps on any device
- Skeleton loading states across all data-driven pages (Home, History, Upcoming, Reward, FAQ)

**19. How long have you been working on this?**

`[TODO: e.g., "3 months" or specific start date]`

**20. Full-time vs part-time?**

`[TODO: e.g., "Part-time while working a day job" or "Full-time for the past X weeks"]`

---

## 6. Traction & Metrics

**21. Do you have users or customers?**

`[TODO: Yes/No — product is currently on testnet]`

**22. Active users / paying customers**

Currently in testnet phase — no paid users yet. Preparing for mainnet launch upon completing Base Batches.

**23. Revenue**

Pre-revenue. Protocol is designed to generate revenue through:
- 1 USDC per slot minted (slot fee goes to treasury)
- 5% fee on all USDC donations processed through the contract
- Weekly raffle is self-sustaining at break-even (100 entries/week covers the $100 prize pool)

**24. Dune dashboards / public contract addresses**

Smart contracts (Base Sepolia testnet):
- Booztory: `0x9D644381cd8bFA5fdba46C94BdB2A131aaeEF892`
- BooztoryToken (BOOZ): `0x3b3C0EF1f9072A435BE1B5860d674e9E0e47FAfE`
- BooztoryRaffle: `0xee7a205dA0D3E16ca9384Feb1852A78aBf34285e`

Dune dashboard: `[TODO: Set up after mainnet launch]`

---

## 7. Product Advantage

**25. What part of your product is magic or impressive?**

The entire content queue is managed by a single smart contract — no backend, no database, no cron jobs. When a creator submits content, the contract automatically calculates the next available slot time, mints an ERC-721, and schedules it. The frontend reads directly from the contract using wagmi `useReadContract`. Every slot ever created is permanently on-chain and verifiable.

The donation split (95% to creator, 5% protocol fee) happens atomically in a single contract call — no trust required between the platform and the creator.

The daily GM streak is tracked entirely on-chain using `block.timestamp / 1 days`. No off-chain scheduler, no server, no database — just a smart contract counting days.

The weekly raffle uses Chainlink VRF v2.5 for provably fair randomness and pays winners automatically on-chain. The entire engagement loop — mint, earn, streak, win — is trustless.

**26. What is your unique insight or advantage in this market?**

Content creators have no native Web3 promotion layer. Every existing promotion channel — YouTube ads, Twitter boosts, influencer deals — is opaque, centralized, and pay-to-win with no on-chain proof. Booztory flips this:

- **Transparent by design** — anyone can verify which slot ran, when, and who paid for it
- **Permissionless** — no account, no KYC, no approval needed beyond a wallet and USDC
- **Creator-aligned** — donations go directly to creators with no platform cut beyond the 5% fee
- **Base-native** — low gas fees on Base make 1 USDC micro-transactions practical; this wouldn't work on mainnet Ethereum
- **Farcaster-native** — the app works as a Farcaster Mini App, reaching the most active on-chain social audience on Base

No competitor is doing fully on-chain content scheduling with reward tokens and provably fair raffles on Base. This is a new primitive.

---

## 8. Fundraising & Token Plans

**27. Do you plan on raising capital from VCs?**

No.

**28. Do you plan to launch a token?**

Yes — **BOOZ** is already deployed on Base Sepolia. It is an ERC-20 reward token earned through platform participation (slot minting and daily GM streaks) and spent on discounted or free slots. Currently soulbound (non-transferable) in Phase 1 to prevent speculation and sybil farming. Phase 2 enables transfers and seeds a Uniswap v3 BOOZ/USDC liquidity pool using a one-time treasury mint. BOOZ is built as a SuperchainERC20 (IERC7802) for native cross-chain expansion without token migration.

---

## 9. Motivation

**29. Why do you want to join Base Batches?**

Base is where Booztory lives — not by coincidence, but by design. Base's low transaction fees make 1 USDC micro-transactions viable, which is the entire business model. The growing Base ecosystem means a ready audience of wallet users who already understand USDC payments.

Joining Base Batches would help Booztory:
1. **Reach the right users** — Base's creator and consumer-facing ecosystem is exactly our target market
2. **Accelerate go-to-market** — mentorship and network access to help with distribution, not just technology
3. **Build credibility** — being part of a Base-backed program signals legitimacy to early creators and donors who need to trust the platform with their USDC

We're not looking for capital — we're looking for ecosystem integration, distribution, and the right community to launch into.

---

## 10. Additional Information

**30. Anything else you'd like us to know?**

Booztory is intentionally minimal: three smart contracts, one content type (time-limited spotlight), one payment token (USDC), one reward token (BOOZ). This simplicity is a feature — it makes the protocol auditable, predictable, and easy for non-technical creators to understand. The roadmap adds more surfaces (World Mini App, Superchain expansion, creator analytics) without changing the core primitive.

The Farcaster Mini App integration is already live — users inside Warpcast can connect, mint, claim streaks, and check their raffle entries without ever leaving the app. This brings Booztory natively to the most active on-chain social community on Base.

**31. Who referred you to this program?**

`[TODO: Name of referrer and their social link, if applicable]`
