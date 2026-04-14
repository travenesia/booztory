// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal interface for BooztoryToken reward calls.
interface IBooztoryToken {
    function mintReward(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
}

/// @notice Minimal interface for BooztoryRaffleWorld calls.
interface IRaffle {
    function addEntry(address minter) external;
    function creditTickets(address user, uint256 amount) external;
}

/// @notice Permit2 AllowanceTransfer — used for ERC-20 payments.
///         World App pre-approves all tokens to Permit2 globally.
///         Frontend bundles Permit2.approve(token, booztory, amount, 0) + mintSlot in one sendTransaction.
interface IPermit2 {
    function transferFrom(address from, address to, uint160 amount, address token) external;
}

/// @notice Chainlink AggregatorV3-compatible price feed (WLD/USD, ETH/USD).
///         Returns price in USD with 18 decimals.
interface IAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

// ── World ID ──────────────────────────────────────────────────────────────────

/// @dev Hashes bytes to a field element for World ID signal/nullifier computation.
library ByteHasher {
    function hashToField(bytes memory value) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(value))) >> 8;
    }
}

/// @notice Minimal IWorldID interface — World Chain WorldIDRouter (Legacy v3).
///
/// ⚠  World ID v4 Migration — required before April 1, 2027
///    See: https://docs.world.org/world-id/migration
interface IWorldID {
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}

/**
 * @title BooztoryWorld
 * @notice ERC-721 content spotlight platform on World Chain (chainId: 480).
 *
 *         Payment tokens:
 *           USDC  — standard path via Permit2 AllowanceTransfer
 *           WLD   — oracle-priced (WLD/USD Api3 dAPI), via Permit2
 *           ETH   — oracle-priced (ETH/USD Api3 dAPI), native payable
 *
 *         All paths earn the same BOOZ reward + raffle entry.
 *         Discount paths burn 1,000 BOOZ + pay ~0.9 USD equivalent in any token.
 *         Free path burns 10,000 BOOZ, no BOOZ earned, no raffle entry.
 *
 *         Donations: 95% forwarded to creator, 5% fee kept.
 *                    All donation amounts stored as USD-equivalent (6 dec) in slot.donations
 *                    regardless of payment token — consistent display across all surfaces.
 *
 *         Oracle math (tokens with 18 decimals, USDC base price in 6 decimals):
 *           tokenAmount = usdAmount_6dec * 1e30 / oraclePrice_18dec
 *           usdAmount_6dec = tokenAmount_18dec * oraclePrice_18dec / 1e30
 *         Note: Api3 latestRoundData() returns 18-decimal prices on World Chain.
 *
 *         Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3 (canonical across all EVM chains)
 *         WLD/USD oracle: 0x8Bb2943AB030E3eE05a58d9832525B4f60A97FA0
 *         ETH/USD oracle: 0xe1d72a719171DceAB9499757EB9d5AEb9e8D64A6
 */
contract BooztoryWorld is ERC721, Ownable, Pausable, ReentrancyGuard {
    using ByteHasher for bytes;
    using SafeERC20 for IERC20;

    uint256 internal constant GROUP_ID = 1;

    // ── Permit2 ───────────────────────────────────────────────────────────────
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // ── Oracle staleness tolerance ────────────────────────────────────────────
    uint256 private constant ORACLE_STALENESS = 48 hours;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Primary payment token (USDC on World Chain, 6 decimals).
    address public paymentToken;

    /// @notice Slot price in USDC (6 decimals). Default: 1 USDC.
    ///         WLD and ETH prices are derived from this via oracle at tx time.
    uint256 public slotPrice = 1_000_000;

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

    /// @notice Discount in USDC units (6 dec). Applied to slotPrice before oracle conversion.
    uint256 public discountAmount = 100_000; // 0.1 USDC

    /// @notice BooztoryRaffleWorld contract. address(0) = raffle disabled.
    address public raffle;

    /// @notice Maximum slots allowed in the queue. Default: 96 (24h at 15 min).
    uint256 public maxQueueSize = 96;

    // ── WLD / ETH payment ─────────────────────────────────────────────────────

    /// @notice WLD token address on World Chain.
    address public wldToken;

    /// @notice Api3 WLD/USD price feed proxy.
    address public wldOracle;

    /// @notice Api3 ETH/USD price feed proxy.
    address public ethOracle;

    // ---- Points & Tickets ----

    uint256 public mintPointReward  = 15;
    uint256 public donatePointReward = 5;
    uint256 public donateBoozReward  = 1_000 ether;
    uint256 public pointsPerTicket   = 5;

    mapping(address => uint256) public points;
    mapping(address => uint16)  public highestStreak;
    mapping(address => uint256) public donateCooldown;
    mapping(string  => string)  public contentTypeImage;

    // ── World ID ──────────────────────────────────────────────────────────────

    IWorldID public worldId;
    uint256  public externalNullifierHash;
    bool     public requireVerification;

    mapping(address  => bool) public verifiedHumans;
    mapping(uint256  => bool) private _usedNullifiers;

    // ---- GM Streak ----

    struct GMStreak {
        uint256 lastClaimDay;
        uint16  streakCount;
        uint8   claimedMilestones;
    }

    mapping(address => GMStreak) public gmStreaks;

    uint256[7] public gmDayRewards = [
        5 ether, 10 ether, 15 ether, 20 ether, 25 ether, 30 ether, 35 ether
    ];
    uint256   public gmFlatDailyReward = 50 ether;
    uint16[5] public gmMilestoneDays   = [7, 14, 30, 60, 90];
    uint256[5] public gmMilestoneRewards = [
        50 ether, 250 ether, 350 ether, 500 ether, 4_560 ether
    ];

    uint256 public nextTokenId;
    uint256 public queueEndTime;
    uint256 private _slotCursor;

    struct Slot {
        string  contentUrl;
        string  contentType;
        string  aspectRatio;
        string  title;
        string  authorName;
        string  imageUrl;
        uint256 scheduledTime;
        uint256 endTime;
        address creator;
        uint256 donations; // always stored as USD-equivalent (6 decimals)
    }

    mapping(uint256 => Slot) public slots;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event SlotMinted(uint256 indexed tokenId, address indexed creator, uint256 scheduledTime, uint256 endTime);
    event WLDSlotMinted(uint256 indexed tokenId, address indexed creator, uint256 wldAmount);
    event DonationReceived(uint256 indexed tokenId, address indexed donor, uint256 creatorAmount, uint256 feeAmount, address paymentToken);
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
    event HumanVerified(address indexed wallet);
    event WorldIdChanged(address indexed newWorldId);
    event WldTokenChanged(address indexed newToken);
    event WldOracleChanged(address indexed newOracle);
    event EthOracleChanged(address indexed newOracle);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error QueueFull();
    error NotVerifiedHuman();
    error DuplicateNullifier();
    error WorldIdNotSet();
    error OracleNotSet();
    error OraclePriceInvalid();
    error WldNotSet();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyVerifiedHuman() {
        if (requireVerification && !verifiedHumans[msg.sender]) revert NotVerifiedHuman();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _paymentToken  USDC address on World Chain.
     * @param _wldToken      WLD token address on World Chain.
     * @param _wldOracle     Api3 WLD/USD proxy (0x8Bb2943AB030E3eE05a58d9832525B4f60A97FA0).
     * @param _ethOracle     Api3 ETH/USD proxy (0xe1d72a719171DceAB9499757EB9d5AEb9e8D64A6).
     */
    constructor(
        address _paymentToken,
        address _wldToken,
        address _wldOracle,
        address _ethOracle
    )
        ERC721("Booztory Spotlight", "BOOST")
        Ownable(msg.sender)
    {
        paymentToken = _paymentToken;
        wldToken     = _wldToken;
        wldOracle    = _wldOracle;
        ethOracle    = _ethOracle;
    }

    // -------------------------------------------------------------------------
    // World ID — one-time human verification
    // -------------------------------------------------------------------------

    function verifyHuman(
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        if (address(worldId) == address(0)) revert WorldIdNotSet();
        if (_usedNullifiers[nullifierHash])  revert DuplicateNullifier();

        worldId.verifyProof(
            root,
            GROUP_ID,
            abi.encodePacked(msg.sender).hashToField(),
            nullifierHash,
            externalNullifierHash,
            proof
        );

        _usedNullifiers[nullifierHash] = true;
        verifiedHumans[msg.sender]     = true;
        emit HumanVerified(msg.sender);
    }

    // -------------------------------------------------------------------------
    // Oracle helpers
    // -------------------------------------------------------------------------

    function _readOracle(address oracle) internal view returns (uint256) {
        if (oracle == address(0)) revert OracleNotSet();
        (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(oracle).latestRoundData();
        if (answer <= 0) revert OraclePriceInvalid();
        if (block.timestamp - updatedAt > ORACLE_STALENESS) revert OraclePriceInvalid();
        return uint256(answer);
    }

    /// @dev usdAmount (6 dec) → token amount (18 dec) using oracle (USD/token, 18 dec).
    function _usdToToken(uint256 usdAmount6dec, address oracle) internal view returns (uint256) {
        uint256 price = _readOracle(oracle);
        return (usdAmount6dec * 1e30) / price;
    }

    /// @dev token amount (18 dec) → usd amount (6 dec) using oracle (USD/token, 18 dec).
    function _tokenToUsd(uint256 tokenAmount18, address oracle) internal view returns (uint256) {
        uint256 price = _readOracle(oracle);
        return (tokenAmount18 * price) / 1e30;
    }

    // -------------------------------------------------------------------------
    // Internal — payment collection via Permit2
    // -------------------------------------------------------------------------

    /// @dev Pulls ERC-20 tokens from msg.sender via Permit2 AllowanceTransfer.
    ///      Frontend must bundle Permit2.approve(token, address(this), amount, 0)
    ///      in the same sendTransaction call before calling any mint/donate function.
    function _pullPermit2(address token, uint256 amount) internal {
        IPermit2(PERMIT2).transferFrom(msg.sender, address(this), uint160(amount), token);
    }

    // -------------------------------------------------------------------------
    // Internal — shared slot creation
    // -------------------------------------------------------------------------

    function _requireSafeString(string calldata s, string memory field) internal pure {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            require(b[i] != 0x22 && b[i] != 0x5C, string(abi.encodePacked(field, ": invalid character")));
        }
    }

    function _requireNoLinks(string calldata s) internal pure {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i + 2 < b.length; i++) {
            require(!(b[i] == 0x3A && b[i+1] == 0x2F && b[i+2] == 0x2F), "Links not allowed in text");
        }
        for (uint256 i = 0; i + 3 < b.length; i++) {
            require(!(b[i] == 0x77 && b[i+1] == 0x77 && b[i+2] == 0x77 && b[i+3] == 0x2E), "Links not allowed in text");
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

        uint256 queuedCount = queueEndTime > block.timestamp
            ? (queueEndTime - block.timestamp + slotDuration - 1) / slotDuration
            : 0;
        if (queuedCount >= maxQueueSize) revert QueueFull();

        _requireSafeString(contentUrl,  "contentUrl");
        _requireSafeString(contentType, "contentType");
        _requireSafeString(aspectRatio, "aspectRatio");
        _requireSafeString(title,       "title");
        _requireSafeString(authorName,  "authorName");
        _requireSafeString(imageUrl,    "imageUrl");

        uint256 start = block.timestamp > queueEndTime ? block.timestamp : queueEndTime;
        uint256 end   = start + slotDuration;
        queueEndTime  = end;

        tokenId = nextTokenId++;

        Slot storage s  = slots[tokenId];
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

        while (_slotCursor < tokenId && slots[_slotCursor].endTime < block.timestamp) {
            _slotCursor++;
        }

        emit SlotMinted(tokenId, msg.sender, start, end);
    }

    // -------------------------------------------------------------------------
    // Internal — post-mint rewards (paid paths only)
    // -------------------------------------------------------------------------

    /// @dev Called after every paid mint (USDC / WLD / ETH / discount variants).
    ///      Mints BOOZ, awards points, adds raffle entry.
    function _handlePaidMintRewards() internal {
        if (rewardToken != address(0) && slotMintReward > 0) {
            try IBooztoryToken(rewardToken).mintReward(msg.sender, slotMintReward) {} catch {}
        }
        if (mintPointReward > 0) {
            points[msg.sender] += mintPointReward;
            emit PointsEarned(msg.sender, mintPointReward, "mint");
        }
        if (raffle != address(0)) {
            try IRaffle(raffle).addEntry(msg.sender) {} catch {}
        }
    }

    // -------------------------------------------------------------------------
    // Internal — post-donate rewards
    // -------------------------------------------------------------------------

    function _handleDonateRewards(address donor, address creator) internal {
        if (donor == creator) return;
        if (block.timestamp < donateCooldown[donor] + 1 days) return;
        donateCooldown[donor] = block.timestamp;
        if (donatePointReward > 0) {
            points[donor] += donatePointReward;
            emit PointsEarned(donor, donatePointReward, "donate");
        }
        if (rewardToken != address(0) && donateBoozReward > 0) {
            try IBooztoryToken(rewardToken).mintReward(donor, donateBoozReward) {} catch {}
        }
    }

    // -------------------------------------------------------------------------
    // Mint — USDC (standard, Permit2)
    // -------------------------------------------------------------------------

    function mintSlot(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external nonReentrant whenNotPaused onlyVerifiedHuman {
        _pullPermit2(paymentToken, slotPrice);
        _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);
        _handlePaidMintRewards();
    }

    // -------------------------------------------------------------------------
    // Mint — USDC discounted (burn BOOZ + reduced USDC, Permit2)
    // -------------------------------------------------------------------------

    function mintSlotWithDiscount(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external nonReentrant whenNotPaused onlyVerifiedHuman {
        require(rewardToken != address(0), "Reward token not set");
        require(discountAmount < slotPrice,  "Discount exceeds slot price");
        IBooztoryToken(rewardToken).burnFrom(msg.sender, discountBurnCost);
        _pullPermit2(paymentToken, slotPrice - discountAmount);
        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);
        _handlePaidMintRewards();
        emit DiscountSlotMinted(tokenId, msg.sender, discountBurnCost, discountAmount);
    }

    // -------------------------------------------------------------------------
    // Mint — free (burn BOOZ only, no BOOZ earned, no raffle entry)
    // -------------------------------------------------------------------------

    function mintSlotWithTokens(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external nonReentrant whenNotPaused onlyVerifiedHuman {
        require(rewardToken != address(0), "Reward token not set");
        IBooztoryToken(rewardToken).burnFrom(msg.sender, freeSlotCost);
        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);
        if (mintPointReward > 0) {
            points[msg.sender] += mintPointReward;
            emit PointsEarned(msg.sender, mintPointReward, "mint");
        }
        emit FreeSlotMinted(tokenId, msg.sender, freeSlotCost);
    }

    // -------------------------------------------------------------------------
    // Mint — WLD (oracle-priced, Permit2)
    // -------------------------------------------------------------------------

    function mintSlotWithWLD(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external nonReentrant whenNotPaused onlyVerifiedHuman {
        if (wldToken == address(0)) revert WldNotSet();
        uint256 wldAmount = _usdToToken(slotPrice, wldOracle);
        _pullPermit2(wldToken, wldAmount);
        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);
        _handlePaidMintRewards();
        emit WLDSlotMinted(tokenId, msg.sender, wldAmount);
    }

    // -------------------------------------------------------------------------
    // Mint — WLD discounted (burn BOOZ + oracle-priced WLD, Permit2)
    // -------------------------------------------------------------------------

    function mintSlotWithWLDDiscount(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external nonReentrant whenNotPaused onlyVerifiedHuman {
        require(rewardToken != address(0), "Reward token not set");
        require(discountAmount < slotPrice,  "Discount exceeds slot price");
        if (wldToken == address(0)) revert WldNotSet();
        IBooztoryToken(rewardToken).burnFrom(msg.sender, discountBurnCost);
        uint256 wldAmount = _usdToToken(slotPrice - discountAmount, wldOracle);
        _pullPermit2(wldToken, wldAmount);
        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);
        _handlePaidMintRewards();
        emit DiscountSlotMinted(tokenId, msg.sender, discountBurnCost, discountAmount);
        emit WLDSlotMinted(tokenId, msg.sender, wldAmount);
    }

    // -------------------------------------------------------------------------
    // Mint — ETH (oracle-priced, payable)
    // -------------------------------------------------------------------------

    function mintSlotWithETH(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external payable nonReentrant whenNotPaused onlyVerifiedHuman {
        uint256 ethRequired = _usdToToken(slotPrice, ethOracle);
        require(msg.value >= ethRequired, "Insufficient ETH");
        _refundExcessETH(ethRequired);
        _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);
        _handlePaidMintRewards();
    }

    // -------------------------------------------------------------------------
    // Mint — ETH discounted (burn BOOZ + oracle-priced ETH, payable)
    // -------------------------------------------------------------------------

    function mintSlotWithETHDiscount(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external payable nonReentrant whenNotPaused onlyVerifiedHuman {
        require(rewardToken != address(0), "Reward token not set");
        require(discountAmount < slotPrice,  "Discount exceeds slot price");
        IBooztoryToken(rewardToken).burnFrom(msg.sender, discountBurnCost);
        uint256 ethRequired = _usdToToken(slotPrice - discountAmount, ethOracle);
        require(msg.value >= ethRequired, "Insufficient ETH");
        _refundExcessETH(ethRequired);
        uint256 tokenId = _createSlot(contentUrl, contentType, aspectRatio, title, authorName, imageUrl);
        _handlePaidMintRewards();
        emit DiscountSlotMinted(tokenId, msg.sender, discountBurnCost, discountAmount);
    }

    function _refundExcessETH(uint256 required) internal {
        uint256 excess = msg.value - required;
        if (excess > 0) {
            (bool ok,) = msg.sender.call{value: excess}("");
            require(ok, "ETH refund failed");
        }
    }

    // -------------------------------------------------------------------------
    // Donate — USDC (Permit2)
    // -------------------------------------------------------------------------

    function donate(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        require(tokenId < nextTokenId, "Token does not exist");
        require(amount > 0, "Amount must be > 0");
        Slot storage s  = slots[tokenId];
        address creator = s.creator;
        uint256 feeAmount     = (amount * donationFeeBps) / 10_000;
        uint256 creatorAmount = amount - feeAmount;
        _pullPermit2(paymentToken, amount);
        IERC20(paymentToken).safeTransfer(creator, creatorAmount);
        s.donations += amount; // USDC 6 dec — already USD
        _handleDonateRewards(msg.sender, creator);
        emit DonationReceived(tokenId, msg.sender, creatorAmount, feeAmount, paymentToken);
    }

    // -------------------------------------------------------------------------
    // Donate — WLD (Permit2, stores USD-equivalent)
    // -------------------------------------------------------------------------

    function donateWithWLD(uint256 tokenId, uint256 wldAmount) external nonReentrant whenNotPaused {
        require(tokenId < nextTokenId, "Token does not exist");
        require(wldAmount > 0, "Amount must be > 0");
        if (wldToken == address(0)) revert WldNotSet();
        Slot storage s  = slots[tokenId];
        address creator = s.creator;
        uint256 feeAmount     = (wldAmount * donationFeeBps) / 10_000;
        uint256 creatorAmount = wldAmount - feeAmount;
        uint256 usdTotal      = _tokenToUsd(wldAmount, wldOracle);
        uint256 usdFee        = (usdTotal * donationFeeBps) / 10_000;
        _pullPermit2(wldToken, wldAmount);
        IERC20(wldToken).safeTransfer(creator, creatorAmount);
        // Store and emit USD-equivalent so all surfaces display consistently
        s.donations += usdTotal;
        _handleDonateRewards(msg.sender, creator);
        emit DonationReceived(tokenId, msg.sender, usdTotal - usdFee, usdFee, wldToken);
    }

    // -------------------------------------------------------------------------
    // Donate — ETH (payable, stores USD-equivalent)
    // -------------------------------------------------------------------------

    function donateWithETH(uint256 tokenId) external payable nonReentrant whenNotPaused {
        require(tokenId < nextTokenId, "Token does not exist");
        require(msg.value > 0, "Amount must be > 0");
        Slot storage s  = slots[tokenId];
        address creator = s.creator;
        uint256 amount        = msg.value;
        uint256 feeAmount     = (amount * donationFeeBps) / 10_000;
        uint256 creatorAmount = amount - feeAmount;
        uint256 usdTotal      = _tokenToUsd(amount, ethOracle);
        uint256 usdFee        = (usdTotal * donationFeeBps) / 10_000;
        (bool ok,) = creator.call{value: creatorAmount}("");
        require(ok, "Creator payment failed");
        // Store and emit USD-equivalent so all surfaces display consistently
        s.donations += usdTotal;
        _handleDonateRewards(msg.sender, creator);
        emit DonationReceived(tokenId, msg.sender, usdTotal - usdFee, usdFee, address(0));
    }

    // -------------------------------------------------------------------------
    // GM Streak
    // -------------------------------------------------------------------------

    function claimDailyGM() external whenNotPaused onlyVerifiedHuman {
        require(rewardToken != address(0), "Reward token not set");

        uint256 today = block.timestamp / 1 days;
        GMStreak storage streak = gmStreaks[msg.sender];

        require(streak.lastClaimDay != today, "Already claimed today");

        uint16 newCount;
        if (streak.lastClaimDay == today - 1 && streak.streakCount > 0) {
            newCount = streak.streakCount + 1;
        } else {
            newCount = 1;
        }

        streak.lastClaimDay = today;
        streak.streakCount  = newCount;

        if (newCount > highestStreak[msg.sender]) {
            highestStreak[msg.sender] = newCount;
        }

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

        uint256 gmPoints = 1;

        if (newCount <= 90) {
            for (uint256 i = 0; i < 5; i++) {
                if (newCount == gmMilestoneDays[i]) {
                    uint8 bit = uint8(1 << i);
                    if (streak.claimedMilestones & bit == 0) {
                        streak.claimedMilestones |= bit;
                        uint256 bonus = gmMilestoneRewards[i];
                        try IBooztoryToken(rewardToken).mintReward(msg.sender, bonus) {} catch {}
                        emit GMMilestoneReached(msg.sender, gmMilestoneDays[i], bonus);
                    }
                    uint256[5] memory pointBonuses = [uint256(1), 1, 2, 2, 3];
                    gmPoints += pointBonuses[i];
                    break;
                }
            }
        } else {
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

    function convertToTickets(uint256 amount) external onlyVerifiedHuman {
        require(raffle != address(0), "Raffle not set");
        require(amount > 0, "Amount must be > 0");
        uint256 cost = amount * pointsPerTicket;
        require(points[msg.sender] >= cost, "Insufficient points");
        points[msg.sender] -= cost;
        IRaffle(raffle).creditTickets(msg.sender, amount);
        emit TicketsConverted(msg.sender, cost, amount);
    }

    // -------------------------------------------------------------------------
    // Views — oracle prices
    // -------------------------------------------------------------------------

    /// @notice Current WLD equivalent of slotPrice at oracle rate.
    function getSlotPriceInWLD() external view returns (uint256) {
        return _usdToToken(slotPrice, wldOracle);
    }

    /// @notice Current ETH equivalent of slotPrice at oracle rate.
    function getSlotPriceInETH() external view returns (uint256) {
        return _usdToToken(slotPrice, ethOracle);
    }

    /// @notice Raw oracle price for WLD/USD — 18-decimal (Api3 latestRoundData answer).
    function getWLDPrice() external view returns (uint256) {
        return _readOracle(wldOracle);
    }

    /// @notice Raw oracle price for ETH/USD — 18-decimal (Api3 latestRoundData answer).
    function getETHPrice() external view returns (uint256) {
        return _readOracle(ethOracle);
    }

    // -------------------------------------------------------------------------
    // Withdraw
    // -------------------------------------------------------------------------

    /// @notice Withdraw any token or ETH. Use address(0) for ETH.
    function withdraw(address token) external onlyOwner nonReentrant {
        address to = owner();
        if (token == address(0)) {
            uint256 bal = address(this).balance;
            require(bal > 0, "No ETH to withdraw");
            (bool ok,) = to.call{value: bal}("");
            require(ok, "ETH withdrawal failed");
            emit Withdrawn(address(0), to, bal);
        } else {
            uint256 bal = IERC20(token).balanceOf(address(this));
            require(bal > 0, "No token balance");
            IERC20(token).safeTransfer(to, bal);
            emit Withdrawn(token, to, bal);
        }
    }

    // -------------------------------------------------------------------------
    // Admin — owner only
    // -------------------------------------------------------------------------

    function setSlotPrice(uint256 _price) external onlyOwner {
        require(_price > 0, "Price must be > 0");
        slotPrice = _price;
        emit SlotPriceChanged(_price);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setSlotDuration(uint256 _duration) external onlyOwner {
        require(_duration > 0, "Duration must be > 0");
        slotDuration = _duration;
        emit SlotDurationChanged(_duration);
    }

    function setPaymentToken(address _token, uint256 _price) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_price > 0, "Price must be > 0");
        paymentToken = _token;
        slotPrice    = _price;
        emit PaymentTokenChanged(_token, _price);
        emit SlotPriceChanged(_price);
    }

    function setDonationFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1_000, "Fee cannot exceed 10%");
        donationFeeBps = _bps;
        emit DonationFeeBpsChanged(_bps);
    }

    function setRewardToken(address _token) external onlyOwner {
        rewardToken = _token;
        emit RewardTokenChanged(_token);
    }

    function setSlotMintReward(uint256 _amount) external onlyOwner {
        slotMintReward = _amount;
        emit SlotMintRewardChanged(_amount);
    }

    function setFreeSlotCost(uint256 _cost) external onlyOwner {
        require(_cost > 0, "Cost must be > 0");
        freeSlotCost = _cost;
        emit FreeSlotCostChanged(_cost);
    }

    function setGMDayRewards(uint256[7] calldata _rewards) external onlyOwner {
        gmDayRewards = _rewards;
        emit GMDayRewardsChanged(_rewards);
    }

    function setGMFlatDailyReward(uint256 _amount) external onlyOwner {
        gmFlatDailyReward = _amount;
        emit GMFlatDailyRewardChanged(_amount);
    }

    function setGMMilestoneRewards(uint256[5] calldata _rewards) external onlyOwner {
        gmMilestoneRewards = _rewards;
        emit GMMilestoneRewardsChanged(_rewards);
    }

    function setDiscountBurnCost(uint256 _cost) external onlyOwner {
        require(_cost > 0, "Cost must be > 0");
        discountBurnCost = _cost;
        emit DiscountBurnCostChanged(_cost);
    }

    function setMaxQueueSize(uint256 _size) external onlyOwner {
        require(_size > 0, "Size must be > 0");
        maxQueueSize = _size;
        emit MaxQueueSizeChanged(_size);
    }

    function setRaffle(address _raffle) external onlyOwner {
        raffle = _raffle;
        emit RaffleChanged(_raffle);
    }

    function setMintPointReward(uint256 _amount)  external onlyOwner { mintPointReward  = _amount; }
    function setDonatePointReward(uint256 _amount) external onlyOwner { donatePointReward = _amount; }

    function setDonateBoozReward(uint256 _amount) external onlyOwner {
        donateBoozReward = _amount;
        emit DonateBoozRewardChanged(_amount);
    }

    function setPointsPerTicket(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Must be > 0");
        pointsPerTicket = _amount;
    }

    function setDiscountAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be > 0");
        require(_amount < slotPrice, "Discount must be less than slot price");
        discountAmount = _amount;
        emit DiscountAmountChanged(_amount);
    }

    function setContentTypeImage(string calldata _contentType, string calldata _imageUrl) external onlyOwner {
        contentTypeImage[_contentType] = _imageUrl;
        emit ContentTypeImageChanged(_contentType, _imageUrl);
    }

    // ── WLD / ETH oracle setters ──────────────────────────────────────────────

    function setWldToken(address _token) external onlyOwner {
        wldToken = _token;
        emit WldTokenChanged(_token);
    }

    function setWldOracle(address _oracle) external onlyOwner {
        wldOracle = _oracle;
        emit WldOracleChanged(_oracle);
    }

    function setEthOracle(address _oracle) external onlyOwner {
        ethOracle = _oracle;
        emit EthOracleChanged(_oracle);
    }

    // ── World ID admin ────────────────────────────────────────────────────────

    function setWorldId(
        address _worldId,
        string calldata _appId,
        string calldata _action
    ) external onlyOwner {
        worldId = IWorldID(_worldId);
        externalNullifierHash = abi.encodePacked(
            abi.encodePacked(_appId).hashToField(),
            _action
        ).hashToField();
        emit WorldIdChanged(_worldId);
    }

    function setRequireVerification(bool _required) external onlyOwner {
        requireVerification = _required;
    }

    function setVerifiedHuman(address wallet, bool verified) external onlyOwner {
        verifiedHumans[wallet] = verified;
    }

    function advanceCursor() external {
        while (_slotCursor < nextTokenId && slots[_slotCursor].endTime < block.timestamp) {
            _slotCursor++;
        }
    }

    // -------------------------------------------------------------------------
    // Receive ETH
    // -------------------------------------------------------------------------

    receive() external payable {}

    // -------------------------------------------------------------------------
    // Status helpers
    // -------------------------------------------------------------------------

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
        external view
        returns (uint256 tokenId, Slot memory slot, bool found)
    {
        for (uint256 i = _slotCursor; i < nextTokenId; i++) {
            Slot storage s = slots[i];
            if (block.timestamp < s.scheduledTime) break;
            if (block.timestamp <= s.endTime) return (i, s, true);
        }
        return (0, slots[0], false);
    }

    function getUpcomingSlots()
        external view
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
        external view
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
        if (offset >= count) return (new uint256[](0), new Slot[](0), total);
        uint256 available = count - offset;
        uint256 resultLen = available < limit ? available : limit;
        tokenIds = new uint256[](resultLen);
        slotData  = new Slot[](resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            uint256 srcIdx = count - 1 - offset - i;
            tokenIds[i] = pastIds[srcIdx];
            slotData[i]  = slots[pastIds[srcIdx]];
        }
    }

    function getSlotsByCreator(address creator)
        external view
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
    // Token URI — on-chain JSON metadata
    // -------------------------------------------------------------------------

    function _uintToStr(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v; uint256 digits;
        while (tmp != 0) { digits++; tmp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { buf[--digits] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < nextTokenId, "Token does not exist");
        Slot storage s = slots[tokenId];
        string memory image = bytes(contentTypeImage[s.contentType]).length > 0
            ? contentTypeImage[s.contentType]
            : s.imageUrl;
        return string(abi.encodePacked(
            'data:application/json,',
            '{"name":"Booztory Spotlight #', _uintToStr(tokenId), '",',
            '"description":"Every spotlight is a moment. Yours, forever on-chain.",',
            '"image":"', image, '",',
            '"external_url":"https://booztory.com",',
            '"attributes":[',
            '{"trait_type":"Content Type","value":"', s.contentType, '"}',
            ']}'
        ));
    }
}
