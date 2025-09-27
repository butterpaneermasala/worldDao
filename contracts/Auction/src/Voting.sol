// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {NFTMinter} from "./NFTMinter.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {NFTAuction} from "./NFTAuction.sol";

contract Voting is AutomationCompatibleInterface, IERC721Receiver {
    // --- Proposal model (stored per session) ---
    struct Proposal {
        string tokenURI;     // ipfs://CID or gateway URL (for discovery/cleanup)
        string svgBase64;    // raw base64 SVG (minted on-chain as data URI)
        address proposer;
        uint256 votes;
        uint256 lastVoteTimestamp; // for tie-break: earliest last vote wins
    }

    /// @notice Local-dev helper: change phase durations only on Anvil/Hardhat (chainid 31337)
    /// Can only be called while in Uploading phase to avoid mid-phase inconsistencies.
    function setDurations(uint256 _upload, uint256 _voting, uint256 _bidding) external {
        require(block.chainid == 31337, "only local");
        require(currentPhase == Phase.Uploading || phaseEnd == 0, "must be uploading");
        require(_upload > 0 && _voting > 0 && _bidding > 0, "durations");
        uploadDuration = _upload;
        votingDuration = _voting;
        biddingDuration = _bidding;
        // if currently in Uploading, extend phaseEnd relative to now to reflect new duration
        if (currentPhase == Phase.Uploading) {
            phaseEnd = block.timestamp + uploadDuration;
            emit PhaseChanged(currentPhase, phaseEnd);
        }
    }

    Proposal[] public proposals;
    
    // --- Phases ---
    enum Phase { Uploading, Voting, Bidding }
    Phase public currentPhase;
    uint256 public phaseEnd; // UTC timestamp for end of current phase

    // durations (seconds) — default 1 day each; configurable only on local dev chain
    uint256 public uploadDuration = 1 days;
    uint256 public votingDuration = 1 days;
    uint256 public biddingDuration = 1 days;

    // Voting limits: one vote per address per voting session
    uint256 public voteSessionId;
    mapping(address => uint256) public lastVotedSession;

    // Admin retained but not used for gating (no admin role required now)
    address public admin;

    // Minter used to mint the winning NFT to this contract
    NFTMinter public immutable minter;
    // Auction contract that will auction the freshly minted NFT
    NFTAuction public immutable auction;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    // Events
    event ProposalSubmitted(uint256 indexed index, address indexed proposer, string tokenURI);
    event VotingOpened(uint256 startTime, uint256 endTime, uint256 proposalsCount);
    event Voted(address indexed voter, uint256 indexed proposalId, uint256 timestamp);
    event Finalized(uint256 indexed dayIndex, uint256 indexed winningProposalId, uint256 winningVotes, uint256 tokenId, string winningTokenURI);
    event PhaseChanged(Phase phase, uint256 phaseEnd);

    /// @notice Constructor (legacy-compatible): accepts 20 base64 strings to seed proposals immediately.
    /// Admin is set to deployer (msg.sender). If seeds provided, start in Voting phase for 1 day; otherwise start Uploading for 1 day.
    constructor(NFTMinter _minter, NFTAuction _auction, string[20] memory _candidateBase64) {
        minter = _minter;
        auction = _auction;
        admin = msg.sender;
        // Seed proposals from the provided array (only non-empty)
        for (uint256 i = 0; i < 20; i++) {
            if (bytes(_candidateBase64[i]).length > 0) {
                proposals.push(Proposal({
                    tokenURI: "",
                    svgBase64: _candidateBase64[i],
                    proposer: address(0),
                    votes: 0,
                    lastVoteTimestamp: 0
                }));
            }
        }
        if (proposals.length > 0) {
            // Start directly in Voting phase for one day
            currentPhase = Phase.Voting;
            phaseEnd = block.timestamp + votingDuration;
            // new session id for voting
            voteSessionId += 1;
            emit VotingOpened(block.timestamp, phaseEnd, proposals.length);
            emit PhaseChanged(currentPhase, phaseEnd);
        } else {
            // No seeds; start Uploading phase for one day
            currentPhase = Phase.Uploading;
            phaseEnd = block.timestamp + uploadDuration;
            emit PhaseChanged(currentPhase, phaseEnd);
        }
    }

    // --- Public read helpers ---
    function isVotingOpen() public view returns (bool) { return currentPhase == Phase.Voting && block.timestamp < phaseEnd; }
    function currentDayIndex() public view returns (uint256) { return 0; } // deprecated; kept for ABI compat, no longer meaningful
    function currentPhaseInfo() external view returns (Phase phase, uint256 endTime) { return (currentPhase, phaseEnd); }
    /// @notice Legacy-compatible end-of-day getter used by older tests; now returns current phaseEnd
    function currentDayEndIST() external view returns (uint256) { return phaseEnd; }

    // --- Proposals lifecycle ---
    /// @notice Submit a proposal (off-chain upload to Pinata first). Hidden until voting is opened.
    /// @param tokenURI ipfs:// or https gateway URL
    /// @param svgBase64 raw base64 SVG content (without data URI prefix)
    function propose(string calldata tokenURI, string calldata svgBase64) external {
        require(currentPhase == Phase.Uploading, "Not in uploading phase");
        require(bytes(svgBase64).length > 0, "svg required");
        proposals.push(Proposal({ tokenURI: tokenURI, svgBase64: svgBase64, proposer: msg.sender, votes: 0, lastVoteTimestamp: 0 }));
        emit ProposalSubmitted(proposals.length - 1, msg.sender, tokenURI);
    }

    // openVoting removed — transitions are automatic via Automation

    // --- Voting ---

    function vote(uint256 proposalId) external {
        require(currentPhase == Phase.Voting && block.timestamp < phaseEnd, "Voting closed");
        require(proposalId < proposals.length, "Bad id");
        require(lastVotedSession[msg.sender] < voteSessionId, "Already voted this session");
        lastVotedSession[msg.sender] = voteSessionId;
        Proposal storage p = proposals[proposalId];
        p.votes += 1;
        p.lastVoteTimestamp = block.timestamp;
        emit Voted(msg.sender, proposalId, block.timestamp);
    }

    // --- Chainlink Automation ---

    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        upkeepNeeded = (block.timestamp >= phaseEnd);
        performData = bytes("");
    }

    function performUpkeep(bytes calldata) external override {
        require(block.timestamp >= phaseEnd, "Upkeep not needed");

        if (currentPhase == Phase.Uploading) {
            if (proposals.length == 0) {
                // extend uploading until at least one proposal exists
                phaseEnd = block.timestamp + uploadDuration;
                emit PhaseChanged(currentPhase, phaseEnd);
                return;
            }
            // move to Voting phase
            currentPhase = Phase.Voting;
            phaseEnd = block.timestamp + votingDuration;
            voteSessionId += 1;
            emit VotingOpened(block.timestamp, phaseEnd, proposals.length);
            emit PhaseChanged(currentPhase, phaseEnd);
            return;
        }

        if (currentPhase == Phase.Voting) {
            // Determine the winner among proposals
            require(proposals.length > 0, "No proposals");
            uint256 winningId = 0;
            uint256 maxVotes = proposals[0].votes;
            uint256 earliestLastTs = proposals[0].lastVoteTimestamp;
            for (uint256 i = 1; i < proposals.length; i++) {
                Proposal storage p = proposals[i];
                if (p.votes > maxVotes) {
                    maxVotes = p.votes;
                    winningId = i;
                    earliestLastTs = p.lastVoteTimestamp;
                } else if (p.votes == maxVotes) {
                    if (p.lastVoteTimestamp != 0 && p.lastVoteTimestamp < earliestLastTs) {
                        winningId = i;
                        earliestLastTs = p.lastVoteTimestamp;
                    }
                }
            }

            // Mint the NFT to this contract using raw SVG base64
            uint256 tokenId = minter.mintWithSVG(address(this), proposals[winningId].svgBase64);
            emit Finalized(0, winningId, maxVotes, tokenId, proposals[winningId].tokenURI);

            // Transfer NFT to the auction and start the auction for biddingDuration
            IERC721(address(minter)).safeTransferFrom(address(this), address(auction), tokenId);
            uint256 auctionEnd = block.timestamp + biddingDuration;
            auction.startAuction(address(minter), tokenId, auctionEnd);

            // Move to Bidding phase
            currentPhase = Phase.Bidding;
            phaseEnd = auctionEnd; // equal to bidding end
            emit PhaseChanged(currentPhase, phaseEnd);
            return;
        }

        if (currentPhase == Phase.Bidding) {
            // Reset proposals and move back to Uploading phase
            delete proposals;
            currentPhase = Phase.Uploading;
            phaseEnd = block.timestamp + uploadDuration;
            emit PhaseChanged(currentPhase, phaseEnd);
            return;
        }
    }

    // --- ERC721 Receiver ---
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Backward-compatible getter for tests expecting `votes(uint256)` on contract
    function votes(uint256 idx) external view returns (uint256) {
        require(idx < proposals.length, "idx");
        return proposals[idx].votes;
    }

    /// @notice Number of proposals in the current session
    function proposalsCount() external view returns (uint256) {
        return proposals.length;
    }
}
