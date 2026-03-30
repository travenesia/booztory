// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Minimal interface for minting BOOZ directly to raffle winners.
interface IBooztoryToken {
    function mintReward(address to, uint256 amount) external;
}

/**
 * @title BooztoryRaffle
 * @notice Raffle contract for the Booztory platform.
 *
 *         Tickets:  Earned via points → convertToTickets() in Booztory.sol.
 *                   Users burn tickets to enter raffles. More tickets = higher weight.
 *                   Tickets are burned on entry regardless of win or loss.
 *
 *         Raffles:  Admin creates raffles with custom prize tokens, per-winner amounts,
 *                   and duration. Multiple raffles can run concurrently.
 *                   Draw triggered by owner after endTime via Chainlink VRF.
 *
 *         BOOZ prizes:    Minted directly to winners (raffle is an authorized minter).
 *         ERC-20 prizes:  Transferred from contract balance (must be deposited first).
 *
 *         Sponsorship:    Sponsors submit applications with USDC prize + platform fee.
 *                         Owner accepts/rejects within 3 days.
 *                         If no response, sponsor can call claimRefund() trustlessly.
 *                         All ad content is stored in the SponsorApplicationSubmitted event.
 *
 *         Prize layout:   prizeAmounts[tokenIndex][winnerIndex]
 *                         e.g. prizeAmounts[0] = USDC amounts per winner
 *                              prizeAmounts[1] = BOOZ amounts per winner
 */
contract BooztoryRaffle is VRFConsumerBaseV2Plus, Pausable {
    using SafeERC20 for IERC20;

    receive() external payable {}

    // -------------------------------------------------------------------------
    // Enums
    // -------------------------------------------------------------------------

    enum RaffleStatus      { Active, Drawn, Cancelled }
    enum ApplicationStatus { Pending, Accepted, Rejected, Refunded }

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Raffle {
        address[]   prizeTokens;
        uint256[][] prizeAmounts;   // [tokenIndex][winnerIndex]
        uint256     winnerCount;
        uint256     startTime;
        uint256     endTime;
        RaffleStatus status;
        uint256     drawThreshold;
        uint256     minUniqueEntrants;
        bool        drawRequested;  // true once VRF requested; reset on timeout
    }

    struct SponsorApplication {
        address  sponsor;
        string   adType;      // "image" | "embed" | "text"
        string   adContent;   // URL or text (max 200 chars)
        string   adLink;      // sponsor destination URL
        uint256  duration;    // seconds — must match a price tier
        uint256  prizePaid;   // USDC locked as prize
        uint256  feePaid;     // USDC platform fee
        uint256  submittedAt;
        uint256  acceptedAt;
        ApplicationStatus status;
    }

    struct PriceTier {
        uint256 minPrize;   // minimum prize in USDC (6 decimals)
        uint256 fee;        // platform fee in USDC (6 decimals)
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public booztory;
    address public boozToken;
    IERC20  public usdc;

    // ---- VRF config ----
    uint256 public subscriptionId;
    bytes32 public keyHash;
    uint32  public callbackGasLimit    = 2_500_000;
    uint16  public requestConfirmations = 3;

    // ---- Raffles ----
    uint256 public nextRaffleId;
    mapping(uint256 => Raffle) internal _raffles;

    // Per-raffle entry tracking
    mapping(uint256 => address[])                   internal _raffleEntrants;
    mapping(uint256 => mapping(address => uint256)) public   raffleTickets;       // tickets per user per raffle
    mapping(uint256 => mapping(address => bool))    public   hasEntered;
    mapping(uint256 => uint256)                     public   raffleTotalTickets;
    mapping(uint256 => address[])                   public   raffleWinners;
    mapping(uint256 => uint256)                     public   raffleDrawBlock;

    // VRF request tracking
    mapping(uint256 => uint256) internal _requestToRaffle;
    mapping(uint256 => uint256) internal _activeRequestId;

    // ---- Ticket ledger ----
    mapping(address => uint256) public tickets;

    // ---- Sponsor applications ----
    uint256 public nextApplicationId;
    mapping(uint256 => SponsorApplication) public applications;

    // ---- Price tiers (duration in seconds → PriceTier) ----
    mapping(uint256 => PriceTier) public priceTiers;

    // ---- Defaults ----
    uint256 public defaultDrawThreshold    = 100;
    uint256 public defaultMinUniqueEntrants = 20;
    uint256 public refundTimeout            = 30 days;

    // ---- Ad queue ----
    // Tracks when the last accepted ad slot ends so new acceptances chain automatically.
    uint256 public nextAdStartTime;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TicketsCredited(address indexed user, uint256 amount);
    event RaffleEntered(uint256 indexed raffleId, address indexed user, uint256 ticketAmount, uint256 totalUserTickets);
    event RaffleCreated(uint256 indexed raffleId, uint256 startTime, uint256 endTime, uint256 winnerCount);
    event DrawRequested(uint256 indexed raffleId, uint256 requestId);
    event DrawCompleted(uint256 indexed raffleId, address[] winners);
    event RaffleCancelled(uint256 indexed raffleId);
    event DrawReset(uint256 indexed raffleId);
    event SponsorApplicationSubmitted(
        uint256 indexed id,
        address indexed sponsor,
        string adType,
        string adContent,
        string adLink,
        uint256 duration,
        uint256 timestamp
    );
    event ApplicationAccepted(uint256 indexed id, address indexed sponsor);
    event ApplicationRejected(uint256 indexed id, address indexed sponsor);
    event ApplicationRefunded(uint256 indexed id, address indexed sponsor);
    event PriceTierSet(uint256 duration, uint256 minPrize, uint256 fee);
    event BooztoryChanged(address indexed newBooztory);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event EthTransferFailed(address indexed winner, uint256 amount);
    event BOOZMintFailed(address indexed winner, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error OnlyBooztory();
    error InvalidAddress();
    error InvalidRaffle();
    error RaffleNotActive();
    error RaffleStillRunning();
    error AlreadyDrawRequested();
    error BelowThreshold();
    error NotEnoughUniqueEntrants();
    error InsufficientPrizeFunds();
    error InsufficientTickets();
    error ApplicationNotPending();
    error RefundTooEarly();
    error EarlierApplicationPending();
    error InvalidDuration();
    error PriceTierNotFound();
    error NothingToWithdraw();
    error ArrayLengthMismatch();
    error NoWinners();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyBooztory() {
        if (msg.sender != booztory) revert OnlyBooztory();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _vrfCoordinator  Chainlink VRF coordinator address.
     * @param _booztory        Booztory.sol contract address.
     * @param _usdc            USDC token address (6 decimals).
     * @param _boozToken       BooztoryToken (BOOZ) address.
     * @param _subscriptionId  Chainlink VRF subscription ID.
     * @param _keyHash         Chainlink VRF key hash (gas lane).
     */
    constructor(
        address _vrfCoordinator,
        address _booztory,
        address _usdc,
        address _boozToken,
        uint256 _subscriptionId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        if (_booztory  == address(0)) revert InvalidAddress();
        if (_usdc      == address(0)) revert InvalidAddress();
        if (_boozToken == address(0)) revert InvalidAddress();
        booztory  = _booztory;
        usdc      = IERC20(_usdc);
        boozToken = _boozToken;
        subscriptionId = _subscriptionId;
        keyHash        = _keyHash;

        // Default price tiers (USDC 6 decimals)
        _setPriceTier(7  days, 100_000_000, 100_000_000); // 100 USDC prize + 100 fee = 200 total
        _setPriceTier(14 days, 200_000_000, 200_000_000); // 200 USDC prize + 200 fee = 400 total
        _setPriceTier(30 days, 400_000_000, 300_000_000); // 400 USDC prize + 300 fee = 700 total
    }

    // -------------------------------------------------------------------------
    // Ticket system — called by Booztory.sol
    // -------------------------------------------------------------------------

    /**
     * @notice No-op stub — Booztory.mintSlot() calls this but auto-entries are disabled.
     *         Tickets are earned only by converting points via Booztory.convertToTickets().
     */
    function addEntry(address) external onlyBooztory {}

    /**
     * @notice Credit raffle tickets to a user.
     *         Called by Booztory.convertToTickets() after burning points.
     */
    function creditTickets(address user, uint256 amount) external onlyBooztory {
        tickets[user] += amount;
        emit TicketsCredited(user, amount);
    }

    // -------------------------------------------------------------------------
    // Raffle entry — called by users
    // -------------------------------------------------------------------------

    /**
     * @notice Enter a raffle by committing tickets.
     *         Tickets are burned immediately on entry (win or lose).
     *         More tickets committed = higher weight in draw.
     * @param raffleId     Raffle to enter.
     * @param ticketAmount Number of tickets to commit.
     */
    function enterRaffle(uint256 raffleId, uint256 ticketAmount) external whenNotPaused {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        Raffle storage r = _raffles[raffleId];
        if (r.status != RaffleStatus.Active) revert RaffleNotActive();
        if (block.timestamp >= r.endTime)    revert RaffleNotActive();
        if (ticketAmount == 0 || tickets[msg.sender] < ticketAmount) revert InsufficientTickets();

        tickets[msg.sender]                 -= ticketAmount;
        raffleTickets[raffleId][msg.sender] += ticketAmount;
        raffleTotalTickets[raffleId]        += ticketAmount;

        if (!hasEntered[raffleId][msg.sender]) {
            hasEntered[raffleId][msg.sender] = true;
            _raffleEntrants[raffleId].push(msg.sender);
        }

        emit RaffleEntered(raffleId, msg.sender, ticketAmount, raffleTickets[raffleId][msg.sender]);
    }

    // -------------------------------------------------------------------------
    // Raffle creation — owner only
    // -------------------------------------------------------------------------

    /**
     * @notice Create a new raffle. Multiple raffles can run concurrently.
     * @param prizeTokens   Token addresses. Use boozToken for BOOZ (minted at draw);
     *                      any other ERC-20 must be deposited via depositPrize() before draw.
     * @param prizeAmounts  [tokenIndex][winnerIndex] — per-winner amounts per token.
     *                      Length must equal prizeTokens.length.
     *                      Each inner array length must equal winnerCount.
     *                      Example: 2 tokens, 5 winners →
     *                        prizeAmounts[0] = [50e6, 30e6, 20e6, 0, 0]   ← USDC per winner
     *                        prizeAmounts[1] = [40000e18, 30000e18, ...]   ← BOOZ per winner
     * @param winnerCount   Number of winners to select.
     * @param duration      Raffle duration in seconds.
     */
    function createRaffle(
        address[]   calldata prizeTokens,
        uint256[][] calldata prizeAmounts,
        uint256 winnerCount,
        uint256 duration
    ) external onlyOwner {
        if (winnerCount == 0)                          revert NoWinners();
        if (prizeTokens.length == 0)                   revert NoWinners();
        if (prizeAmounts.length != prizeTokens.length) revert ArrayLengthMismatch();
        for (uint256 t = 0; t < prizeAmounts.length; t++) {
            if (prizeAmounts[t].length != winnerCount) revert ArrayLengthMismatch();
        }
        if (duration == 0) revert InvalidDuration();

        uint256 raffleId = nextRaffleId++;
        Raffle storage r = _raffles[raffleId];
        r.winnerCount        = winnerCount;
        r.startTime          = block.timestamp;
        r.endTime            = block.timestamp + duration;
        r.status             = RaffleStatus.Active;
        r.drawThreshold      = defaultDrawThreshold;
        r.minUniqueEntrants  = defaultMinUniqueEntrants;
        r.drawRequested      = false;

        for (uint256 t = 0; t < prizeTokens.length; t++) {
            r.prizeTokens.push(prizeTokens[t]);
            // Copy calldata inner array into storage manually
            r.prizeAmounts.push();
            uint256 tIdx = r.prizeAmounts.length - 1;
            for (uint256 w = 0; w < prizeAmounts[t].length; w++) {
                r.prizeAmounts[tIdx].push(prizeAmounts[t][w]);
            }
        }

        emit RaffleCreated(raffleId, r.startTime, r.endTime, winnerCount);
    }

    // -------------------------------------------------------------------------
    // Prize deposit — anyone (sponsor, owner)
    // -------------------------------------------------------------------------

    /**
     * @notice Deposit ERC-20 prize tokens into this contract.
     *         Not needed for BOOZ prizes — those are minted at draw time.
     * @param token   ERC-20 address. Cannot be boozToken.
     * @param amount  Amount in token's decimals.
     */
    function depositPrize(address token, uint256 amount) external {
        require(token != address(0), "Invalid token");
        require(token != boozToken,  "BOOZ minted at draw, no deposit needed");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    // -------------------------------------------------------------------------
    // Draw trigger — owner only
    // -------------------------------------------------------------------------

    /**
     * @notice Request a draw via Chainlink VRF. Raffle must have ended, thresholds met,
     *         and all non-BOOZ prizes funded.
     */
    function triggerDraw(uint256 raffleId) external onlyOwner {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        Raffle storage r = _raffles[raffleId];
        if (r.status != RaffleStatus.Active)              revert RaffleNotActive();
        if (block.timestamp < r.endTime)                  revert RaffleStillRunning();
        if (r.drawRequested)                              revert AlreadyDrawRequested();
        if (raffleTotalTickets[raffleId] < r.drawThreshold) revert BelowThreshold();
        uint256 uniqueCount = _raffleEntrants[raffleId].length;
        if (uniqueCount < r.minUniqueEntrants)            revert NotEnoughUniqueEntrants();
        if (uniqueCount < r.winnerCount)                  revert NotEnoughUniqueEntrants();

        // Verify prizes are funded (BOOZ is minted at draw, skip)
        for (uint256 t = 0; t < r.prizeTokens.length; t++) {
            address token = r.prizeTokens[t];
            if (token == boozToken) continue;
            uint256 needed = 0;
            for (uint256 w = 0; w < r.winnerCount; w++) needed += r.prizeAmounts[t][w];
            if (token == address(0)) {
                if (address(this).balance < needed) revert InsufficientPrizeFunds();
            } else {
                if (IERC20(token).balanceOf(address(this)) < needed) revert InsufficientPrizeFunds();
            }
        }

        r.drawRequested = true;

        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash:              keyHash,
                subId:                subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit:     callbackGasLimit,
                numWords:             1,
                extraArgs:            VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: false })
                )
            })
        );

        _requestToRaffle[requestId] = raffleId;
        _activeRequestId[raffleId]  = requestId;
        emit DrawRequested(raffleId, requestId);
    }

    /**
     * @dev Chainlink VRF callback. Selects winners weighted by ticket count.
     *      Duplicate wallets are re-rolled by incrementing the nonce.
     *      Prizes distributed immediately on fulfillment.
     *
     *      Gas note: callbackGasLimit = 2,500,000. Supports ~500 unique entrants
     *      and up to 10 winners comfortably. Owner can increase limit if needed.
     */
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 raffleId = _requestToRaffle[requestId];
        // Ignore stale callbacks from superseded requests
        if (_activeRequestId[raffleId] != requestId) return;

        Raffle storage r            = _raffles[raffleId];
        address[] storage entrants  = _raffleEntrants[raffleId];
        uint256 totalTickets        = raffleTotalTickets[raffleId];
        uint256 seed                = randomWords[0];
        uint256 winnerCount         = r.winnerCount;
        uint256 entrantCount        = entrants.length;

        address[] memory winners = new address[](winnerCount);
        bool[]    memory won     = new bool[](entrantCount);

        for (uint256 i = 0; i < winnerCount; i++) {
            uint256 nonce    = i;
            uint256 winnerIdx;

            // Weighted selection: pick target ticket, walk cumulative sum to find owner
            while (true) {
                uint256 target     = uint256(keccak256(abi.encodePacked(seed, nonce))) % totalTickets;
                uint256 cumulative = 0;
                for (uint256 j = 0; j < entrantCount; j++) {
                    cumulative += raffleTickets[raffleId][entrants[j]];
                    if (target < cumulative) {
                        winnerIdx = j;
                        break;
                    }
                }
                if (!won[winnerIdx]) {
                    won[winnerIdx] = true;
                    break;
                }
                nonce++;
            }

            address winner = entrants[winnerIdx];
            winners[i] = winner;

            // Distribute all prize tokens for this winner
            for (uint256 t = 0; t < r.prizeTokens.length; t++) {
                uint256 amount = r.prizeAmounts[t][i];
                if (amount == 0) continue;
                address token = r.prizeTokens[t];
                if (token == boozToken) {
                    // Mint BOOZ directly — raffle is an authorized minter
                    try IBooztoryToken(boozToken).mintReward(winner, amount) {} catch {
                        emit BOOZMintFailed(winner, amount);
                    }
                } else if (token == address(0)) {
                    // Native ETH — use call so a reverting winner doesn't block others
                    (bool ok,) = winner.call{value: amount}("");
                    if (!ok) emit EthTransferFailed(winner, amount);
                } else {
                    IERC20(token).safeTransfer(winner, amount);
                }
            }
        }

        raffleWinners[raffleId]  = winners;
        raffleDrawBlock[raffleId] = block.number;
        r.status                  = RaffleStatus.Drawn;
        emit DrawCompleted(raffleId, winners);
    }

    // -------------------------------------------------------------------------
    // Cancel — owner only
    // -------------------------------------------------------------------------

    /**
     * @notice Cancel an active raffle (e.g. threshold not met after duration ends).
     *         Any deposited ERC-20 prizes can be recovered via withdraw().
     */
    function cancelRaffle(uint256 raffleId) external onlyOwner {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        Raffle storage r = _raffles[raffleId];
        if (r.status != RaffleStatus.Active) revert RaffleNotActive();
        r.status = RaffleStatus.Cancelled;
        emit RaffleCancelled(raffleId);
    }

    // -------------------------------------------------------------------------
    // Sponsor applications
    // -------------------------------------------------------------------------

    /**
     * @notice Submit a sponsorship application.
     *         Transfers (minPrize + fee) USDC from sponsor to this contract.
     *         Ad content is emitted in SponsorApplicationSubmitted — not stored on-chain.
     * @param adType     "image" | "embed" | "text"
     * @param adContent  Image/embed URL or text (max 200 chars)
     * @param adLink     Sponsor destination (Discord, X, Telegram, Website)
     * @param duration   Must match a configured price tier (7/14/30 days in seconds)
     */
    function submitApplication(
        string calldata adType,
        string calldata adContent,
        string calldata adLink,
        uint256 duration
    ) external whenNotPaused {
        PriceTier memory tier = priceTiers[duration];
        if (tier.minPrize == 0) revert PriceTierNotFound();
        uint256 total = tier.minPrize + tier.fee;
        usdc.safeTransferFrom(msg.sender, address(this), total);

        uint256 appId = nextApplicationId++;
        SponsorApplication storage app = applications[appId];
        app.sponsor     = msg.sender;
        app.adType      = adType;
        app.adContent   = adContent;
        app.adLink      = adLink;
        app.duration    = duration;
        app.prizePaid   = tier.minPrize;
        app.feePaid     = tier.fee;
        app.submittedAt = block.timestamp;
        app.status      = ApplicationStatus.Pending;

        emit SponsorApplicationSubmitted(appId, msg.sender, adType, adContent, adLink, duration, block.timestamp);
    }

    /**
     * @notice Accept a sponsor application.
     *         Enforces first-submitted-first-served queue order — reverts if any
     *         earlier-submitted application is still pending.
     *         Sets acceptedAt to max(now, nextAdStartTime) so ads chain automatically
     *         without overlap. Updates nextAdStartTime for the next acceptance.
     *         Transfers platform fee to owner. Prize stays in contract, locked for raffle.
     *         Owner then creates the raffle separately via createRaffle().
     */
    function acceptApplication(uint256 appId) external onlyOwner {
        SponsorApplication storage app = applications[appId];
        if (app.status != ApplicationStatus.Pending) revert ApplicationNotPending();

        // Enforce submission order — no skipping the queue
        for (uint256 i = 0; i < nextApplicationId; i++) {
            if (i == appId) continue;
            SponsorApplication storage other = applications[i];
            if (other.status == ApplicationStatus.Pending &&
                other.submittedAt < app.submittedAt) {
                revert EarlierApplicationPending();
            }
        }

        // Queue: start after the last accepted ad ends, or now if slot is free
        uint256 startAt = block.timestamp > nextAdStartTime ? block.timestamp : nextAdStartTime;
        nextAdStartTime = startAt + app.duration;

        app.status     = ApplicationStatus.Accepted;
        app.acceptedAt = startAt;
        usdc.safeTransfer(owner(), app.feePaid);
        emit ApplicationAccepted(appId, app.sponsor);
    }

    /**
     * @notice Reject a sponsor application. Refunds full amount (prize + fee) to sponsor.
     */
    function rejectApplication(uint256 appId) external onlyOwner {
        SponsorApplication storage app = applications[appId];
        if (app.status != ApplicationStatus.Pending) revert ApplicationNotPending();
        app.status = ApplicationStatus.Rejected;
        usdc.safeTransfer(app.sponsor, app.prizePaid + app.feePaid);
        emit ApplicationRejected(appId, app.sponsor);
    }

    /**
     * @notice Trustless refund after refundTimeout if application is still pending.
     *         Callable by anyone — sponsor self-serves if admin is unresponsive.
     */
    function claimRefund(uint256 appId) external {
        SponsorApplication storage app = applications[appId];
        if (app.status != ApplicationStatus.Pending)             revert ApplicationNotPending();
        if (block.timestamp < app.submittedAt + refundTimeout)   revert RefundTooEarly();
        app.status = ApplicationStatus.Refunded;
        usdc.safeTransfer(app.sponsor, app.prizePaid + app.feePaid);
        emit ApplicationRefunded(appId, app.sponsor);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getRaffle(uint256 raffleId) external view returns (
        address[] memory prizeTokens,
        uint256          winnerCount,
        uint256          startTime,
        uint256          endTime,
        RaffleStatus     status,
        uint256          drawThreshold,
        uint256          minUniqueEntrants,
        bool             drawRequested,
        uint256          totalTickets,
        uint256          uniqueEntrants
    ) {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        Raffle storage r = _raffles[raffleId];
        return (
            r.prizeTokens,
            r.winnerCount,
            r.startTime,
            r.endTime,
            r.status,
            r.drawThreshold,
            r.minUniqueEntrants,
            r.drawRequested,
            raffleTotalTickets[raffleId],
            _raffleEntrants[raffleId].length
        );
    }

    function getRafflePrizeAmounts(uint256 raffleId) external view returns (uint256[][] memory) {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        return _raffles[raffleId].prizeAmounts;
    }

    function getRaffleWinners(uint256 raffleId) external view returns (address[] memory) {
        return raffleWinners[raffleId];
    }

    function getRaffleEntrants(uint256 raffleId) external view returns (address[] memory) {
        return _raffleEntrants[raffleId];
    }

    /// @notice Returns IDs of all currently active raffles.
    function getActiveRaffles() external view returns (uint256[] memory ids) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextRaffleId; i++) {
            if (_raffles[i].status == RaffleStatus.Active) count++;
        }
        ids = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextRaffleId; i++) {
            if (_raffles[i].status == RaffleStatus.Active) ids[idx++] = i;
        }
    }

    // -------------------------------------------------------------------------
    // Admin — owner only
    // -------------------------------------------------------------------------

    function _setPriceTier(uint256 duration, uint256 minPrize, uint256 fee) internal {
        priceTiers[duration] = PriceTier(minPrize, fee);
        emit PriceTierSet(duration, minPrize, fee);
    }

    /// @notice Add or update a sponsorship price tier.
    function setPriceTier(uint256 duration, uint256 minPrize, uint256 fee) external onlyOwner {
        if (duration == 0) revert InvalidDuration();
        _setPriceTier(duration, minPrize, fee);
    }

    function setDefaultDrawThreshold(uint256 _threshold) external onlyOwner {
        defaultDrawThreshold = _threshold;
    }

    function setDefaultMinUniqueEntrants(uint256 _min) external onlyOwner {
        defaultMinUniqueEntrants = _min;
    }

    /// @notice Override draw thresholds for a specific raffle after creation.
    function setRaffleThresholds(uint256 raffleId, uint256 _threshold, uint256 _minUnique) external onlyOwner {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        _raffles[raffleId].drawThreshold    = _threshold;
        _raffles[raffleId].minUniqueEntrants = _minUnique;
    }

    function setBooztory(address _booztory) external onlyOwner {
        if (_booztory == address(0)) revert InvalidAddress();
        booztory = _booztory;
        emit BooztoryChanged(_booztory);
    }

    function setRefundTimeout(uint256 _timeout) external onlyOwner {
        refundTimeout = _timeout;
    }

    /// @notice Pause user-facing actions (enterRaffle, submitApplication). Emergency use only.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume normal operations after a pause.
    function unpause() external onlyOwner {
        _unpause();
    }

    function setVrfConfig(
        uint256 _subscriptionId,
        bytes32 _keyHash,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) external onlyOwner {
        subscriptionId       = _subscriptionId;
        keyHash              = _keyHash;
        callbackGasLimit     = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
    }

    /**
     * @notice Reset draw request for a raffle where the VRF callback timed out.
     *         Only valid if drawRequested = true but raffle is still Active (not fulfilled).
     */
    function resetDraw(uint256 raffleId) external onlyOwner {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        Raffle storage r = _raffles[raffleId];
        require(r.drawRequested && r.status == RaffleStatus.Active, "Not resettable");
        r.drawRequested = false;
        emit DrawReset(raffleId);
    }

    /// @notice Withdraw ETH or any ERC-20 from this contract.
    ///         Use address(0) to withdraw native ETH.
    function withdraw(address token) external onlyOwner {
        if (token == address(0)) {
            uint256 ethBal = address(this).balance;
            if (ethBal == 0) revert NothingToWithdraw();
            (bool ok,) = owner().call{value: ethBal}("");
            require(ok, "ETH transfer failed");
            emit Withdrawn(address(0), owner(), ethBal);
            return;
        }
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert NothingToWithdraw();
        IERC20(token).safeTransfer(owner(), bal);
        emit Withdrawn(token, owner(), bal);
    }
}
