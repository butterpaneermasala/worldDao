// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WorldChainGovernor
 * @notice Minimal DAO Governance contract for World Chain using WorldNFT tokens
 * @dev EVM-compatible governance contract with configurable parameters
 */

interface IWorldNFT {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function totalSupply() external view returns (uint256);
}

interface ITreasury {
    function executeProposal(uint256 proposalId, bytes calldata data) external;
}

contract WorldChainGovernor {
    // Proposal states following the standard governance lifecycle
    enum ProposalState {
        Pending, // Proposal created but not yet active
        Active, // Currently accepting votes
        Succeeded, // Passed and ready for execution
        Defeated, // Failed to meet requirements
        Executed // Successfully executed
    }

    // Vote choices
    enum VoteChoice {
        Against,
        For,
        Abstain
    }

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        ProposalState state;
        bytes executionData; // Data for treasury execution
        mapping(address => bool) hasVoted;
        mapping(address => VoteChoice) voterChoice;
    }

    // State variables
    IWorldNFT public immutable worldNFT;
    ITreasury public treasury;

    uint256 public proposalCount;
    uint256 public votingPeriod; // Voting duration in blocks
    uint256 public votingDelay; // Delay before voting starts (in blocks)
    uint256 public quorum; // Minimum votes required

    address public owner; // Contract owner for admin functions
    bool public paused; // Emergency pause mechanism

    // Mappings
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public latestProposalIds;

    // Events
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        string description,
        uint256 startBlock,
        uint256 endBlock
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteChoice choice,
        uint256 weight
    );

    event ProposalFinalized(uint256 indexed id, ProposalState state);
    event ProposalExecuted(uint256 indexed id);
    event TreasuryUpdated(address indexed newTreasury);
    event VotingPeriodUpdated(uint256 newVotingPeriod);
    event QuorumUpdated(uint256 newQuorum);
    event PausedStateChanged(bool paused);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier validProposal(uint256 proposalId) {
        require(
            proposalId > 0 && proposalId <= proposalCount,
            "Invalid proposal ID"
        );
        _;
    }

    /**
     * @notice Constructor to initialize the governance contract
     * @param _worldNFT Address of the WorldNFT contract
     * @param _votingPeriod Duration of voting in blocks (e.g., 6400 ≈ 1 day)
     * @param _votingDelay Delay before voting starts in blocks
     * @param _quorum Minimum number of votes required for a proposal to pass
     */
    constructor(
        address _worldNFT,
        uint256 _votingPeriod,
        uint256 _votingDelay,
        uint256 _quorum
    ) {
        require(_worldNFT != address(0), "Invalid WorldNFT address");
        require(_votingPeriod > 0, "Voting period must be positive");
        require(_quorum > 0, "Quorum must be positive");

        worldNFT = IWorldNFT(_worldNFT);
        votingPeriod = _votingPeriod;
        votingDelay = _votingDelay;
        quorum = _quorum;
        owner = msg.sender;
    }

    /**
     * @notice Create a new governance proposal
     * @param description Description of the proposal
     * @param executionData Optional data for treasury execution
     * @return proposalId The ID of the created proposal
     */
    function propose(
        string memory description,
        bytes memory executionData
    ) external whenNotPaused returns (uint256) {
        require(
            worldNFT.balanceOf(msg.sender) >= 1,
            "Must hold at least 1 WorldNFT to propose"
        );
        require(bytes(description).length > 0, "Description cannot be empty");

        // Prevent spam by limiting one active proposal per user
        uint256 latestProposalId = latestProposalIds[msg.sender];
        if (latestProposalId != 0) {
            ProposalState latestState = proposals[latestProposalId].state;
            require(
                latestState == ProposalState.Executed ||
                    latestState == ProposalState.Defeated,
                "Previous proposal still active"
            );
        }

        proposalCount++;
        uint256 startBlock = block.number + votingDelay;
        uint256 endBlock = startBlock + votingPeriod;

        Proposal storage newProposal = proposals[proposalCount];
        newProposal.id = proposalCount;
        newProposal.proposer = msg.sender;
        newProposal.description = description;
        newProposal.startBlock = startBlock;
        newProposal.endBlock = endBlock;
        newProposal.state = votingDelay > 0
            ? ProposalState.Pending
            : ProposalState.Active;
        newProposal.executionData = executionData;

        latestProposalIds[msg.sender] = proposalCount;

        emit ProposalCreated(
            proposalCount,
            msg.sender,
            description,
            startBlock,
            endBlock
        );

        return proposalCount;
    }

    /**
     * @notice Cast a vote on a proposal
     * @param proposalId ID of the proposal to vote on
     * @param choice Vote choice (0=Against, 1=For, 2=Abstain)
     */
    function vote(
        uint256 proposalId,
        VoteChoice choice
    ) external whenNotPaused validProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];

        require(_isVotingActive(proposal), "Voting is not active");
        require(
            worldNFT.balanceOf(msg.sender) >= 1,
            "Must hold at least 1 WorldNFT to vote"
        );
        require(
            !proposal.hasVoted[msg.sender],
            "Already voted on this proposal"
        );

        // Update proposal state if needed
        if (
            proposal.state == ProposalState.Pending &&
            block.number >= proposal.startBlock
        ) {
            proposal.state = ProposalState.Active;
        }

        uint256 votingWeight = worldNFT.balanceOf(msg.sender);

        proposal.hasVoted[msg.sender] = true;
        proposal.voterChoice[msg.sender] = choice;

        if (choice == VoteChoice.Against) {
            proposal.againstVotes += votingWeight;
        } else if (choice == VoteChoice.For) {
            proposal.forVotes += votingWeight;
        } else {
            proposal.abstainVotes += votingWeight;
        }

        emit VoteCast(proposalId, msg.sender, choice, votingWeight);
    }

    /**
     * @notice Finalize a proposal after voting period ends
     * @param proposalId ID of the proposal to finalize
     */
    function finalize(uint256 proposalId) external validProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];

        require(block.number > proposal.endBlock, "Voting period not ended");
        require(
            proposal.state == ProposalState.Active,
            "Proposal not in active state"
        );

        uint256 totalVotes = proposal.forVotes +
            proposal.againstVotes +
            proposal.abstainVotes;

        if (totalVotes >= quorum && proposal.forVotes > proposal.againstVotes) {
            proposal.state = ProposalState.Succeeded;
        } else {
            proposal.state = ProposalState.Defeated;
        }

        emit ProposalFinalized(proposalId, proposal.state);
    }

    /**
     * @notice Execute a successful proposal
     * @param proposalId ID of the proposal to execute
     */
    function execute(uint256 proposalId) external validProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];

        require(
            proposal.state == ProposalState.Succeeded,
            "Proposal not in succeeded state"
        );

        proposal.state = ProposalState.Executed;

        // Execute treasury call if treasury is set and execution data exists
        if (
            address(treasury) != address(0) && proposal.executionData.length > 0
        ) {
            treasury.executeProposal(proposalId, proposal.executionData);
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Get proposal details
     * @param proposalId ID of the proposal
     */
    function getProposal(
        uint256 proposalId
    )
        external
        view
        validProposal(proposalId)
        returns (
            uint256 id,
            address proposer,
            string memory description,
            uint256 startBlock,
            uint256 endBlock,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            ProposalState state
        )
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.description,
            proposal.startBlock,
            proposal.endBlock,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.state
        );
    }

    /**
     * @notice Check if a user has voted on a proposal
     * @param proposalId ID of the proposal
     * @param voter Address of the voter
     */
    function hasVoted(
        uint256 proposalId,
        address voter
    ) external view validProposal(proposalId) returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }

    /**
     * @notice Get the vote choice of a user for a proposal
     * @param proposalId ID of the proposal
     * @param voter Address of the voter
     */
    function getVote(
        uint256 proposalId,
        address voter
    ) external view validProposal(proposalId) returns (VoteChoice) {
        require(proposals[proposalId].hasVoted[voter], "User has not voted");
        return proposals[proposalId].voterChoice[voter];
    }

    /**
     * @notice Get the current state of a proposal
     * @param proposalId ID of the proposal
     */
    function getProposalState(
        uint256 proposalId
    ) external view validProposal(proposalId) returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];

        if (
            proposal.state == ProposalState.Pending &&
            block.number >= proposal.startBlock
        ) {
            return ProposalState.Active;
        }

        return proposal.state;
    }

    // Admin functions

    /**
     * @notice Set the treasury contract address
     * @param _treasury Address of the treasury contract
     */
    function setTreasury(address _treasury) external onlyOwner {
        treasury = ITreasury(_treasury);
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Update voting period
     * @param _votingPeriod New voting period in blocks
     */
    function setVotingPeriod(uint256 _votingPeriod) external onlyOwner {
        require(_votingPeriod > 0, "Voting period must be positive");
        votingPeriod = _votingPeriod;
        emit VotingPeriodUpdated(_votingPeriod);
    }

    /**
     * @notice Update quorum requirement
     * @param _quorum New quorum requirement
     */
    function setQuorum(uint256 _quorum) external onlyOwner {
        require(_quorum > 0, "Quorum must be positive");
        quorum = _quorum;
        emit QuorumUpdated(_quorum);
    }

    /**
     * @notice Pause/unpause the contract
     * @param _paused New pause state
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedStateChanged(_paused);
    }

    /**
     * @notice Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner address");
        owner = newOwner;
    }

    // Internal functions

    function _isVotingActive(
        Proposal storage proposal
    ) internal view returns (bool) {
        return
            (proposal.state == ProposalState.Active ||
                (proposal.state == ProposalState.Pending &&
                    block.number >= proposal.startBlock)) &&
            block.number <= proposal.endBlock;
    }
}
