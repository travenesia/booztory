// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BooztoryRaffle
 * @notice Weekly raffle for Booztory minters, powered by Chainlink VRF v2.5.
 *
 *         Entry:      Booztory.sol calls addEntry(minter) on each paid mint.
 *                     Each mint = 1 entry; multiple mints = multiple entries.
 *         Draw:       Owner triggers requestWeeklyDraw(week) after week ends.
 *                     Requires ≥ drawThreshold entries and ≥ minUniqueMinters.
 *         Prizes:     Configurable winner count and prize amounts via setPrizes().
 *                     Auto-sent in USDC on draw completion.
 *                     One prize per wallet — duplicates are re-rolled.
 *         Funding:    Owner transfers USDC to this contract before triggering draw.
 *
 *         Ownership is provided by Chainlink's ConfirmedOwner (inherited via
 *         VRFConsumerBaseV2Plus), not OpenZeppelin Ownable.
 */
contract BooztoryRaffle is VRFConsumerBaseV2Plus {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice The Booztory.sol contract — sole address allowed to add entries.
    address public booztory;

    /// @notice USDC token used for prize payouts.
    IERC20 public usdc;

    // ---- VRF config ----

    uint256 public subscriptionId;
    bytes32 public keyHash;
    uint32  public callbackGasLimit = 500_000;
    uint16  public requestConfirmations = 3;

    // ---- Raffle config ----

    /// @notice Minimum entries required to trigger a draw.
    uint256 public drawThreshold = 100;

    /// @notice Minimum unique wallets required to trigger a draw.
    ///         Must be kept >= prizes.length to prevent infinite loop in VRF callback.
    uint256 public minUniqueMinters = 20;

    /// @notice Prize amounts in USDC (6 decimals). Array length = winner count.
    ///         Default: 10 winners, top-heavy — $25/$20/$15/$10/$5×6 = $100 USDC total.
    uint256[] public prizes;

    // ---- Weekly data ----

    /// @notice All entries for a given week (duplicates = multiple chances).
    mapping(uint256 => address[]) internal _weeklyEntries;

    /// @notice Whether an address has minted in a given week (for unique count).
    mapping(uint256 => mapping(address => bool)) public hasMinted;

    /// @notice Number of unique minters per week.
    mapping(uint256 => uint256) public weeklyUniqueCount;

    /// @notice Whether a week's draw has been triggered.
    mapping(uint256 => bool) public weekDrawn;

    /// @notice Maps VRF requestId → week number.
    mapping(uint256 => uint256) internal _requestToWeek;

    /// @notice The active (latest) VRF requestId per week. Stale requests are ignored.
    mapping(uint256 => uint256) internal _activeRequestId;

    /// @notice Winning addresses per week (set after VRF fulfillment).
    mapping(uint256 => address[]) public weeklyWinners;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event EntryAdded(uint256 indexed week, address indexed minter, uint256 totalEntries);
    event DrawRequested(uint256 indexed week, uint256 requestId);
    event DrawCompleted(uint256 indexed week, address[] winners);
    event PrizesChanged(uint256[] newPrizes);
    event DrawThresholdChanged(uint256 newThreshold);
    event MinUniqueMinterChanged(uint256 newMin);
    event VrfConfigChanged(uint256 subscriptionId, bytes32 keyHash, uint32 callbackGasLimit, uint16 requestConfirmations);
    event BooztoryChanged(address indexed newBooztory);
    event DrawReset(uint256 indexed week);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error OnlyBooztory();
    error AlreadyDrawn();
    error WeekNotEnded();
    error BelowThreshold();
    error NotEnoughUniqueMinters();
    error InsufficientPrizeFunds();
    error InvalidAddress();
    error NotDrawn();
    error NoPrizes();
    error NothingToWithdraw();
    error MinUniqueMintersTooLow();

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
     * @param _vrfCoordinator  Chainlink VRF coordinator address on Base.
     * @param _booztory        Booztory.sol contract address.
     * @param _usdc            USDC token address on Base.
     * @param _subscriptionId  Chainlink VRF subscription ID.
     * @param _keyHash         Chainlink VRF key hash (gas lane).
     */
    constructor(
        address _vrfCoordinator,
        address _booztory,
        address _usdc,
        uint256 _subscriptionId,
        bytes32 _keyHash
    )
        VRFConsumerBaseV2Plus(_vrfCoordinator)
    {
        if (_booztory == address(0)) revert InvalidAddress();
        if (_usdc == address(0)) revert InvalidAddress();
        booztory = _booztory;
        usdc = IERC20(_usdc);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;

        // Default: 10 winners, top-heavy — $25/$20/$15/$10/$5×6 = $100 USDC total
        prizes.push(25_000_000); // 1st — $25
        prizes.push(20_000_000); // 2nd — $20
        prizes.push(15_000_000); // 3rd — $15
        prizes.push(10_000_000); // 4th — $10
        prizes.push(5_000_000);  // 5th — $5
        prizes.push(5_000_000);  // 6th — $5
        prizes.push(5_000_000);  // 7th — $5
        prizes.push(5_000_000);  // 8th — $5
        prizes.push(5_000_000);  // 9th — $5
        prizes.push(5_000_000);  // 10th — $5
    }

    // -------------------------------------------------------------------------
    // Week calculation
    // -------------------------------------------------------------------------

    /// @notice Returns the current week number (UTC weeks since epoch, starts Thursday).
    function currentWeek() public view returns (uint256) {
        return block.timestamp / 1 weeks;
    }

    // -------------------------------------------------------------------------
    // Entry — called by Booztory.sol on paid mints
    // -------------------------------------------------------------------------

    /**
     * @notice Add a raffle entry for a minter. Called by Booztory.sol on each
     *         paid mint (mintSlot, mintSlotWithDiscount). One call = one entry.
     * @param minter  The address that minted a slot.
     */
    function addEntry(address minter) external onlyBooztory {
        uint256 week = currentWeek();
        _weeklyEntries[week].push(minter);

        if (!hasMinted[week][minter]) {
            hasMinted[week][minter] = true;
            weeklyUniqueCount[week]++;
        }

        emit EntryAdded(week, minter, _weeklyEntries[week].length);
    }

    // -------------------------------------------------------------------------
    // Draw — owner triggers after week ends
    // -------------------------------------------------------------------------

    /**
     * @notice Request a weekly draw via Chainlink VRF.
     *         Requires: week has ended, thresholds met, USDC funded.
     * @param week  The week number to draw for.
     */
    function requestWeeklyDraw(uint256 week) external onlyOwner {
        uint256 winnerCount = prizes.length;
        if (winnerCount == 0) revert NoPrizes();
        if (weekDrawn[week]) revert AlreadyDrawn();
        if (week >= currentWeek()) revert WeekNotEnded();
        if (_weeklyEntries[week].length < drawThreshold) revert BelowThreshold();
        // Both the business minimum and safety minimum (>= winner count) must pass
        if (weeklyUniqueCount[week] < minUniqueMinters) revert NotEnoughUniqueMinters();
        if (weeklyUniqueCount[week] < winnerCount) revert NotEnoughUniqueMinters();

        uint256 totalPrize;
        for (uint256 i = 0; i < winnerCount; i++) totalPrize += prizes[i];
        if (usdc.balanceOf(address(this)) < totalPrize) revert InsufficientPrizeFunds();

        weekDrawn[week] = true;

        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        _requestToWeek[requestId] = week;
        _activeRequestId[week] = requestId;
        emit DrawRequested(week, requestId);
    }

    /**
     * @dev Chainlink VRF callback. Derives unique winners from a single seed.
     *      Winner count = prizes.length. Each mint = 1 chance.
     *      Duplicate winners are re-rolled via linear probe.
     *      Prizes are auto-sent in USDC.
     */
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 week = _requestToWeek[requestId];
        // Ignore stale callbacks from requests superseded by resetDraw + re-trigger
        if (_activeRequestId[week] != requestId) return;
        address[] storage entries = _weeklyEntries[week];
        uint256 seed = randomWords[0];
        uint256 len = entries.length;
        uint256 winnerCount = prizes.length;

        address[] memory winners = new address[](winnerCount);

        for (uint256 i = 0; i < winnerCount; i++) {
            uint256 idx = uint256(keccak256(abi.encodePacked(seed, i))) % len;
            address candidate = entries[idx];

            // Re-roll if this address already won (one prize per wallet)
            bool duplicate = true;
            while (duplicate) {
                duplicate = false;
                for (uint256 j = 0; j < i; j++) {
                    if (winners[j] == candidate) {
                        duplicate = true;
                        idx = (idx + 1) % len;
                        candidate = entries[idx];
                        break;
                    }
                }
            }

            winners[i] = candidate;
            usdc.safeTransfer(candidate, prizes[i]);
        }

        weeklyWinners[week] = winners;
        emit DrawCompleted(week, winners);
    }

    // -------------------------------------------------------------------------
    // Emergency — reset a draw if VRF callback fails or times out
    // -------------------------------------------------------------------------

    /**
     * @notice Reset a week's draw status so it can be re-triggered.
     *         Use only if Chainlink VRF fails to deliver the callback.
     * @param week  The week number to reset.
     */
    function resetDraw(uint256 week) external onlyOwner {
        if (!weekDrawn[week]) revert NotDrawn();
        weekDrawn[week] = false;
        emit DrawReset(week);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getWeeklyEntryCount(uint256 week) external view returns (uint256) {
        return _weeklyEntries[week].length;
    }

    function getWeeklyEntries(uint256 week) external view returns (address[] memory) {
        return _weeklyEntries[week];
    }

    function getWeeklyWinners(uint256 week) external view returns (address[] memory) {
        return weeklyWinners[week];
    }

    function getPrizes() external view returns (uint256[] memory) {
        return prizes;
    }

    function getWinnerCount() external view returns (uint256) {
        return prizes.length;
    }

    // -------------------------------------------------------------------------
    // Admin — owner only (Chainlink ConfirmedOwner)
    // -------------------------------------------------------------------------

    /**
     * @notice Set prize amounts. Array length = winner count.
     *         e.g. [10e6, 10e6, 10e6] = 3 winners × 10 USDC.
     *         Ensure minUniqueMinters ≥ prizes.length.
     */
    function setPrizes(uint256[] calldata _prizes) external onlyOwner {
        if (_prizes.length == 0) revert NoPrizes();
        if (minUniqueMinters < _prizes.length) revert MinUniqueMintersTooLow();
        delete prizes;
        for (uint256 i = 0; i < _prizes.length; i++) {
            prizes.push(_prizes[i]);
        }
        emit PrizesChanged(_prizes);
    }

    function setDrawThreshold(uint256 _threshold) external onlyOwner {
        drawThreshold = _threshold;
        emit DrawThresholdChanged(_threshold);
    }

    function setMinUniqueMinters(uint256 _min) external onlyOwner {
        minUniqueMinters = _min;
        emit MinUniqueMinterChanged(_min);
    }

    function setVrfConfig(
        uint256 _subscriptionId,
        bytes32 _keyHash,
        uint32  _callbackGasLimit,
        uint16  _requestConfirmations
    ) external onlyOwner {
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
        emit VrfConfigChanged(_subscriptionId, _keyHash, _callbackGasLimit, _requestConfirmations);
    }

    function setBooztory(address _booztory) external onlyOwner {
        if (_booztory == address(0)) revert InvalidAddress();
        booztory = _booztory;
        emit BooztoryChanged(_booztory);
    }

    /// @notice Withdraw all USDC from this contract (unused prize funds).
    function withdraw() external onlyOwner {
        uint256 bal = usdc.balanceOf(address(this));
        if (bal == 0) revert NothingToWithdraw();
        usdc.safeTransfer(owner(), bal);
        emit Withdrawn(address(usdc), owner(), bal);
    }

    /// @notice Recover any ERC-20 accidentally sent to this contract.
    ///         Cannot be used to drain USDC prize funds — use withdraw() for that.
    function withdrawToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        if (token == address(usdc)) revert("Use withdraw() for USDC");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert NothingToWithdraw();
        IERC20(token).safeTransfer(owner(), bal);
        emit Withdrawn(token, owner(), bal);
    }
}
