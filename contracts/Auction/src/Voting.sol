// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {NFTMinter} from "./NFTMinter.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {NFTAuction} from "./NFTAuction.sol";

contract Voting is AutomationCompatibleInterface, IERC721Receiver {
    // IST offset = 5h30m = 19,800 seconds
    uint256 private constant IST_OFFSET = 19800;
    uint256 private constant CANDIDATE_COUNT = 20;

    // Candidate data
    string[20] public candidatePngs;
    uint256[20] public votes;
    uint256[20] public lastVoteTimestamp; // last vote time for each candidate, used for tie-break

    // Voting limits
    // Stores the IST day index a voter last voted in, to enforce one vote per address per day
    mapping(address => uint256) public lastVotedDayIndex;

    // Day window aligned to IST
    // UTC timestamp for the start of the current IST day (00:00:00 IST)
    uint256 public currentDayStartIST;

    // Minter used to mint the winning NFT to this contract
    NFTMinter public immutable minter;
    // Auction contract that will auction the freshly minted NFT
    NFTAuction public immutable auction;

    // Events
    event Voted(
        address indexed voter,
        uint256 indexed candidateId,
        uint256 timestamp
    );
    event Finalized(
        uint256 indexed dayIndex,
        uint256 indexed winningCandidateId,
        uint256 winningVotes,
        uint256 tokenId
    );
    event DayStarted(uint256 currentDayStartIST);

    constructor(NFTMinter _minter, NFTAuction _auction, string[20] memory _candidatePngs) {
        minter = _minter;
        auction = _auction;
        for (uint256 i = 0; i < CANDIDATE_COUNT; i++) {
            candidatePngs[i] = _candidatePngs[i];
        }
        currentDayStartIST = _computeDayStartIST(block.timestamp);
        emit DayStarted(currentDayStartIST);
    }

    // --- Public read helpers ---

    function currentDayEndIST() public view returns (uint256) {
        return currentDayStartIST + 1 days;
    }

    // --- Status helpers ---
    /// @notice Returns true if voting for the current IST day is still open (now < currentDayEndIST)
    function isVotingOpen() public view returns (bool) {
        return block.timestamp < currentDayEndIST();
    }

    /// @notice Returns true if voting for the current IST day has closed (now >= currentDayEndIST)
    function hasVotingClosed() public view returns (bool) {
        return block.timestamp >= currentDayEndIST();
    }

    /// @notice Returns the start and end timestamps (UTC) of the current IST day window
    function currentDayWindow() public view returns (uint256 startIST, uint256 endIST) {
        startIST = currentDayStartIST;
        endIST = currentDayEndIST();
    }

    // Current IST day index based on block.timestamp
    function currentDayIndex() public view returns (uint256) {
        uint256 shifted = block.timestamp + IST_OFFSET;
        return shifted / 1 days;
    }

    // --- Voting ---

    function vote(uint256 candidateId) external {
        require(candidateId < CANDIDATE_COUNT, "Invalid candidate");
        require(
            block.timestamp < currentDayEndIST(),
            "Voting closed for today"
        );

        uint256 dayIdx = currentDayIndex();
        require(lastVotedDayIndex[msg.sender] < dayIdx, "Already voted today");

        // Record vote
        lastVotedDayIndex[msg.sender] = dayIdx;
        votes[candidateId] += 1;
        // Update last vote timestamp for tie-break logic
        lastVoteTimestamp[candidateId] = block.timestamp;

        emit Voted(msg.sender, candidateId, block.timestamp);
    }

    // --- Chainlink Automation ---

    function checkUpkeep(
        bytes calldata /*checkData*/
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory /*performData*/)
    {
        upkeepNeeded = (block.timestamp >= currentDayEndIST());
    }

    function performUpkeep(bytes calldata /*performData*/) external override {
        require(block.timestamp >= currentDayEndIST(), "Upkeep not needed");

        // Determine the winner:
        // - Highest vote count wins
        // - Tie-breaker: first to reach the highest count (earliest lastVoteTimestamp among tied leaders)
        uint256 winningId = 0;
        uint256 maxVotes = votes[0];
        uint256 earliestLastTs = lastVoteTimestamp[0];

        // Per your note, zero-vote days won't occur.
        for (uint256 i = 1; i < CANDIDATE_COUNT; i++) {
            uint256 v = votes[i];
            if (v > maxVotes) {
                maxVotes = v;
                winningId = i;
                earliestLastTs = lastVoteTimestamp[i];
            } else if (v == maxVotes) {
                // Among ties, the one with the EARLIEST lastVoteTimestamp reached that count first
                if (
                    lastVoteTimestamp[i] != 0 &&
                    lastVoteTimestamp[i] < earliestLastTs
                ) {
                    winningId = i;
                    earliestLastTs = lastVoteTimestamp[i];
                }
            }
        }

        // Mint the NFT to this contract
        uint256 tokenId = minter.mintWithSVG(address(this), candidatePngs[winningId]);

        // IST day index for event purposes is based on the day we just finalized
        uint256 dayIndex = (currentDayStartIST + IST_OFFSET) / 1 days;
        emit Finalized(dayIndex, winningId, maxVotes, tokenId);

        // Reset daily tallies for next day
        for (uint256 i = 0; i < CANDIDATE_COUNT; i++) {
            votes[i] = 0;
            lastVoteTimestamp[i] = 0;
        }

        // Roll forward to next IST day
        uint256 nextDayStart = currentDayStartIST + 1 days;
        currentDayStartIST = nextDayStart;
        emit DayStarted(currentDayStartIST);

        // Immediately transfer the freshly minted NFT to the auction and start the auction
        // Auction runs for the next IST day and will end at nextDayStart + 1 days
        IERC721(address(minter)).safeTransferFrom(address(this), address(auction), tokenId);
        uint256 auctionEnd = nextDayStart + 1 days;
        auction.startAuction(address(minter), tokenId, auctionEnd);
    }

    // --- Internal time helpers ---

    function _computeDayStartIST(uint256 ts) internal pure returns (uint256) {
        uint256 shifted = ts + IST_OFFSET;
        return shifted - (shifted % 1 days) - IST_OFFSET;
    }

    // --- ERC721 Receiver ---
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
