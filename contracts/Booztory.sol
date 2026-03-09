// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title Booztory
 * @notice ERC-721 content spotlight platform on Base.
 *         Each token represents a featured content slot.
 *
 *         Mint fees:   go to this contract; owner withdraws via withdraw().
 *         Donations:   95% to creator, 5% fee stays in contract; owner withdraws.
 *         Payment:     paymentToken == address(0) → native ETH; otherwise any ERC-20.
 *         Admin-only:  slot price, slot duration, payment token, donation fee bps, withdraw.
 */
contract Booztory is ERC721, Ownable, ReentrancyGuard {
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

    uint256 public nextTokenId;
    uint256 public queueEndTime; // end timestamp of the last queued slot

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

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _paymentToken  ERC-20 token address, or address(0) for native ETH.
     */
    constructor(address _paymentToken)
        ERC721("Booztory Slot", "BSLOT")
        Ownable(msg.sender)
    {
        paymentToken = _paymentToken;
    }

    // -------------------------------------------------------------------------
    // Mint
    // -------------------------------------------------------------------------

    /**
     * @notice Pay the slot price and mint a featured content slot.
     *         ERC-20: caller must approve this contract for slotPrice before calling.
     *         ETH: send slotPrice as msg.value; excess is refunded.
     *         Mint fee is held in this contract; owner withdraws via withdraw().
     */
    function mintSlot(
        string calldata contentUrl,
        string calldata contentType,
        string calldata aspectRatio,
        string calldata title,
        string calldata authorName,
        string calldata imageUrl
    ) external payable nonReentrant {
        require(bytes(contentUrl).length > 0,  "Content URL required");
        require(bytes(contentType).length > 0, "Content type required");

        // Collect payment
        if (paymentToken == address(0)) {
            require(msg.value >= slotPrice, "Insufficient ETH");
            uint256 excess = msg.value - slotPrice;
            if (excess > 0) {
                (bool ok,) = msg.sender.call{value: excess}("");
                require(ok, "ETH refund failed");
            }
        } else {
            require(msg.value == 0, "ETH not accepted for ERC20 payment");
            require(
                IERC20(paymentToken).transferFrom(msg.sender, address(this), slotPrice),
                "Payment transfer failed"
            );
        }

        // Schedule slot after any existing queue
        uint256 start = block.timestamp > queueEndTime
            ? block.timestamp
            : queueEndTime;
        uint256 end = start + slotDuration;
        queueEndTime = end;

        uint256 tokenId = nextTokenId++;

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
        s.donations     = 0;

        _mint(msg.sender, tokenId);

        emit SlotMinted(tokenId, msg.sender, start, end);
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
    function donate(uint256 tokenId, uint256 amount) external payable nonReentrant {
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

        emit DonationReceived(tokenId, msg.sender, creatorAmount, feeAmount);
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
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "No token balance");
        address to = owner();
        require(IERC20(token).transfer(to, bal), "Token withdrawal failed");
        emit Withdrawn(token, to, bal);
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

    // -------------------------------------------------------------------------
    // Receive ETH (for ETH payment mode)
    // -------------------------------------------------------------------------

    receive() external payable {}

    // -------------------------------------------------------------------------
    // Status helpers
    // -------------------------------------------------------------------------

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
        for (uint256 i = nextTokenId; i > 0; i--) {
            uint256 id = i - 1;
            Slot storage s = slots[id];
            if (block.timestamp >= s.scheduledTime && block.timestamp <= s.endTime) {
                return (id, s, true);
            }
        }
        return (0, slots[0], false);
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
        string memory status = getSlotStatus(tokenId);

        bytes memory json = abi.encodePacked(
            '{"name":"Booztory Slot #', tokenId.toString(), '",',
            '"description":"A featured content slot on Booztory.",',
            '"image":"', s.imageUrl, '",',
            '"external_url":"https://booztory.com",',
            '"attributes":['
        );
        json = abi.encodePacked(json,
            '{"trait_type":"Content Type","value":"',  s.contentType, '"},',
            '{"trait_type":"Aspect Ratio","value":"',  s.aspectRatio, '"},',
            '{"trait_type":"Title","value":"',          s.title,       '"},',
            '{"trait_type":"Author","value":"',         s.authorName,  '"},',
            '{"trait_type":"Status","value":"',         status,        '"},'
        );
        json = abi.encodePacked(json,
            '{"trait_type":"Slot Start","display_type":"date","value":', s.scheduledTime.toString(), '},',
            '{"trait_type":"Slot End","display_type":"date","value":',   s.endTime.toString(),       '},',
            '{"trait_type":"Donations","display_type":"number","value":', s.donations.toString(),    '}',
            ']}'
        );

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(json)
        ));
    }
}
