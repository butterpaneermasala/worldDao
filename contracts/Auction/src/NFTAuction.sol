// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

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

    // Timing
    uint256 public auctionEndTime; // UTC timestamp when auction ends
    bool public auctionActive;

    event AuctionStarted(address indexed nft, uint256 indexed tokenId, uint256 endTime);
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
    function startAuction(address _nft, uint256 _tokenId, uint256 _endTime) external onlyOperator {
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
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory) {
        upkeepNeeded = auctionActive && block.timestamp >= auctionEndTime;
    }

    function performUpkeep(bytes calldata) external override {
        require(auctionActive && block.timestamp >= auctionEndTime, "Upkeep not needed");
        auctionActive = false;
        // Transfer NFT to winner
        if (highestBidder != address(0)) {
            nft.safeTransferFrom(address(this), highestBidder, tokenId);
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

    // Receive NFTs
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
