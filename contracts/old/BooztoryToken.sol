// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice Minimal IERC7802 interface for SuperchainERC20 cross-chain bridging.
 *         Called exclusively by the Superchain bridge predeploy.
 */
interface IERC7802 {
    function crosschainMint(address to, uint256 amount) external;
    function crosschainBurn(address from, uint256 amount) external;
}

/**
 * @title BooztoryToken (BOOZ)
 * @notice ERC-20 reward token for the Booztory platform.
 *
 *         Phase 1 — Soulbound: transfers are blocked; tokens can only be
 *                   minted (as rewards) or burned (for utility redemption).
 *                   Cross-chain bridging is also blocked during this phase.
 *         Phase 2 — Tradeable: owner flips `soulbound` off; normal ERC-20
 *                   transfers and cross-chain bridging are enabled.
 *
 *         Only the authorized Booztory contract can mint rewards and burn
 *         tokens for free-slot redemption.
 *
 *         Implements IERC7802 (SuperchainERC20) for native cross-chain
 *         token portability across OP Stack chains.
 */
contract BooztoryToken is ERC20, Ownable, IERC7802 {

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice When true, all transfers and cross-chain bridging are blocked.
    bool public soulbound = true;

    /// @notice The Booztory.sol contract — sole address allowed to mint/burn.
    address public booztory;

    /// @notice Whether the one-time treasury mint has been used.
    bool public treasuryMinted;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Superchain bridge predeploy — sole address allowed to crosschain mint/burn.
    address public constant SUPERCHAIN_BRIDGE = 0x4200000000000000000000000000000000000028;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event SoulboundChanged(bool newValue);
    event BooztoryAddressChanged(address indexed newAddress);
    event TreasuryMinted(address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error TransferWhileSoulbound();
    error OnlyBooztory();
    error OnlySuperchainBridge();
    error ZeroAddress();
    error TreasuryAlreadyMinted();
    error ExceedsTreasuryCap();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyBooztory() {
        if (msg.sender != booztory) revert OnlyBooztory();
        _;
    }

    modifier onlySuperchainBridge() {
        if (msg.sender != SUPERCHAIN_BRIDGE) revert OnlySuperchainBridge();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @dev Deployed via CREATE2 factory for deterministic same-address
     *      deployment across all OP Stack chains.
     * @param _owner  Deployer wallet — passed explicitly because msg.sender
     *                inside a CREATE2 factory call is the factory, not the EOA.
     */
    constructor(address _owner)
        ERC20("Booztory", "BOOZ")
        Ownable(_owner)
    {}

    // -------------------------------------------------------------------------
    // Soulbound toggle — owner only
    // -------------------------------------------------------------------------

    /**
     * @notice Enable or disable soulbound mode.
     *         Phase 1 → Phase 2: call setSoulbound(false) to allow trading.
     */
    function setSoulbound(bool _soulbound) external onlyOwner {
        soulbound = _soulbound;
        emit SoulboundChanged(_soulbound);
    }

    // -------------------------------------------------------------------------
    // Booztory address — owner only
    // -------------------------------------------------------------------------

    /**
     * @notice Update the authorized Booztory contract address.
     */
    function setBooztory(address _booztory) external onlyOwner {
        if (_booztory == address(0)) revert ZeroAddress();
        booztory = _booztory;
        emit BooztoryAddressChanged(_booztory);
    }

    // -------------------------------------------------------------------------
    // Treasury mint — owner only, one-time
    // -------------------------------------------------------------------------

    uint256 public constant TREASURY_CAP = 10_000_000 ether; // 10 million BOOZ

    /**
     * @notice Mint a one-time treasury allocation (e.g. for LP seeding).
     *         Can only be called once. Capped at TREASURY_CAP.
     * @param to      Recipient (treasury wallet or owner).
     * @param amount  Token amount (18 decimals, max 10,000,000 BOOZ).
     */
    function mintTreasury(address to, uint256 amount) external onlyOwner {
        if (treasuryMinted) revert TreasuryAlreadyMinted();
        if (to == address(0)) revert ZeroAddress();
        if (amount > TREASURY_CAP) revert ExceedsTreasuryCap();
        treasuryMinted = true;
        _mint(to, amount);
        emit TreasuryMinted(to, amount);
    }

    // -------------------------------------------------------------------------
    // Mint — Booztory only
    // -------------------------------------------------------------------------

    /**
     * @notice Mint reward tokens to a user. Called by Booztory.sol after a
     *         paid action (slot mint, GM streak).
     * @param to      Recipient address.
     * @param amount  Token amount (18 decimals).
     */
    function mintReward(address to, uint256 amount) external onlyBooztory {
        _mint(to, amount);
    }

    // -------------------------------------------------------------------------
    // Burn — Booztory only (free slot redemption)
    // -------------------------------------------------------------------------

    /**
     * @notice Burn tokens from a user for utility redemption (e.g. free slot).
     *         Called by Booztory.sol during mintSlotWithTokens().
     * @param from    Address to burn from.
     * @param amount  Token amount to burn (18 decimals).
     */
    function burnFrom(address from, uint256 amount) external onlyBooztory {
        _burn(from, amount);
    }

    // -------------------------------------------------------------------------
    // Self-burn — any holder
    // -------------------------------------------------------------------------

    /**
     * @notice Allow any holder to voluntarily burn their own tokens.
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // SuperchainERC20 — cross-chain mint/burn (IERC7802)
    // -------------------------------------------------------------------------

    /**
     * @notice Mint tokens when bridging in from another OP Stack chain.
     *         Called by the Superchain bridge predeploy only.
     *         Allowed during soulbound phase — bridge moves tokens between
     *         chains without changing ownership.
     * @param to      Recipient address on this chain.
     * @param amount  Token amount (18 decimals).
     */
    function crosschainMint(address to, uint256 amount) external onlySuperchainBridge {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens when bridging out to another OP Stack chain.
     *         Called by the Superchain bridge predeploy only.
     *         Blocked during soulbound phase — no cross-chain bridging until
     *         Phase 2 when liquidity is live and BOOZ has real value.
     * @param from    Address to burn from on this chain.
     * @param amount  Token amount (18 decimals).
     */
    function crosschainBurn(address from, uint256 amount) external onlySuperchainBridge {
        if (soulbound) revert TransferWhileSoulbound();
        _burn(from, amount);
    }

    // -------------------------------------------------------------------------
    // Transfer restriction — soulbound enforcement
    // -------------------------------------------------------------------------

    /**
     * @dev Hook that runs before every transfer, mint, and burn.
     *      When soulbound is active, only mint (from == 0) and burn (to == 0)
     *      are allowed. All wallet-to-wallet transfers revert.
     */
    function _update(address from, address to, uint256 value) internal override {
        if (soulbound) {
            // Allow mint (from == 0) and burn (to == 0); block everything else
            if (from != address(0) && to != address(0)) {
                revert TransferWhileSoulbound();
            }
        }
        super._update(from, to, value);
    }
}
