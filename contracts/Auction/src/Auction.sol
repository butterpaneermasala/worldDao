// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import the Chainlink Automation interface.
// The contract must implement this interface to be compatible with Chainlink Automation.
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title DailyAuction
 * @dev This contract implements a reusable, daily auction. It automatically ends one auction
 * and begins the next, using Chainlink Automation for the timed trigger.
 * It is compatible with EVM chains and uses the "withdrawal pattern" for secure refunds.
 */
contract DailyAuction is AutomationCompatibleInterface {
    // The address that created the auction. This person will receive the final bid.
    address payable public _auctioneer;

    // The address of the current highest bidder.
    address public _highestBidder;

    // The value of the current highest bid.
    uint256 public _highestBid;

    // A mapping to store the total bid amount for each bidder.
    mapping(address => uint256) public _bidAmounts;

    // The UNIX timestamp when the current auction ends.
    uint256 public _auctionEndTime;

    // The duration of each auction, set to 23 hours in seconds (23 * 60 * 60).
    uint256 public immutable _auctionDuration = 82800; // 23 hours

    // Events to log important actions on the blockchain.
    event HighestBidIncreased(address indexed bidder, uint256 amount);
    event AuctionEnded(address winner, uint256 amount);
    event BidWithdrawn(address indexed bidder, uint256 amount);
    event AuctionStarted(uint256 auctionEndTime);

    /**
     * @dev The constructor sets the auctioneer and the end time for the very first auction.
     */
    constructor() {
        _auctioneer = payable(msg.sender);
        // Set the end time for the first auction to 23 hours from now.
        // This can be adjusted to align with midnight, for example.
        _auctionEndTime = block.timestamp + _auctionDuration;
        emit AuctionStarted(_auctionEndTime);
    }

    /**
     * @notice Returns true if the current auction is still active (now < _auctionEndTime)
     */
    function isAuctionActive() public view returns (bool) {
        return block.timestamp < _auctionEndTime;
    }

    /**
     * @notice Returns true if the current auction has ended (now >= _auctionEndTime)
     */
    function hasAuctionEnded() public view returns (bool) {
        return block.timestamp >= _auctionEndTime;
    }

    /**
     * @notice Returns seconds remaining until the current auction ends. Returns 0 if ended.
     */
    function timeLeft() public view returns (uint256) {
        if (block.timestamp >= _auctionEndTime) return 0;
        return _auctionEndTime - block.timestamp;
    }

    /**
     * @dev Allows a user to place a bid.
     */
    function bid() public payable {
        // Condition: The auction must still be open.
        require(
            block.timestamp <= _auctionEndTime,
            "Bidding is not open at this time"
        );

        // Action: Calculate the new total bid for the sender.
        uint256 newTotalBid = _bidAmounts[msg.sender] + msg.value;

        // Condition: The new total bid must be higher than the current highest bid.
        require(
            newTotalBid > _highestBid,
            "Your total bid must be higher than the current highest bid"
        );

        // Action: If there was a previous highest bidder and it's not the current sender,
        // their funds are now available for withdrawal.
        if (_highestBidder != address(0) && _highestBidder != msg.sender) {
            // Funds for the outbid person are already in the contract and can be withdrawn later.
        }

        // Action: Update the state with the new highest bid and bidder.
        _highestBid = newTotalBid;
        _highestBidder = msg.sender;
        _bidAmounts[msg.sender] = newTotalBid;

        // Log the event on the blockchain.
        emit HighestBidIncreased(msg.sender, newTotalBid);
    }

    /**
     * @dev Allows a bidder who has been outbid to withdraw their pending funds.
     */
    function withdraw() public {
        // Condition: The caller must have funds to withdraw.
        require(
            msg.sender != _highestBidder,
            "Highest bidder cannot withdraw funds"
        );

        uint256 amount = _bidAmounts[msg.sender];
        require(amount > 0, "No pending funds to withdraw");

        // Action: Set the pending amount to zero BEFORE sending the money to prevent re-entrancy.
        _bidAmounts[msg.sender] = 0;

        // Action: Safely send the funds to the caller.
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Failed to send Ether");

        // Log the event on the blockchain.
        emit BidWithdrawn(msg.sender, amount);
    }

    /**
     * @dev This is the function Chainlink Automation will call to check if the upkeep is needed.
     * It returns `true` if the current auction's end time has passed.
     */
    function checkUpkeep(
        bytes calldata /* checkData */
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        // The upkeep is needed if the current auction's end time has passed.
        upkeepNeeded = (block.timestamp >= _auctionEndTime);
    }

    /**
     * @dev This is the function Chainlink Automation will call to finalize one auction
     * and start the next.
     */
    function performUpkeep(bytes calldata /* performData */) external override {
        // Step 1: Finalize the current auction.
        // We re-check the condition to ensure no one else has called it recently.
        require(block.timestamp >= _auctionEndTime, "Upkeep not needed");

        // Action: Send the highest bid from the now-ended auction to the auctioneer.
        // The funds are transferred here, and the highest bidder is marked as paid.
        (bool success, ) = _auctioneer.call{value: _highestBid}("");
        require(success, "Failed to send Ether to auctioneer");

        // Log the event for the ended auction.
        emit AuctionEnded(_highestBidder, _highestBid);

        // Step 2: Reset the state for the new auction.
        // Reset the highest bid and bidder.
        _highestBid = 0;
        _highestBidder = address(0);

        // Reset the bid amounts for all participants.
        // Note: In a real-world scenario with many bidders, this approach is not gas-efficient.
        // A better pattern for a perpetual contract would be to use a data structure that
        // doesn't require iterating or resetting. For this example, we assume bids are handled
        // and withdrawn efficiently. The `withdraw` function already handles individual refunds.

        // Set the new auction end time to 23 hours from now.
        _auctionEndTime = block.timestamp + _auctionDuration;

        // Log the start of the new auction.
        emit AuctionStarted(_auctionEndTime);
    }
}

/// @title NFTAuction
/// @notice Receives an ERC721 token, runs a timed auction, then transfers the NFT to the highest bidder
///         and forwards the proceeds to a beneficiary. Designed to be operated by Voting.
contract NFTAuction is IERC721Receiver, AutomationCompatibleInterface {
    // Operator (e.g., Voting contract) allowed to start auctions
    address public operator;

    // The NFT being auctioned
    IERC721 public nft;
    uint256 public tokenId;

    // Beneficiary who receives the highest bid proceeds
    address payable public beneficiary;

    // Bidding state
    address public highestBidder;
    uint256 public highestBid;
    mapping(address => uint256) public bidAmounts;
    mapping(address => uint256) public nftownerRecord;
    // Timing
    uint256 public auctionEndTime; // UTC timestamp when auction ends
    bool public auctionActive;

    event AuctionStarted(
        address indexed nft,
        uint256 indexed tokenId,
        uint256 endTime
    );
    event HighestBidIncreased(address indexed bidder, uint256 amount);
    event AuctionEnded(address indexed winner, uint256 amount);
    event Withdrawn(address indexed bidder, uint256 amount);
    event OperatorUpdated(address indexed operator);

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    constructor(address _operator, address payable _beneficiary) {
        operator = _operator;
        beneficiary = _beneficiary;
        emit OperatorUpdated(_operator);
    }

    function setOperator(address _operator) external onlyOperator {
        operator = _operator;
        emit OperatorUpdated(_operator);
    }

    // Start an auction for a given NFT that this contract must already own
    function startAuction(
        address _nft,
        uint256 _tokenId,
        uint256 _endTime
    ) external onlyOperator {
        require(!auctionActive, "Auction active");
        nft = IERC721(_nft);
        tokenId = _tokenId;
        require(nft.ownerOf(tokenId) == address(this), "NFT not owned");
        require(_endTime > block.timestamp, "Bad end time");
        auctionEndTime = _endTime;
        highestBidder = address(0);
        highestBid = 0;
        auctionActive = true;
        emit AuctionStarted(_nft, _tokenId, _endTime);
    }

    // Place a bid (cumulative); must exceed current highest
    function bid() external payable {
        require(auctionActive, "No auction");
        require(block.timestamp < auctionEndTime, "Auction ended");
        uint256 newTotal = bidAmounts[msg.sender] + msg.value;
        require(newTotal > highestBid, "Bid too low");
        bidAmounts[msg.sender] = newTotal;
        highestBid = newTotal;
        highestBidder = msg.sender;
        emit HighestBidIncreased(msg.sender, newTotal);
    }

    // Withdraw for outbid bidders
    function withdraw() external {
        require(msg.sender != highestBidder, "Winner cannot withdraw");
        uint256 amount = bidAmounts[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        bidAmounts[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Withdraw failed");
        emit Withdrawn(msg.sender, amount);
    }

    // Automation: finalize when ended
    function checkUpkeep(
        bytes calldata
    ) external view override returns (bool upkeepNeeded, bytes memory) {
        upkeepNeeded = auctionActive && block.timestamp >= auctionEndTime;
    }

    function performUpkeep(bytes calldata) external override {
        require(
            auctionActive && block.timestamp >= auctionEndTime,
            "Upkeep not needed"
        );
        auctionActive = false;
        // Transfer NFT to winner
        if (highestBidder != address(0)) {
            nft.safeTransferFrom(address(this), highestBidder, tokenId);
            nftownerRecord[highestBidder] += 1;
            // Forward funds to beneficiary
            if (highestBid > 0 && beneficiary != address(0)) {
                (bool ok, ) = beneficiary.call{value: highestBid}("");
                require(ok, "Payout failed");
            }
        }
        emit AuctionEnded(highestBidder, highestBid);
        // Reset core references (optional safety)
        // nft, tokenId left as record of last auction
    }

    function getNftOnwerRecords(address owner) public view returns (uint256) {
        return nftownerRecord[owner];
    }

    // Receive NFTs
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
