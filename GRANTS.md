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

Booztory is the first fully on-chain content spotlight built on Base. Anyone can pay 1 USDC to feature their content — YouTube, TikTok, X, Spotify, Vimeo — in a live 15-minute slot, minted as an ERC-721 token. There are no algorithms, no gatekeepers, and no backend database. The entire content queue is managed trustlessly on-chain: slot scheduling, donation splits, and metadata are all stored in the contract. Creators receive USDC donations directly through the contract (95% to creator, 5% fee). It's permissionless promotion for the open internet.

**7. Which category best describes your company?**

Consumer / Creator Economy (Web3-native content promotion)

**8. What is your ideal customer profile?**

- **Content creators** — YouTubers, TikTokers, Spotify artists, indie filmmakers, and X (Twitter) personalities who want decentralized, algorithm-free exposure.
- **Web3 projects and brands** — Teams launching tokens, NFT collections, or protocols who want transparent, on-chain promotion without relying on centralized ad platforms.
- **Web3-native audiences** — Users already comfortable with wallets (RainbowKit, MetaMask, Rabby) who want to discover and support creators on-chain.

---

## 3. Onchain & Base Integration

**9. What part of your product is onchain?**

Everything core to the product is on-chain:

- **Content slots** — Each slot is minted as an ERC-721 NFT (`Booztory.sol`) when a creator pays 1 USDC. The slot's content URL, content type, aspect ratio, title, author, thumbnail, scheduled time, and end time are all stored in the token's on-chain struct.
- **Slot queue** — The contract manages the content schedule via `queueEndTime`, ensuring slots are stacked sequentially without any off-chain coordination.
- **Payments** — Slot fees (1 USDC) are transferred directly from user wallet to the contract via `approve` + `mintSlot`.
- **Donations** — Fans send USDC to the contract via `approve` + `donate(tokenId, amount)`. The contract splits it 95% to the creator, 5% to the protocol — all in a single transaction.
- **History & Discovery** — `getCurrentSlot()`, `getUpcomingSlots()`, and `getPastSlots()` are all pure on-chain reads. No database, no API backend for content data.
- **Token metadata** — `tokenURI()` returns on-chain base64-encoded JSON metadata.

**10. What part of your product uses Base?**

Booztory is exclusively deployed on Base. There is no multi-chain deployment — Base was chosen as the primary and only network.

- **Base-exclusive:** The `Booztory.sol` ERC-721 contract, USDC payments (using Base native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), all on-chain reads and writes.
- **Mainnet USDC ENS resolution:** We also connect to Ethereum mainnet read-only for ENS name resolution (displaying `.eth` names), but all transactions happen on Base.
- **Basenames:** We resolve `.base.eth` names via Base's Universal Resolver to display creator identities on the platform.

**11. Do you already have a token?**

No. Booztory does not have a protocol token. Each minted content slot is an ERC-721 NFT, but there is no fungible governance or utility token.

**12. Contract address** *(if applicable)*

Contract is compiled and ready. Pending deployment to Base mainnet.
Base Sepolia testnet deployment: `[TODO: Add address after deploy]`

---

## 4. Founder Information

**13. Founder(s) Names and Contact Information**

`[TODO: Your name, email, Telegram/X handle]`

**14. Founder Background(s) and LinkedIn**

I hold a Bachelor's degree in Informatics Engineering with a focus on Software Engineering (graduated 2016). Since then, I've been a self-taught Web3 builder.

My journey into Web3 started in 2021 as an NFT collector. That curiosity quickly turned into building — I launched my own NFT project, then started learning independently: writing ERC-721 contracts in Solidity, experimenting with React to generate NFT trait layers, and eventually shipping on-chain games deployed via Remix. I've built Mini Apps for Base and Farcaster, run validator nodes for projects like Boundless, Genysn, and Nexus, and actively participate in governance communities including Optimism. I have over 1,000 consecutive days of on-chain activity.

Booztory is the most complete project I've built to date — a full-stack Web3 product with a custom ERC-721 smart contract, a Next.js frontend, wagmi/RainbowKit wallet integration, and a SIWE authentication flow. Built entirely solo.

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
> Each slot is minted as an ERC-721 token. YouTube, TikTok, Spotify, X — whatever you're creating, you can feature it here. Fans can send USDC donations directly to creators through the contract. No middlemen.
>
> Everything lives on-chain — the queue, the payments, the metadata. No database. No backend. Just a smart contract and a clean UI.
>
> I'm applying to Base Batches because Base is where this belongs — low fees make 1 USDC slots practical, and the Base ecosystem is exactly the audience Booztory is built for.
>
> [smiling] Thanks for watching."

---

*Video URL: `[TODO: Record and add unlisted YouTube/Loom link]`*

**16. Who writes code or handles technical development?**

I ([TODO: your name]) handle all technical development. Booztory is a solo build — no co-founders, no contractors, no outsourced code.

Stack: Next.js 16, React 19, TypeScript, wagmi v2, RainbowKit, viem, and Hardhat. The smart contract (`Booztory.sol`) is written in Solidity 0.8.28 with OpenZeppelin ERC-721 and Ownable. All frontend and contract work was done by me independently.

**17. How long have the founders known each other and how did you meet?**

Booztory is a solo-founder project. There are no co-founders.

---

## 5. Product Stage

**18. How far along are you?**

**MVP** — The full product is built and functional on Base Sepolia testnet:
- Smart contract compiled and tested
- Wallet connection (RainbowKit + SIWE)
- Content submission flow (approve USDC → mintSlot → ERC-721 minted)
- Donation flow (approve USDC → donate → 95/5 split on-chain)
- Live content display, history, and upcoming queue — all from on-chain reads
- YouTube, TikTok, X, Vimeo, Spotify embeds working
- ENS + Basename display for creators and donors
- FAQ page, mobile-responsive UI

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

**24. Dune dashboards / public contract addresses**

Smart contract: `[TODO: Add Base Sepolia address after deploy]`
Dune dashboard: `[TODO: Set up after mainnet launch]`

---

## 7. Product Advantage

**25. What part of your product is magic or impressive?**

The entire content queue is managed by a single smart contract — no backend, no database, no cron jobs. When a creator submits content, the contract automatically calculates the next available slot time, mints an ERC-721, and schedules it. The frontend reads directly from the contract using wagmi `useReadContract`. Every slot ever created is permanently on-chain and verifiable.

The donation split (95% to creator, 5% protocol fee) happens atomically in a single contract call — no trust required between the platform and the creator.

**26. What is your unique insight or advantage in this market?**

Content creators have no native Web3 promotion layer. Every existing promotion channel — YouTube ads, Twitter boosts, influencer deals — is opaque, centralized, and pay-to-win with no on-chain proof. Booztory flips this:

- **Transparent by design** — anyone can verify which slot ran, when, and who paid for it
- **Permissionless** — no account, no KYC, no approval needed beyond a wallet and USDC
- **Creator-aligned** — donations go directly to creators with no platform cut beyond the 5% fee
- **Base-native** — low gas fees on Base make 1 USDC micro-transactions practical; this wouldn't work on mainnet Ethereum

No competitor is doing fully on-chain content scheduling on Base. This is a new primitive.

---

## 8. Fundraising & Token Plans

**27. Do you plan on raising capital from VCs?**

No.

**28. Do you plan to launch a token?**

Maybe. A potential future token could be used for governance (slot pricing, fee parameters) or creator rewards. No immediate plans — protocol revenue from slot fees and donation splits is the primary business model.

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

Booztory is intentionally minimal: one smart contract, one content type (time-limited spotlight), one payment token (USDC). This simplicity is a feature — it makes the protocol auditable, predictable, and easy for non-technical creators to understand. The roadmap adds more surfaces (Base Mini App, Farcaster Mini App, creator analytics) without changing the core primitive.

**31. Who referred you to this program?**

`[TODO: Name of referrer and their social link, if applicable]`
