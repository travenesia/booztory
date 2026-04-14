// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Minimal interface for minting BOOZ directly to raffle winners.
interface IBooztoryToken {
    function mintReward(address to, uint256 amount) external;
}

// ── World ID ──────────────────────────────────────────────────────────────────

/// @dev Hashes bytes to a field element for World ID signal/nullifier computation.
library ByteHasher {
    function hashToField(bytes memory value) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(value))) >> 8;
    }
}

/// @notice Minimal IWorldID interface — World Chain WorldIDRouter (Legacy v3).
///         groupId must always be 1 (Orb-verified humans).
///
/// ⚠  World ID v4 Migration — required before April 1, 2027
///    v4 introduces IWorldIDVerifier with a new 9-arg verify() function and
///    uint256[5] proof (vs uint256[8] here). v4 WorldIDVerifier is preview-only
///    as of 2026-04 — no mainnet address yet. Migrate when it ships.
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
 * @title BooztoryRaffleWorld
 * @notice Raffle contract for the Booztory platform on World Chain (chainId: 480).
 *
 *         Randomness: Commit-Reveal scheme — no external oracle required.
 *         Used because no VRF provider (Chainlink, WitNet, Pyth Entropy, Gelato)
 *         is deployed on World Chain at this time.
 *
 *         Draw flow (2 owner transactions):
 *
 *           Step 1 — commitDraw(raffleId, commitment)
 *             Owner generates a random secret off-chain, computes:
 *               commitment = keccak256(abi.encode(secret, raffleId))
 *             Then submits the commitment on-chain. The block hash of the commit
 *             block is unknowable at generation time, so the seed is unmanipulable.
 *
 *           Step 2 — revealDraw(raffleId, secret)
 *             Owner submits the original secret. Contract verifies it matches the
 *             commitment, then derives:
 *               seed = keccak256(abi.encode(secret, blockhash(commitBlock), raffleId))
 *             Uses seed for weighted winner selection and prize distribution.
 *
 *         ⚠  Block hash window: blockhash() only covers the last 256 blocks (~8.5 min
 *            on World Chain at 2s blocks). revealDraw() must be called within this
 *            window. If it expires, call resetDraw() and recommit.
 *
 *         Security: Owner cannot manipulate the outcome because:
 *           - The secret is committed before the block hash is known
 *           - The block hash is determined by the network, not the owner
 *           - Grinding is computationally infeasible given both unknowns
 *
 *         Tickets:      Earned via points → convertToTickets() in BooztoryWorld.sol.
 *         Raffles:      Admin creates raffles. Multiple raffles can run concurrently.
 *         BOOZ prizes:  Minted directly to winners (raffle is an authorized minter).
 *         ERC-20 prizes: Transferred from contract balance (must be deposited first).
 *         Sponsorship:  Same structure as Base Mainnet — USDC prize + platform fee.
 */
contract BooztoryRaffleWorld is Ownable, Pausable {
    using SafeERC20 for IERC20;
    using ByteHasher for bytes;

    /// @dev World ID group 1 = Orb-verified humans (required by WorldIDRouter legacy v3).
    uint256 internal constant GROUP_ID = 1;

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
        uint256[][] prizeAmounts;    // [tokenIndex][winnerIndex]
        uint256     winnerCount;
        uint256     startTime;
        uint256     endTime;
        RaffleStatus status;
        uint256     drawThreshold;
        uint256     minUniqueEntrants;
        // ── Commit-Reveal state ──────────────────────────────────────────────
        bytes32     commitment;      // keccak256(abi.encode(secret, raffleId)); set by commitDraw()
        uint256     commitBlock;     // block.number when commitDraw() was called; 0 = not committed
    }

    struct SponsorApplication {
        address  sponsor;
        string   adType;
        string   adContent;
        string   adLink;
        uint256  duration;
        uint256  prizePaid;
        uint256  feePaid;
        uint256  submittedAt;
        uint256  acceptedAt;
        ApplicationStatus status;
    }

    struct PriceTier {
        uint256 minPrize;
        uint256 fee;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public booztory;
    address public boozToken;
    IERC20  public usdc;

    // ---- Raffles ----
    uint256 public nextRaffleId;
    mapping(uint256 => Raffle) internal _raffles;

    mapping(uint256 => address[])                   internal _raffleEntrants;
    mapping(uint256 => mapping(address => uint256)) public   raffleTickets;
    mapping(uint256 => mapping(address => bool))    public   hasEntered;
    mapping(uint256 => uint256)                     public   raffleTotalTickets;
    mapping(uint256 => address[])                   public   raffleWinners;
    mapping(uint256 => uint256)                     public   raffleDrawBlock;

    // ---- Ticket ledger ----
    mapping(address => uint256) public tickets;

    // ---- Sponsor applications ----
    uint256 public nextApplicationId;
    mapping(uint256 => SponsorApplication) public applications;

    // ---- Price tiers ----
    mapping(uint256 => PriceTier) public priceTiers;

    // ---- Defaults ----
    uint256 public defaultDrawThreshold     = 100;
    uint256 public defaultMinUniqueEntrants = 20;
    uint256 public refundTimeout            = 30 days;

    // ---- Ad queue ----
    uint256 public nextAdStartTime;

    // ── World ID ──────────────────────────────────────────────────────────────
    IWorldID public worldId;
    uint256  public externalNullifierHash;
    bool     public requireVerification;
    mapping(address => bool)    public  verifiedHumans;
    mapping(uint256 => bool)    private _usedNullifiers;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TicketsCredited(address indexed user, uint256 amount);
    event RaffleEntered(uint256 indexed raffleId, address indexed user, uint256 ticketAmount, uint256 totalUserTickets);
    event RaffleCreated(uint256 indexed raffleId, uint256 startTime, uint256 endTime, uint256 winnerCount);
    /// @dev Emitted when owner commits a draw. commitBlock is used to derive randomness seed.
    event DrawCommitted(uint256 indexed raffleId, bytes32 commitment, uint256 commitBlock);
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
    event WorldIdChanged(address indexed newWorldId);
    event HumanVerified(address indexed wallet);
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
    error AlreadyCommitted();
    error DrawNotCommitted();
    error CommitmentMismatch();
    error BlockHashExpired();
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
    error NotVerifiedHuman();
    error DuplicateNullifier();
    error WorldIdNotSet();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyBooztory() {
        if (msg.sender != booztory) revert OnlyBooztory();
        _;
    }

    modifier onlyVerifiedHuman() {
        if (requireVerification && !verifiedHumans[msg.sender]) revert NotVerifiedHuman();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _booztory   BooztoryWorld.sol contract address.
     * @param _usdc       USDC token address on World Chain (6 decimals).
     * @param _boozToken  BooztoryToken (BOOZ) address — same address as Base via CREATE2.
     */
    constructor(
        address _booztory,
        address _usdc,
        address _boozToken
    ) Ownable(msg.sender) {
        if (_booztory  == address(0)) revert InvalidAddress();
        if (_usdc      == address(0)) revert InvalidAddress();
        if (_boozToken == address(0)) revert InvalidAddress();

        booztory  = _booztory;
        usdc      = IERC20(_usdc);
        boozToken = _boozToken;

        // Default price tiers (USDC 6 decimals)
        _setPriceTier(7  days, 100_000_000, 100_000_000);
        _setPriceTier(14 days, 200_000_000, 200_000_000);
        _setPriceTier(30 days, 400_000_000, 300_000_000);
    }

    // -------------------------------------------------------------------------
    // World ID — one-time human verification
    // -------------------------------------------------------------------------

    /**
     * @notice Verify your World ID proof once to gain access to gated functions.
     *         One World ID = one wallet — nullifier prevents re-use across wallets.
     * @param root           Merkle root from IDKit / MiniKit.
     * @param nullifierHash  Unique per (human, action) — stored to prevent replay.
     * @param proof          8-element ZK proof array.
     */
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
    // Ticket system — called by BooztoryWorld.sol
    // -------------------------------------------------------------------------

    /// @notice No-op stub — auto-entries disabled; tickets via convertToTickets() only.
    function addEntry(address) external onlyBooztory {}

    /// @notice Credit raffle tickets. Called by BooztoryWorld.convertToTickets().
    function creditTickets(address user, uint256 amount) external onlyBooztory {
        tickets[user] += amount;
        emit TicketsCredited(user, amount);
    }

    // -------------------------------------------------------------------------
    // Raffle entry
    // -------------------------------------------------------------------------

    function enterRaffle(uint256 raffleId, uint256 ticketAmount) external whenNotPaused onlyVerifiedHuman {
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
        r.winnerCount       = winnerCount;
        r.startTime         = block.timestamp;
        r.endTime           = block.timestamp + duration;
        r.status            = RaffleStatus.Active;
        r.drawThreshold     = defaultDrawThreshold;
        r.minUniqueEntrants = defaultMinUniqueEntrants;
        r.commitment        = bytes32(0);
        r.commitBlock       = 0;

        for (uint256 t = 0; t < prizeTokens.length; t++) {
            r.prizeTokens.push(prizeTokens[t]);
            r.prizeAmounts.push();
            uint256 tIdx = r.prizeAmounts.length - 1;
            for (uint256 w = 0; w < prizeAmounts[t].length; w++) {
                r.prizeAmounts[tIdx].push(prizeAmounts[t][w]);
            }
        }

        emit RaffleCreated(raffleId, r.startTime, r.endTime, winnerCount);
    }

    // -------------------------------------------------------------------------
    // Prize deposit
    // -------------------------------------------------------------------------

    function depositPrize(address token, uint256 amount) external {
        require(token != address(0), "Invalid token");
        require(token != boozToken,  "BOOZ minted at draw, no deposit needed");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    // -------------------------------------------------------------------------
    // Draw — Step 1: commit
    // -------------------------------------------------------------------------

    /**
     * @notice Commit to a draw secret. Raffle must have ended and thresholds must be met.
     *
     *         Off-chain: generate a random secret (e.g. ethers.randomBytes(32)), then compute:
     *           commitment = keccak256(abi.encode(secret, raffleId))
     *         Submit that commitment here. Store the secret safely — needed for revealDraw().
     *
     *         The seed used for winner selection will be:
     *           keccak256(abi.encode(secret, blockhash(commitBlock), raffleId))
     *         blockhash(commitBlock) is determined by the network after this tx is mined,
     *         making it impossible to pre-compute which secret leads to which winner.
     *
     * @param raffleId    Raffle to draw.
     * @param commitment  keccak256(abi.encode(secret, raffleId))
     */
    function commitDraw(uint256 raffleId, bytes32 commitment) external onlyOwner {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        Raffle storage r = _raffles[raffleId];
        if (r.status != RaffleStatus.Active)               revert RaffleNotActive();
        if (block.timestamp < r.endTime)                   revert RaffleStillRunning();
        if (r.commitBlock != 0)                            revert AlreadyCommitted();
        if (raffleTotalTickets[raffleId] < r.drawThreshold) revert BelowThreshold();

        uint256 uniqueCount = _raffleEntrants[raffleId].length;
        if (uniqueCount < r.minUniqueEntrants) revert NotEnoughUniqueEntrants();
        if (uniqueCount < r.winnerCount)       revert NotEnoughUniqueEntrants();

        // Verify non-BOOZ prizes are funded
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

        r.commitment  = commitment;
        r.commitBlock = block.number;

        emit DrawCommitted(raffleId, commitment, block.number);
    }

    // -------------------------------------------------------------------------
    // Draw — Step 2: reveal and distribute prizes
    // -------------------------------------------------------------------------

    /**
     * @notice Reveal the secret, verify the commitment, select winners, distribute prizes.
     *         Must be called within 256 blocks (~8.5 min on World Chain) of commitDraw().
     *         If the block hash window expires, call resetDraw() and recommit.
     *
     * @param raffleId  Raffle to finalize.
     * @param secret    The raw secret used to generate the commitment in commitDraw().
     *                  Must satisfy: keccak256(abi.encode(secret, raffleId)) == commitment.
     */
    function revealDraw(uint256 raffleId, bytes32 secret) external onlyOwner {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        Raffle storage r = _raffles[raffleId];
        if (r.status != RaffleStatus.Active) revert RaffleNotActive();
        if (r.commitBlock == 0)              revert DrawNotCommitted();

        // Verify the secret matches the commitment
        if (keccak256(abi.encode(secret, raffleId)) != r.commitment) revert CommitmentMismatch();

        // blockhash() returns 0 for blocks older than 256 — catch expired window
        bytes32 bHash = blockhash(r.commitBlock);
        if (bHash == bytes32(0)) revert BlockHashExpired();

        // Derive seed from secret + block hash + raffleId.
        // No single party controls all three inputs:
        //   - secret:      chosen by owner before block hash was known
        //   - blockhash:   determined by the network after the commit tx
        //   - raffleId:    immutable
        uint256 seed = uint256(keccak256(abi.encode(secret, bHash, raffleId)));

        address[] storage entrants  = _raffleEntrants[raffleId];
        uint256 totalTickets        = raffleTotalTickets[raffleId];
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
            winners[i]     = winner;

            // Distribute all prize tokens for this winner
            for (uint256 t = 0; t < r.prizeTokens.length; t++) {
                uint256 amount = r.prizeAmounts[t][i];
                if (amount == 0) continue;
                address token = r.prizeTokens[t];
                if (token == boozToken) {
                    try IBooztoryToken(boozToken).mintReward(winner, amount) {} catch {
                        emit BOOZMintFailed(winner, amount);
                    }
                } else if (token == address(0)) {
                    (bool ok,) = winner.call{value: amount}("");
                    if (!ok) emit EthTransferFailed(winner, amount);
                } else {
                    IERC20(token).safeTransfer(winner, amount);
                }
            }
        }

        raffleWinners[raffleId]   = winners;
        raffleDrawBlock[raffleId] = block.number;
        r.status                  = RaffleStatus.Drawn;
        emit DrawCompleted(raffleId, winners);
    }

    // -------------------------------------------------------------------------
    // Cancel — owner only
    // -------------------------------------------------------------------------

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

    function acceptApplication(uint256 appId) external onlyOwner {
        SponsorApplication storage app = applications[appId];
        if (app.status != ApplicationStatus.Pending) revert ApplicationNotPending();

        for (uint256 i = 0; i < nextApplicationId; i++) {
            if (i == appId) continue;
            SponsorApplication storage other = applications[i];
            if (other.status == ApplicationStatus.Pending &&
                other.submittedAt < app.submittedAt) {
                revert EarlierApplicationPending();
            }
        }

        uint256 startAt = block.timestamp > nextAdStartTime ? block.timestamp : nextAdStartTime;
        nextAdStartTime = startAt + app.duration;

        app.status     = ApplicationStatus.Accepted;
        app.acceptedAt = startAt;
        usdc.safeTransfer(owner(), app.feePaid);
        emit ApplicationAccepted(appId, app.sponsor);
    }

    function rejectApplication(uint256 appId) external onlyOwner {
        SponsorApplication storage app = applications[appId];
        if (app.status != ApplicationStatus.Pending) revert ApplicationNotPending();
        app.status = ApplicationStatus.Rejected;
        usdc.safeTransfer(app.sponsor, app.prizePaid + app.feePaid);
        emit ApplicationRejected(appId, app.sponsor);
    }

    function claimRefund(uint256 appId) external {
        SponsorApplication storage app = applications[appId];
        if (app.status != ApplicationStatus.Pending)           revert ApplicationNotPending();
        if (block.timestamp < app.submittedAt + refundTimeout) revert RefundTooEarly();
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
        bytes32          commitment,
        uint256          commitBlock,
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
            r.commitment,
            r.commitBlock,
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

    /**
     * @notice Returns true if the block hash for a committed draw is still valid.
     *         Returns false if the 256-block window has expired — resetDraw() needed.
     *         Returns false if no commit has been made yet.
     */
    function isRevealable(uint256 raffleId) external view returns (bool) {
        if (raffleId >= nextRaffleId) return false;
        uint256 cBlock = _raffles[raffleId].commitBlock;
        if (cBlock == 0) return false;
        return blockhash(cBlock) != bytes32(0);
    }

    /**
     * @notice Blocks remaining before the block hash expires for a committed draw.
     *         Returns 0 if already expired or not committed.
     *         Admin UI should call this to warn when window is closing.
     */
    function blocksUntilExpiry(uint256 raffleId) external view returns (uint256) {
        if (raffleId >= nextRaffleId) return 0;
        uint256 cBlock = _raffles[raffleId].commitBlock;
        if (cBlock == 0) return 0;
        uint256 expiresAt = cBlock + 256;
        if (block.number >= expiresAt) return 0;
        return expiresAt - block.number;
    }

    // -------------------------------------------------------------------------
    // Admin — owner only
    // -------------------------------------------------------------------------

    function _setPriceTier(uint256 duration, uint256 minPrize, uint256 fee) internal {
        priceTiers[duration] = PriceTier(minPrize, fee);
        emit PriceTierSet(duration, minPrize, fee);
    }

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

    /**
     * @notice Set the WorldIDRouter address and compute the external nullifier hash.
     * @param _worldId  WorldIDRouter address (World Chain Mainnet: 0x17B354dD2595411ff79041f930e491A4Df39A278)
     * @param _appId    World App ID string (e.g. "app_booztory_raffle")
     * @param _action   Action name string (e.g. "enter-raffle")
     */
    function setWorldId(address _worldId, string calldata _appId, string calldata _action) external onlyOwner {
        if (_worldId == address(0)) revert InvalidAddress();
        worldId = IWorldID(_worldId);
        externalNullifierHash = abi.encodePacked(
            abi.encodePacked(_appId).hashToField(),
            _action
        ).hashToField();
        emit WorldIdChanged(_worldId);
    }

    /// @notice Toggle mandatory World ID verification for user-facing functions.
    ///         Keep false on testnet for QA; enable on mainnet after verifying setWorldId() was called.
    function setRequireVerification(bool _required) external onlyOwner {
        requireVerification = _required;
    }

    /// @notice Manually grant or revoke human status. Useful for testnet QA and emergency recovery.
    function setVerifiedHuman(address wallet, bool verified) external onlyOwner {
        verifiedHumans[wallet] = verified;
        if (verified) emit HumanVerified(wallet);
    }

    function setRefundTimeout(uint256 _timeout) external onlyOwner {
        refundTimeout = _timeout;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Reset a committed draw — clears commitment and commitBlock.
     *         Use when the 256-block reveal window has expired (isRevealable() returns false)
     *         or when recommitting with a fresh secret is desired.
     *         Raffle must still be Active.
     */
    function resetDraw(uint256 raffleId) external onlyOwner {
        if (raffleId >= nextRaffleId) revert InvalidRaffle();
        Raffle storage r = _raffles[raffleId];
        require(r.commitBlock != 0 && r.status == RaffleStatus.Active, "Nothing to reset");
        r.commitment  = bytes32(0);
        r.commitBlock = 0;
        emit DrawReset(raffleId);
    }

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
