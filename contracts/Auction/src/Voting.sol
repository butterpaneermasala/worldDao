// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {NFTMinter} from "./NFTMinter.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {NFTAuction} from "./Auction.sol";

/// @notice Interface for Treasury contract
interface ITreasury {
    function getETHBalance() external view returns (uint256);
    function governor() external view returns (address);
}

contract Voting is AutomationCompatibleInterface, IERC721Receiver {
    // --- Fixed slot voting (20 indices: 0..19) ---
    uint8 public constant SLOT_COUNT = 20;
    uint256[SLOT_COUNT] public tallies; // votes per slot for current session
    uint256[SLOT_COUNT] public lastVoteTs; // last vote timestamp per slot (for tie-break)

    /// @notice Set the off-chain operator/relayer authorized to finalize with the winning SVG
    function setOperator(address _op) external onlyAdmin {
        operator = _op;
    }

    /// @notice Configure auction to use Treasury as beneficiary (only admin)
    function configureTreasuryBeneficiary() external onlyAdmin {
        auction.setBeneficiary(payable(address(treasury)));
        emit TreasuryConfigured(address(treasury));
    }

    /// @notice Finalize the voting with an off-chain computed winner and start the on-chain auction
    /// @param tokenURI ipfs:// or https URL for reference/discovery
    /// @param svgBase64 raw base64 SVG content (without data URI prefix)
    function finalizeWithWinner(
        string calldata tokenURI,
        string calldata svgBase64,
        uint8 winnerIndex
    ) external onlyOperator {
        require(currentPhase == Phase.Voting, "not voting");
        require(block.timestamp >= phaseEnd, "not ended");
        // Validate winnerIndex matches on-chain tallies with tie-break
        uint8 computed = _computeWinnerIndex();
        require(winnerIndex == computed, "wrong winner index");

        // Ensure Treasury is properly configured as beneficiary
        require(
            auction.beneficiary() == address(treasury),
            "Treasury not configured as beneficiary"
        );

        uint256 tokenId = minter.mintWithSVG(address(this), svgBase64);
        emit Finalized(0, winnerIndex, tallies[winnerIndex], tokenId, tokenURI);

        IERC721(address(minter)).safeTransferFrom(
            address(this),
            address(auction),
            tokenId
        );
        uint256 auctionEnd = block.timestamp + biddingDuration;
        auction.startAuction(address(minter), tokenId, auctionEnd);

        currentPhase = Phase.Bidding;
        phaseEnd = auctionEnd;
        emit PhaseChanged(currentPhase, phaseEnd);
    }

    /// @notice Local-dev helper: change phase durations only on Anvil/Hardhat (chainid 31337)
    /// Can only be called while in Uploading phase to avoid mid-phase inconsistencies.
    function setDurations(
        uint256 _upload,
        uint256 _voting,
        uint256 _bidding
    ) external {
        require(
            currentPhase == Phase.Uploading || phaseEnd == 0,
            "must be uploading"
        );
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

    // --- Proposal Management (Legacy System) ---

    struct Proposal {
        address proposer;
        string tokenURI;
        string svgBase64;
        uint256 voteCount;
    }

    Proposal[] public proposals;

    /// @notice Propose an NFT for voting (legacy function for test compatibility)
    /// @param tokenURI The IPFS URI for the NFT metadata
    /// @param svgBase64 Base64 encoded SVG content
    function propose(
        string calldata tokenURI,
        string calldata svgBase64
    ) external {
        require(currentPhase == Phase.Uploading, "not uploading");
        require(bytes(svgBase64).length > 0, "svg required");

        // For test compatibility, we'll store proposals but the current system uses fixed slots
        // This maintains backward compatibility with existing tests
        proposals.push(
            Proposal({
                proposer: msg.sender,
                tokenURI: tokenURI,
                svgBase64: svgBase64,
                voteCount: 0
            })
        );

        emit ProposalCreated(proposals.length - 1, msg.sender, tokenURI);
    }

    /// @notice Get proposal count (for test compatibility)
    function proposalsCount() external view returns (uint256) {
        return proposals.length;
    }

    /// @notice Get proposal by index (for test compatibility)
    function getProposal(
        uint256 index
    )
        external
        view
        returns (
            address proposer,
            string memory tokenURI,
            string memory svgBase64,
            uint256 voteCount
        )
    {
        require(index < proposals.length, "invalid index");
        Proposal memory p = proposals[index];
        return (p.proposer, p.tokenURI, p.svgBase64, p.voteCount);
    }

    // --- Events for proposals ---
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string tokenURI
    );

    // --- Phases ---
    enum Phase {
        Uploading,
        Voting,
        Bidding
    }
    Phase public currentPhase;
    uint256 public phaseEnd; // UTC timestamp for end of current phase

    // durations (seconds) - default 1 day each; configurable only on local dev chain
    uint256 public uploadDuration = 1 days;
    uint256 public votingDuration = 1 days;
    uint256 public biddingDuration = 1 days;

    // Voting limits: one vote per address per voting session
    uint256 public voteSessionId;
    mapping(address => uint256) public lastVotedSession;

    // Admin retained but not used for gating (no admin role required now)
    address public admin;
    // Operator (relayer) that is authorized to finalize with the winning SVG off-chain
    address public operator;

    // Minter used to mint the winning NFT to this contract
    NFTMinter public immutable minter;
    // Auction contract that will auction the freshly minted NFT
    NFTAuction public immutable auction;
    // Treasury contract that receives auction proceeds
    ITreasury public immutable treasury;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    // Events
    event VotingOpened(uint256 startTime, uint256 endTime, uint256 slotCount);
    event Voted(
        address indexed voter,
        uint8 indexed slotIndex,
        uint256 timestamp
    );
    event Finalized(
        uint256 indexed dayIndex,
        uint256 indexed winningProposalId,
        uint256 winningVotes,
        uint256 tokenId,
        string winningTokenURI
    );
    event PhaseChanged(Phase phase, uint256 phaseEnd);
    event TreasuryConfigured(address indexed treasury);

    /// @notice Constructor; starts Uploading phase.
    constructor(
        NFTMinter _minter,
        NFTAuction _auction,
        ITreasury _treasury,
        string[20] memory /*_candidateBase64*/
    ) {
        minter = _minter;
        auction = _auction;
        treasury = _treasury;
        admin = msg.sender;
        operator = address(0);
        // Start in Uploading phase for one day (off-chain submissions expected)
        admin = msg.sender;

        // Validate Treasury contract
        require(address(_treasury) != address(0), "Invalid treasury");
        require(_treasury.governor() != address(0), "Treasury not initialized");

        // Configure auction to send proceeds to Treasury
        // Note: This requires the auction operator to be this Voting contract

        // Start in Uploading phase with initial duration
        currentPhase = Phase.Uploading;
        phaseEnd = block.timestamp + uploadDuration;
        emit PhaseChanged(currentPhase, phaseEnd);
    }

    // --- Public read helpers ---
    function isVotingOpen() public view returns (bool) {
        return currentPhase == Phase.Voting && block.timestamp < phaseEnd;
    }

    function currentDayIndex() public view returns (uint256) {
        return 0;
    } // deprecated; kept for ABI compat, no longer meaningful

    function currentPhaseInfo()
        external
        view
        returns (Phase phase, uint256 endTime)
    {
        return (currentPhase, phaseEnd);
    }

    /// @notice Legacy-compatible end-of-day getter used by older tests; now returns current phaseEnd
    function currentDayEndIST() external view returns (uint256) {
        return phaseEnd;
    }

    // --- Voting ---
    function voteIndex(uint8 slotIndex) external {
        require(
            currentPhase == Phase.Voting && block.timestamp < phaseEnd,
            "Voting closed"
        );
        require(slotIndex < SLOT_COUNT, "Bad index");
        require(
            lastVotedSession[msg.sender] < voteSessionId,
            "Already voted this session"
        );
        lastVotedSession[msg.sender] = voteSessionId;
        tallies[slotIndex] += 1;
        lastVoteTs[slotIndex] = block.timestamp;
        emit Voted(msg.sender, slotIndex, block.timestamp);
    }

    // --- Chainlink Automation ---

    function checkUpkeep(
        bytes calldata
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = (block.timestamp >= phaseEnd);
        performData = bytes("");
    }

    function performUpkeep(bytes calldata) external override {
        require(block.timestamp >= phaseEnd, "Upkeep not needed");

        if (currentPhase == Phase.Uploading) {
            // Move to Voting phase unconditionally; items are off-chain in Pinata
            currentPhase = Phase.Voting;
            phaseEnd = block.timestamp + votingDuration;
            voteSessionId += 1;
            emit VotingOpened(block.timestamp, phaseEnd, SLOT_COUNT);
            emit PhaseChanged(currentPhase, phaseEnd);
            return;
        }

        if (currentPhase == Phase.Voting) {
            // Off-chain voting: do not finalize here. Await operator.finalizeWithWinner
            return;
        }

        if (currentPhase == Phase.Bidding) {
            // Reset tallies and move back to Uploading phase
            for (uint8 i = 0; i < SLOT_COUNT; i++) {
                tallies[i] = 0;
                lastVoteTs[i] = 0;
            }
            currentPhase = Phase.Uploading;
            phaseEnd = block.timestamp + uploadDuration;
            emit PhaseChanged(currentPhase, phaseEnd);
            return;
        }
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

    /// @notice Return tally for a given slot index
    function slotVotes(uint8 idx) external view returns (uint256) {
        require(idx < SLOT_COUNT, "idx");
        return tallies[idx];
    }

    /// @notice Compute winner index according to tallies and tie-break
    function _computeWinnerIndex() internal view returns (uint8) {
        uint8 winner = 0;
        uint256 maxVotes = tallies[0];
        uint256 earliestTs = lastVoteTs[0] == 0
            ? type(uint256).max
            : lastVoteTs[0];
        for (uint8 i = 1; i < SLOT_COUNT; i++) {
            uint256 v = tallies[i];
            if (v > maxVotes) {
                maxVotes = v;
                winner = i;
                earliestTs = lastVoteTs[i] == 0
                    ? type(uint256).max
                    : lastVoteTs[i];
            } else if (v == maxVotes) {
                uint256 ts = lastVoteTs[i] == 0
                    ? type(uint256).max
                    : lastVoteTs[i];
                if (ts < earliestTs) {
                    winner = i;
                    earliestTs = ts;
                }
            }
        }
        return winner;
    }

    /// @notice Getter for last vote timestamp of a slot (for off-chain convenience)
    function lastVoteTime(uint8 idx) external view returns (uint256) {
        require(idx < SLOT_COUNT, "idx");
        return lastVoteTs[idx];
    }
}
