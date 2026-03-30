// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/// @notice Minimal interface for BooztoryToken reward calls.
interface IBooztoryToken {
    function mintReward(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
}

/// @notice Minimal interface for BooztoryRaffle calls.
interface IRaffle {
    function addEntry(address minter) external;
    function creditTickets(address user, uint256 amount) external;
}

/**
 * @title Booztory
 * @notice ERC-721 content spotlight platform on Base.
 *         Each token represents a featured content slot.
 *
 *         Mint fees:   go to this contract; owner withdraws via withdraw().
 *         Donations:   95% to creator, 5% fee stays in contract; owner withdraws.
 *         Payment:     paymentToken == address(0) → native ETH; otherwise any ERC-20.
 *         Rewards:     paid mints earn BOOZ tokens; burn BOOZ for free slots.
 *         Admin-only:  slot price, slot duration, payment token, donation fee bps, withdraw.
 */
contract Booztory is ERC721, Ownable, Pausable, ReentrancyGuard {
    using Strings for uint256;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Payment token. address(0) means native ETH.
    address public paymentToken;

    /// @notice Price to mint a slot, in the payment token's smallest unit.
    uint256 public slotPrice = 1_000_000; // default: 1 USDC (6 decimals)

    /// @notice Duration of each featured slot in seconds.
    uint256 public slotDuration = 15 minutes;

    /// @notice Fee on donations, in basis points (500 = 5%).
    uint256 public donationFeeBps = 500;

    /// @notice BooztoryToken (BOOZ) contract for rewards. address(0) = disabled.
    address public rewardToken;

    /// @notice BOOZ tokens minted per paid slot mint (18 decimals). Default: 1,000.
    uint256 public slotMintReward = 1_000 ether;

    /// @notice BOOZ tokens required to burn for a free slot. Default: 10,000.
    uint256 public freeSlotCost = 10_000 ether;

    /// @notice BOOZ cost to get a discount on a slot mint. Default: 1,000.
    uint256 public discountBurnCost = 1_000 ether;

    /// @notice Discount amount in payment token units. Default: 100,000 (0.1 USDC).
    uint256 public discountAmount = 100_000;

    /// @notice BooztoryRaffle contract. address(0) = raffle disabled.
    address public raffle;

    /// @notice Maximum slots allowed in the queue at any time. Default: 96 (24h at 15 min slots).
    uint256 public maxQueueSize = 96;

    // ---- Points & Tickets ----

    /// @notice Points earned per paid slot mint (standard + discount paths). Default: 15.
    uint256 public mintPointReward = 15;

    /// @notice Points earned per donate action (once per 24h, donor != creator). Default: 5.
    uint256 public donatePointReward = 5;

    /// @notice BOOZ reward for first 1 USDC donated per 24h (donor != creator). Default: 1,000.
    uint256 public donateBoozReward = 1_000 ether;

    /// @notice Points required to convert to 1 raffle ticket. Default: 5.
    uint256 public pointsPerTicket = 5;

    /// @notice Accumulated points per wallet.
    mapping(address => uint256) public points;

    /// @notice Highest consecutive GM streak ever reached per wallet (never resets).
    mapping(address => uint16) public highestStreak;

    /// @notice Timestamp of last donate point award per wallet (for 24h cooldown).
    mapping(address => uint256) public donateCooldown;

    /// @notice Custom NFT image per content type. If set, overrides the creator's submitted imageUrl.
    ///         e.g. contentTypeImage["youtube"] = "https://booztory.com/nft/youtube.png"
    mapping(string => string) public contentTypeImage;

    // ---- NFT Pass ----

    /// @notice Approved NFT collections whose holders get platform perks.
    ///         Any approved ERC-721 collection qualifies — contract does not need to exist at deploy time.
    mapping(address => bool) public approvedNFTContracts;

    /// @notice Ordered list of all currently-approved NFT contract addresses (for enumeration).
    address[] public approvedNFTList;

    /// @notice Last timestamp a given NFT token ID used the 50% discount mint (per collection).
    ///         Cooldown: 24 hours. Inherited by new owner on transfer.
    mapping(address => mapping(uint256 => uint256)) public nftLastDiscountMint;

    /// @notice Last timestamp a given NFT token ID used the free mint (per collection).
    ///         Cooldown: 30 days. Inherited by new owner on transfer.
    mapping(address => mapping(uint256 => uint256)) public nftLastFreeMint;

    // ---- GM Streak ----

    struct GMStreak {
        uint256 lastClaimDay;       // UTC day number of last claim
        uint16  streakCount;        // consecutive days claimed (1+)
        uint8   claimedMilestones;  // bitmask: bit0=day7, bit1=day14, bit2=day30, bit3=day60, bit4=day90
    }

    /// @notice GM streak state per wallet.
    mapping(address => GMStreak) public gmStreaks;

    /// @notice BOOZ rewards for each streak day (index 0 = day 1), days 1–7.
    uint256[7] public gmDayRewards = [
        5 ether, 10 ether, 15 ether, 20 ether, 25 ether, 30 ether, 35 ether
    ];

    /// @notice Flat BOOZ reward for days 8–90. Default: 50 BOOZ.
    uint256 public gmFlatDailyReward = 50 ether;

    /// @notice Milestone days for GM streaks: Warrior, Elite, Epic, Legend, Mythic.
    uint16[5] public gmMilestoneDays = [7, 14, 30, 60, 90];

    /// @notice One-time BOOZ bonuses at each milestone (18 decimals).
    ///         Total over 90 days = exactly 10,000 BOOZ.
    uint256[5] public gmMilestoneRewards = [
        50 ether,     // day 7  — Warrior
        250 ether,    // day 14 — Elite
        350 ether,    // day 30 — Epic
        500 ether,    // day 60 — Legend
        4_560 ether   // day 90 — Mythic (grand total = 10,000 BOOZ)
    ];

    uint256 public nextTokenId;
    uint256 public queueEndTime;   // end timestamp of the last queued slot
    uint256 private _slotCursor;   // first tokenId that may still be live or upcoming

    struct Slot {
        string  contentUrl;
        string  contentType;   // "youtube" | "tiktok" | "twitter" | "vimeo" | "spotify"
        string  aspectRatio;   // "16:9" | "9:16"
        string  title;
        string  authorName;
        string  imageUrl;
        uint256 scheduledTime;
        uint256 endTime;
        address creator;
        uint256 donations;     // cumulative total donated (payment token units, before fee split)
    }

    mapping(uint256 => Slot) public slots;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event SlotMinted(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 scheduledTime,
        uint256 endTime
    );

    event DonationReceived(
        uint256 indexed tokenId,
        address indexed donor,
        uint256 creatorAmount,
        uint256 feeAmount
    );

    event SlotPriceChanged(uint256 newPrice);
    event SlotDurationChanged(uint256 newDuration);
    event PaymentTokenChanged(address indexed newToken, uint256 newPrice);
    event DonationFeeBpsChanged(uint256 newBps);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event RewardTokenChanged(address indexed newToken);
    event SlotMintRewardChanged(uint256 newAmount);
    event FreeSlotCostChanged(uint256 newCost);
    event FreeSlotMinted(uint256 indexed tokenId, address indexed creator, uint256 tokensBurned);
    event DiscountSlotMinted(uint256 indexed tokenId, address indexed creator, uint256 tokensBurned, uint256 discountApplied);
    event DiscountBurnCostChanged(uint256 newCost);
    event DiscountAmountChanged(uint256 newAmount);
    event GMClaimed(address indexed user, uint16 streakCount, uint256 reward);
    event GMMilestoneReached(address indexed user, uint16 day, uint256 bonus);
    event GMDayRewardsChanged(uint256[7] newRewards);
    event GMMilestoneRewardsChanged(uint256[5] newRewards);
    event GMFlatDailyRewardChanged(uint256 newAmount);
    event RaffleChanged(address indexed newRaffle);
    event MaxQueueSizeChanged(uint256 newSize);
    event ContentTypeImageChanged(string contentType, string imageUrl);
    event PointsEarned(address indexed user, uint256 amount, string reason);
    event TicketsConverted(address indexed user, uint256 pointsBurned, uint256 ticketsMinted);
    event DonateBoozRewardChanged(uint256 newAmount);
    event NFTContractApproved(address indexed nftContract, bool approved);
    event NFTDiscountSlotMinted(uint256 indexed tokenId, address indexed creator, address indexed nftContract, uint256 nftTokenId);
    event NFTFreeSlotMinted(uint256 indexed tokenId, address indexed creator, address indexed nftContract, uint256 nftTokenId);

    error QueueFull();
    error NFTContractNotApproved();
    error NFTNotOwned();
    error NFTDiscountCooldown();
    error NFTFreeCooldown();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _paymentToken  ERC-20 token address, or address(0) for native ETH.
     */
    constructor(address _paymentToken)
        ERC721("Booztory Spotlight", "BOOST")
        Ownable(msg.sender)
    {
        paymentToken = _paymentToken;
    }

    // -------------------------------------------------------------------------
    // Internal — shared slot creation logic
    // -------------------------------------------------------------------------

    /**
     * @dev Schedule a slot, write storage, mint ERC-721, emit SlotMinted.
     *      Called by all three mint paths after payment/burn is handled.
     */
    /// @dev Rejects strings containing `"` or `\` to prevent JSON injection in tokenURI.
    function _requireSafeString(string calldata s, string memory field) internal pure {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            require(b[i] != 0x22 && b[i] != 0x5C, string(abi.encodePacked(field, ": invalid character")));
        }
    }

    /// @dev Blocks "://" and "www." substrings to prevent link spam in text slots.
    function _requireNoLinks(string calldata s) internal pure {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i + 2 < b.length; i++) {
            require(
                !(b[i] == 0x3A && b[i+1] == 0x2F && b[i+2] == 0x2F),
                "Links not allowed in text"
            );
        }
        for (uint256 i = 0; i + 3 < b.length; i++) {
            require(
                !(b[i] == 0x77 && b[i+1] == 0x77 && b[i+2] == 0x77 && b[i+3] == 0x2E),
                "Links not allowed in text"
            );
        }
    }

    function _createSlot(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) internal returns (uint256 tokenId) {
        require(bytes(contentType).length > 0, "Content type required");
        bool isText = keccak256(bytes(contentType)) == keccak256(bytes("text"));
        if (isText) {
            require(bytes(contentUrl).length > 0 && bytes(contentUrl).length <= 200, "Text must be 1-200 chars");
            _requireNoLinks(contentUrl);
        } else {
            require(bytes(contentUrl).length > 0, "Content URL required");
        }

        // Check queue capacity — O(1) math, no loop
        uint256 queuedCount = queueEndTime > block.timestamp
            ? (queueEndTime - block.timestamp + slotDuration - 1) / slotDuration
            : 0;
        if (queuedCount >= maxQueueSize) revert QueueFull();

        _requireSafeString(contentUrl,   "contentUrl");
        _requireSafeString(contentType,  "contentType");
        _requireSafeString(aspectRatio,  "aspectRatio");
        _requireSafeString(title,        "title");
        _requireSafeString(authorName,   "authorName");
        _requireSafeString(imageUrl,     "imageUrl");
        // Schedule slot after any existing queue
        uint256 start = block.timestamp > queueEndTime
            ? block.timestamp
            : queueEndTime;
        uint256 end = start + slotDuration;
        queueEndTime = end;

        tokenId = nextTokenId++;

        // Field-by-field assignment avoids stack-too-deep
        Slot storage s = slots[tokenId];
        s.contentUrl    = contentUrl;
        s.contentType   = contentType;
        s.aspectRatio   = aspectRatio;
        s.title         = title;
        s.authorName    = authorName;
        s.imageUrl      = imageUrl;
        s.scheduledTime = start;
        s.endTime       = end;
        s.creator       = msg.sender;

        _mint(msg.sender, tokenId);

        // Advance cursor past any expired slots so getCurrentSlot() stays O(1)
        while (_slotCursor < tokenId && slots[_slotCursor].endTime < block.timestamp) {
            _slotCursor++;
        }

        emit SlotMinted(tokenId, msg.sender, start, end);
    }

    // -------------------------------------------------------------------------
    // Mint — paid (1 USDC, earns BOOZ)
    // -------------------------------------------------------------------------

    /**
     * @notice Pay the slot price and mint a featured content slot.
     *         ERC-20: caller must approve this contract for slotPrice before calling.
     *         ETH: send slotPrice as msg.value; excess is refunded.
     */
    function mintSlot(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external payable nonReentrant whenNotPaused {
        _collectPayment(slotPrice);
        _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);

        // Mint BOOZ reward if reward token is set (non-blocking)
        if (rewardToken != address(0) && slotMintReward > 0) {
            try IBooztoryToken(rewardToken).mintReward(msg.sender, slotMintReward) {} catch {}
        }

        // Award points (non-blocking)
        if (mintPointReward > 0) {
            points[msg.sender] += mintPointReward;
            emit PointsEarned(msg.sender, mintPointReward, "mint");
        }

        // Raffle entry for paid mint (non-blocking)
        if (raffle != address(0)) {
            try IRaffle(raffle).addEntry(msg.sender) {} catch {}
        }
    }

    // -------------------------------------------------------------------------
    // Mint — free (burn BOOZ, no reward)
    // -------------------------------------------------------------------------

    /**
     * @notice Burn BOOZ tokens to mint a free featured content slot.
     *         No BOOZ reward is given — the burn path is a dead end.
     */
    function mintSlotWithTokens(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external nonReentrant whenNotPaused {
        require(rewardToken != address(0), "Reward token not set");

        IBooztoryToken(rewardToken).burnFrom(msg.sender, freeSlotCost);

        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);

        // Award points (non-blocking)
        if (mintPointReward > 0) {
            points[msg.sender] += mintPointReward;
            emit PointsEarned(msg.sender, mintPointReward, "mint");
        }

        emit FreeSlotMinted(tokenId, msg.sender, freeSlotCost);
    }

    // -------------------------------------------------------------------------
    // Mint — discounted (burn BOOZ + reduced USDC, earns BOOZ)
    // -------------------------------------------------------------------------

    /**
     * @notice Burn BOOZ tokens to mint a slot at a discounted price.
     *         Burns discountBurnCost BOOZ and charges (slotPrice - discountAmount).
     *         Still earns full BOOZ reward.
     */
    function mintSlotWithDiscount(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external payable nonReentrant whenNotPaused {
        require(rewardToken != address(0), "Reward token not set");
        require(discountAmount < slotPrice, "Discount exceeds slot price");

        IBooztoryToken(rewardToken).burnFrom(msg.sender, discountBurnCost);
        _collectPayment(slotPrice - discountAmount);

        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);

        // Full BOOZ reward — discount path still earns tokens (non-blocking)
        if (slotMintReward > 0) {
            try IBooztoryToken(rewardToken).mintReward(msg.sender, slotMintReward) {} catch {}
        }

        // Award points (non-blocking)
        if (mintPointReward > 0) {
            points[msg.sender] += mintPointReward;
            emit PointsEarned(msg.sender, mintPointReward, "mint");
        }

        emit DiscountSlotMinted(tokenId, msg.sender, discountBurnCost, discountAmount);

        // Raffle entry for paid mint (discount still pays USDC, non-blocking)
        if (raffle != address(0)) {
            try IRaffle(raffle).addEntry(msg.sender) {} catch {}
        }
    }

    // -------------------------------------------------------------------------
    // Mint — NFT pass discount (50% off, no BOOZ, no points, 1 raffle ticket)
    // -------------------------------------------------------------------------

    /**
     * @notice Holders of an approved NFT collection can mint at 50% off (slotPrice / 2).
     *         No BOOZ reward, no points — just the slot + 1 raffle ticket.
     *         Cooldown: once per 24 hours per NFT token ID. Cooldown stays with token ID on transfer.
     * @param nftContract  Approved ERC-721 collection address.
     * @param nftTokenId   Token ID the caller owns from that collection.
     */
    function mintSlotWithNFTDiscount(
        address nftContract,
        uint256 nftTokenId,
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external payable nonReentrant whenNotPaused {
        if (!approvedNFTContracts[nftContract])                                   revert NFTContractNotApproved();
        if (IERC721(nftContract).ownerOf(nftTokenId) != msg.sender)               revert NFTNotOwned();
        if (block.timestamp < nftLastDiscountMint[nftContract][nftTokenId] + 1 days) revert NFTDiscountCooldown();

        nftLastDiscountMint[nftContract][nftTokenId] = block.timestamp;

        _collectPayment(slotPrice / 2);
        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);

        // Credit 1 raffle ticket directly (non-blocking)
        if (raffle != address(0)) {
            try IRaffle(raffle).creditTickets(msg.sender, 1) {} catch {}
        }

        emit NFTDiscountSlotMinted(tokenId, msg.sender, nftContract, nftTokenId);
    }

    // -------------------------------------------------------------------------
    // Mint — NFT pass free (no cost, no BOOZ, no points, 1 raffle ticket)
    // -------------------------------------------------------------------------

    /**
     * @notice Holders of an approved NFT collection can mint one free slot per 30 days per token ID.
     *         No BOOZ reward, no points — just the slot + 1 raffle ticket.
     *         Cooldown: once per 30 days per NFT token ID. Cooldown stays with token ID on transfer.
     * @param nftContract  Approved ERC-721 collection address.
     * @param nftTokenId   Token ID the caller owns from that collection.
     */
    function mintSlotFreeWithNFT(
        address nftContract,
        uint256 nftTokenId,
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external nonReentrant whenNotPaused {
        if (!approvedNFTContracts[nftContract])                                  revert NFTContractNotApproved();
        if (IERC721(nftContract).ownerOf(nftTokenId) != msg.sender)              revert NFTNotOwned();
        if (block.timestamp < nftLastFreeMint[nftContract][nftTokenId] + 30 days) revert NFTFreeCooldown();

        nftLastFreeMint[nftContract][nftTokenId] = block.timestamp;

        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);

        // Credit 1 raffle ticket directly (non-blocking)
        if (raffle != address(0)) {
            try IRaffle(raffle).creditTickets(msg.sender, 1) {} catch {}
        }

        emit NFTFreeSlotMinted(tokenId, msg.sender, nftContract, nftTokenId);
    }

    // -------------------------------------------------------------------------
    // Internal — payment collection
    // -------------------------------------------------------------------------

    /**
     * @dev Collect payment in ETH or ERC-20. Refunds excess ETH.
     */
    function _collectPayment(uint256 price) internal {
        if (paymentToken == address(0)) {
            require(msg.value >= price, "Insufficient ETH");
            uint256 excess = msg.value - price;
            if (excess > 0) {
                (bool ok,) = msg.sender.call{value: excess}("");
                require(ok, "ETH refund failed");
            }
        } else {
            require(msg.value == 0, "ETH not accepted for ERC20 payment");
            require(
                IERC20(paymentToken).transferFrom(msg.sender, address(this), price),
                "Payment transfer failed"
            );
        }
    }

    // -------------------------------------------------------------------------
    // Donations — 95 % to creator, 5 % fee stays in contract
    // -------------------------------------------------------------------------

    /**
     * @notice Donate to a content creator.
     *         ERC-20: caller approves this contract for `amount`, then calls donate().
     *                 95% is forwarded to the creator; 5% fee stays in the contract.
     *         ETH:    send `amount` as msg.value; excess is refunded.
     */
    function donate(uint256 tokenId, uint256 amount) external payable nonReentrant whenNotPaused {
        require(tokenId < nextTokenId, "Token does not exist");
        require(amount > 0, "Amount must be > 0");

        Slot storage s = slots[tokenId];
        address creator = s.creator;

        uint256 feeAmount     = (amount * donationFeeBps) / 10_000;
        uint256 creatorAmount = amount - feeAmount;

        if (paymentToken == address(0)) {
            // ETH donation
            require(msg.value >= amount, "Insufficient ETH");
            uint256 excess = msg.value - amount;
            if (excess > 0) {
                (bool refundOk,) = msg.sender.call{value: excess}("");
                require(refundOk, "ETH refund failed");
            }
            // Send 95% to creator; 5% (feeAmount) stays as ETH in contract
            (bool payOk,) = creator.call{value: creatorAmount}("");
            require(payOk, "Creator payment failed");
        } else {
            require(msg.value == 0, "ETH not accepted for ERC20 donation");
            // Pull full amount from donor into contract
            require(
                IERC20(paymentToken).transferFrom(msg.sender, address(this), amount),
                "Transfer failed"
            );
            // Forward 95% to creator; 5% remains in contract
            require(
                IERC20(paymentToken).transfer(creator, creatorAmount),
                "Creator transfer failed"
            );
        }

        s.donations += amount;

        // Award points + BOOZ to donor once per 24h if donating to someone else's slot
        if (
            msg.sender != creator &&
            block.timestamp >= donateCooldown[msg.sender] + 1 days
        ) {
            donateCooldown[msg.sender] = block.timestamp;

            if (donatePointReward > 0) {
                points[msg.sender] += donatePointReward;
                emit PointsEarned(msg.sender, donatePointReward, "donate");
            }

            // BOOZ reward — first donation per 24h earns 1,000 BOOZ regardless of amount (non-blocking)
            if (rewardToken != address(0) && donateBoozReward > 0) {
                try IBooztoryToken(rewardToken).mintReward(msg.sender, donateBoozReward) {} catch {}
            }
        }

        emit DonationReceived(tokenId, msg.sender, creatorAmount, feeAmount);
    }

    // -------------------------------------------------------------------------
    // GM Streak — daily check-in for BOOZ rewards
    // -------------------------------------------------------------------------

    /**
     * @notice Claim daily GM reward. One claim per UTC day.
     *         Streak escalates: day 1 = 5, day 2 = 10, ... day 7 = 35 + 50 bonus.
     *         Missing a day resets the streak. After day 7, streak resets.
     */
    function claimDailyGM() external whenNotPaused {
        require(rewardToken != address(0), "Reward token not set");

        uint256 today = block.timestamp / 1 days;
        GMStreak storage streak = gmStreaks[msg.sender];

        require(streak.lastClaimDay != today, "Already claimed today");

        uint16 newCount;
        if (streak.lastClaimDay == today - 1 && streak.streakCount > 0) {
            // Consecutive day — continue streak
            newCount = streak.streakCount + 1;
        } else {
            // First claim ever or missed a day — start fresh
            newCount = 1;
        }

        streak.lastClaimDay = today;
        streak.streakCount = newCount;

        // Update highest streak if current surpasses it
        if (newCount > highestStreak[msg.sender]) {
            highestStreak[msg.sender] = newCount;
        }

        // Daily BOOZ reward:
        //   Days 1–7: escalating rewards
        //   Days 8–90: flat reward
        //   Day 91+: veteran mode — flat reward continues
        uint256 reward;
        if (newCount <= 7) {
            reward = gmDayRewards[newCount - 1];
        } else {
            reward = gmFlatDailyReward;
        }
        if (reward > 0) {
            try IBooztoryToken(rewardToken).mintReward(msg.sender, reward) {} catch {}
            emit GMClaimed(msg.sender, newCount, reward);
        }

        // Daily point award
        uint256 gmPoints = 1;

        // Milestone point bonuses (Phase 1: days 7, 14, 30, 60, 90)
        if (newCount <= 90) {
            for (uint256 i = 0; i < 5; i++) {
                if (newCount == gmMilestoneDays[i]) {
                    // BOOZ one-time milestone bonus
                    uint8 bit = uint8(1 << i);
                    if (streak.claimedMilestones & bit == 0) {
                        streak.claimedMilestones |= bit;
                        uint256 bonus = gmMilestoneRewards[i];
                        try IBooztoryToken(rewardToken).mintReward(msg.sender, bonus) {} catch {}
                        emit GMMilestoneReached(msg.sender, gmMilestoneDays[i], bonus);
                    }

                    // Point milestone bonuses: day7=+1, day14=+1, day30=+2, day60=+2, day90=+3
                    uint256[5] memory pointBonuses = [uint256(1), 1, 2, 2, 3];
                    gmPoints += pointBonuses[i];
                    break;
                }
            }
        } else {
            // Veteran mode (day 91+): +3 bonus points every 30 days
            // streakCount resets on miss, so (newCount - 90) tracks days since entering veteran mode
            uint256 veteranDay = newCount - 90;
            if (veteranDay % 30 == 0) {
                gmPoints += 3;
            }
        }

        points[msg.sender] += gmPoints;
        emit PointsEarned(msg.sender, gmPoints, "gm");
    }

    // -------------------------------------------------------------------------
    // Points → Tickets conversion
    // -------------------------------------------------------------------------

    /**
     * @notice Convert accumulated points into raffle tickets.
     *         Burns `pointsPerTicket` points per ticket. Calls raffle.creditTickets().
     * @param amount  Number of tickets to mint. Must have amount * pointsPerTicket points.
     */
    function convertToTickets(uint256 amount) external {
        require(raffle != address(0), "Raffle not set");
        require(amount > 0, "Amount must be > 0");
        uint256 cost = amount * pointsPerTicket;
        require(points[msg.sender] >= cost, "Insufficient points");
        points[msg.sender] -= cost;
        IRaffle(raffle).creditTickets(msg.sender, amount);
        emit TicketsConverted(msg.sender, cost, amount);
    }

    // -------------------------------------------------------------------------
    // Withdraw — owner only
    // -------------------------------------------------------------------------

    /**
     * @notice Withdraw all accumulated mint fees and donation fees to the owner.
     *         Withdraws the current paymentToken (ETH or ERC-20).
     */
    function withdraw() external onlyOwner nonReentrant {
        address to = owner();
        if (paymentToken == address(0)) {
            uint256 bal = address(this).balance;
            require(bal > 0, "No ETH to withdraw");
            (bool ok,) = to.call{value: bal}("");
            require(ok, "ETH withdrawal failed");
            emit Withdrawn(address(0), to, bal);
        } else {
            uint256 bal = IERC20(paymentToken).balanceOf(address(this));
            require(bal > 0, "No tokens to withdraw");
            require(IERC20(paymentToken).transfer(to, bal), "Token withdrawal failed");
            emit Withdrawn(paymentToken, to, bal);
        }
    }

    /**
     * @notice Withdraw any arbitrary ERC-20 from this contract (emergency recovery).
     * @param token  Must not be address(0); use withdraw() for ETH.
     */
    function withdrawToken(address token) external onlyOwner nonReentrant {
        require(token != address(0), "Use withdraw() for ETH");
        require(token != paymentToken, "Use withdraw() for payment token");
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "No token balance");
        address to = owner();
        require(IERC20(token).transfer(to, bal), "Token withdrawal failed");
        emit Withdrawn(token, to, bal);
    }

    /**
     * @notice Withdraw any ETH held by this contract to the owner.
     *         Covers ETH sent directly or accumulated when in ETH payment mode.
     */
    function withdrawETH() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "No ETH to withdraw");
        address to = owner();
        (bool ok,) = to.call{value: bal}("");
        require(ok, "ETH withdrawal failed");
        emit Withdrawn(address(0), to, bal);
    }

    // -------------------------------------------------------------------------
    // Admin — owner only
    // -------------------------------------------------------------------------

    /**
     * @notice Set the mint price in the current payment token's units.
     */
    function setSlotPrice(uint256 _price) external onlyOwner {
        require(_price > 0, "Price must be > 0");
        slotPrice = _price;
        emit SlotPriceChanged(_price);
    }

    /// @notice Pause all user-facing actions (mint, donate, GM claim). Emergency use only.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume normal operations after a pause.
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Set the featured slot duration in seconds.
     *         e.g. 15 minutes = 900, 1 hour = 3600.
     */
    function setSlotDuration(uint256 _duration) external onlyOwner {
        require(_duration > 0, "Duration must be > 0");
        slotDuration = _duration;
        emit SlotDurationChanged(_duration);
    }

    /**
     * @notice Switch the accepted payment token and update the slot price.
     * @param _token  address(0) for native ETH, otherwise an ERC-20 address.
     * @param _price  New price in the chosen token's smallest unit.
     */
    function setPaymentToken(address _token, uint256 _price) external onlyOwner {
        require(_price > 0, "Price must be > 0");
        paymentToken = _token;
        slotPrice    = _price;
        emit PaymentTokenChanged(_token, _price);
        emit SlotPriceChanged(_price);
    }

    /**
     * @notice Update the donation fee. Max 10 % (1000 bps).
     */
    function setDonationFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1_000, "Fee cannot exceed 10%");
        donationFeeBps = _bps;
        emit DonationFeeBpsChanged(_bps);
    }

    /**
     * @notice Set the BooztoryToken contract address. address(0) disables rewards.
     */
    function setRewardToken(address _token) external onlyOwner {
        rewardToken = _token;
        emit RewardTokenChanged(_token);
    }

    /**
     * @notice Set the BOOZ reward amount for paid slot mints (18 decimals).
     */
    function setSlotMintReward(uint256 _amount) external onlyOwner {
        slotMintReward = _amount;
        emit SlotMintRewardChanged(_amount);
    }

    /**
     * @notice Set the BOOZ cost to mint a free slot via burnFrom (18 decimals).
     */
    function setFreeSlotCost(uint256 _cost) external onlyOwner {
        require(_cost > 0, "Cost must be > 0");
        freeSlotCost = _cost;
        emit FreeSlotCostChanged(_cost);
    }

    /**
     * @notice Set the BOOZ rewards for each GM streak day (array of 7, 18 decimals).
     */
    function setGMDayRewards(uint256[7] calldata _rewards) external onlyOwner {
        gmDayRewards = _rewards;
        emit GMDayRewardsChanged(_rewards);
    }

    /**
     * @notice Set the flat daily BOOZ reward for streak days 8–90 (18 decimals).
     */
    function setGMFlatDailyReward(uint256 _amount) external onlyOwner {
        gmFlatDailyReward = _amount;
        emit GMFlatDailyRewardChanged(_amount);
    }

    /**
     * @notice Set one-time milestone bonuses for GM streaks (array of 5, 18 decimals).
     *         Order: day 7, 14, 30, 60, 90.
     */
    function setGMMilestoneRewards(uint256[5] calldata _rewards) external onlyOwner {
        gmMilestoneRewards = _rewards;
        emit GMMilestoneRewardsChanged(_rewards);
    }

    /**
     * @notice Set the BOOZ burn cost for a discounted slot mint (18 decimals).
     */
    function setDiscountBurnCost(uint256 _cost) external onlyOwner {
        require(_cost > 0, "Cost must be > 0");
        discountBurnCost = _cost;
        emit DiscountBurnCostChanged(_cost);
    }

    /**
     * @notice Set the maximum number of slots allowed in the queue.
     */
    function setMaxQueueSize(uint256 _size) external onlyOwner {
        require(_size > 0, "Size must be > 0");
        maxQueueSize = _size;
        emit MaxQueueSizeChanged(_size);
    }

    /**
     * @notice Set the BooztoryRaffle contract address. address(0) disables raffle.
     */
    function setRaffle(address _raffle) external onlyOwner {
        raffle = _raffle;
        emit RaffleChanged(_raffle);
    }

    /**
     * @notice Approve or revoke an NFT collection for platform perks.
     *         The NFT contract does not need to exist at the time of approval.
     *         Call with approved=true when the NFT drop is ready.
     */
    function setNFTContract(address nftContract, bool approved) external onlyOwner {
        require(nftContract != address(0), "Invalid address");
        bool wasApproved = approvedNFTContracts[nftContract];
        approvedNFTContracts[nftContract] = approved;
        if (approved && !wasApproved) {
            approvedNFTList.push(nftContract);
        } else if (!approved && wasApproved) {
            uint256 len = approvedNFTList.length;
            for (uint256 i = 0; i < len; i++) {
                if (approvedNFTList[i] == nftContract) {
                    approvedNFTList[i] = approvedNFTList[len - 1];
                    approvedNFTList.pop();
                    break;
                }
            }
        }
        emit NFTContractApproved(nftContract, approved);
    }

    /// @notice Returns all currently-approved NFT contract addresses.
    function getApprovedNFTContracts() external view returns (address[] memory) {
        return approvedNFTList;
    }

    /// @notice Set points awarded per slot mint (all paths).
    function setMintPointReward(uint256 _amount) external onlyOwner {
        mintPointReward = _amount;
    }

    /// @notice Set points awarded per donate action (once per 24h).
    function setDonatePointReward(uint256 _amount) external onlyOwner {
        donatePointReward = _amount;
    }

    /// @notice Set BOOZ reward for first donation per 24h (18 decimals). 0 = disabled.
    function setDonateBoozReward(uint256 _amount) external onlyOwner {
        donateBoozReward = _amount;
        emit DonateBoozRewardChanged(_amount);
    }

    /// @notice Set points required per raffle ticket conversion.
    function setPointsPerTicket(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Must be > 0");
        pointsPerTicket = _amount;
    }

    /**
     * @notice Set the payment token discount amount (in payment token units).
     *         e.g. 100_000 = 0.1 USDC. Must be less than slotPrice.
     */
    function setDiscountAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be > 0");
        require(_amount < slotPrice, "Discount must be less than slot price");
        discountAmount = _amount;
        emit DiscountAmountChanged(_amount);
    }

    /**
     * @notice Set a custom NFT image for a content type. Overrides creator-submitted imageUrl.
     *         Pass an empty string to remove the override and revert to creator's imageUrl.
     *         e.g. setContentTypeImage("youtube", "https://booztory.com/nft/youtube.png")
     */
    function setContentTypeImage(string calldata _contentType, string calldata _imageUrl) external onlyOwner {
        contentTypeImage[_contentType] = _imageUrl;
        emit ContentTypeImageChanged(_contentType, _imageUrl);
    }

    // -------------------------------------------------------------------------
    // Receive ETH (for ETH payment mode)
    // -------------------------------------------------------------------------

    receive() external payable {}

    // -------------------------------------------------------------------------
    // Status helpers
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the number of slots currently in the queue (live + upcoming).
     *         Uses O(1) timestamp math — no loop.
     */
    function getQueueSize() external view returns (uint256) {
        return queueEndTime > block.timestamp
            ? (queueEndTime - block.timestamp + slotDuration - 1) / slotDuration
            : 0;
    }

    function getSlotStatus(uint256 tokenId) public view returns (string memory) {
        require(tokenId < nextTokenId, "Token does not exist");
        Slot storage s = slots[tokenId];
        if (block.timestamp < s.scheduledTime) return "queue";
        if (block.timestamp <= s.endTime)      return "live";
        return "done";
    }

    // -------------------------------------------------------------------------
    // Read: current / upcoming / past / by creator
    // -------------------------------------------------------------------------

    function getCurrentSlot()
        external
        view
        returns (uint256 tokenId, Slot memory slot, bool found)
    {
        for (uint256 i = _slotCursor; i < nextTokenId; i++) {
            Slot storage s = slots[i];
            if (block.timestamp < s.scheduledTime) break; // all remaining slots are future
            if (block.timestamp <= s.endTime) return (i, s, true);
        }
        return (0, slots[0], false);
    }

    /// @notice Advance the slot cursor past expired slots.
    ///         Anyone can call this — useful during idle periods with no new mints.
    function advanceCursor() external {
        while (_slotCursor < nextTokenId && slots[_slotCursor].endTime < block.timestamp) {
            _slotCursor++;
        }
    }

    function getUpcomingSlots()
        external
        view
        returns (uint256[] memory tokenIds, Slot[] memory slotData)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (block.timestamp < slots[i].scheduledTime) count++;
        }
        tokenIds = new uint256[](count);
        slotData  = new Slot[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (block.timestamp < slots[i].scheduledTime) {
                tokenIds[idx] = i;
                slotData[idx]  = slots[i];
                idx++;
            }
        }
    }

    function getPastSlots(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory tokenIds, Slot[] memory slotData, uint256 total)
    {
        uint256[] memory pastIds = new uint256[](nextTokenId);
        uint256 count = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (block.timestamp > slots[i].endTime) {
                pastIds[count++] = i;
            }
        }
        total = count;
        if (offset >= count) {
            return (new uint256[](0), new Slot[](0), total);
        }
        uint256 available  = count - offset;
        uint256 resultLen  = available < limit ? available : limit;
        tokenIds = new uint256[](resultLen);
        slotData  = new Slot[](resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            uint256 srcIdx = count - 1 - offset - i;
            tokenIds[i] = pastIds[srcIdx];
            slotData[i]  = slots[pastIds[srcIdx]];
        }
    }

    function getSlotsByCreator(address creator)
        external
        view
        returns (uint256[] memory tokenIds, Slot[] memory slotData)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (slots[i].creator == creator) count++;
        }
        tokenIds = new uint256[](count);
        slotData  = new Slot[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (slots[i].creator == creator) {
                tokenIds[idx] = i;
                slotData[idx]  = slots[i];
                idx++;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Token URI — on-chain base64 JSON metadata
    // -------------------------------------------------------------------------

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(tokenId < nextTokenId, "Token does not exist");
        Slot storage s = slots[tokenId];

        string memory image = bytes(contentTypeImage[s.contentType]).length > 0
            ? contentTypeImage[s.contentType]
            : s.imageUrl;

        bytes memory json = abi.encodePacked(
            '{"name":"Booztory Spotlight #', tokenId.toString(), '",',
            '"description":"Every spotlight is a moment. Yours, forever on-chain.",',
            '"image":"', image, '",',
            '"external_url":"https://booztory.com",',
            '"attributes":[',
            '{"trait_type":"Content Type","value":"', s.contentType, '"}',
            ']}'
        );

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(json)
        ));
    }
}
