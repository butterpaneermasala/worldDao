// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProposalContract {
    function propose(string memory description) external returns (uint256);
}

interface INFT {
    function balanceOf(address owner) external view returns (uint256);
}

contract CandidateContract {
    struct Candidate {
        uint256 id;
        address proposer;
        string description;
        uint256 sponsorCount;
        bool promoted;
    }

    uint256 public candidateCount;
    uint256 public sponsorThreshold; // e.g. 3 NFT holders required
    uint256 public constant PROPOSAL_FEE = 0.01 ether;

    address public treasury;
    address public proposalContract;
    INFT public nft;

    mapping(uint256 => Candidate) public candidates;
    mapping(uint256 => mapping(address => bool)) public hasSponsored;

    event CandidateCreated(uint256 id, address proposer, string description);
    event CandidateSponsored(uint256 id, address sponsor, uint256 sponsorCount);
    event CandidatePromoted(uint256 id, uint256 proposalId);

    constructor(
        address _proposalContract,
        address _treasury,
        address _nft,
        uint256 _sponsorThreshold
    ) {
        proposalContract = _proposalContract;
        treasury = _treasury;
        nft = INFT(_nft);
        sponsorThreshold = _sponsorThreshold;
    }

    // Step 1: Anyone can create a candidate with the fee
    function createCandidate(string memory description) external payable {
        require(msg.value == PROPOSAL_FEE, "Fee must be 0.01 ETH");

        // Send ETH to treasury
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "Fee transfer failed");

        candidateCount++;
        candidates[candidateCount] = Candidate({
            id: candidateCount,
            proposer: msg.sender,
            description: description,
            sponsorCount: 0,
            promoted: false
        });

        emit CandidateCreated(candidateCount, msg.sender, description);
    }

    // Step 2: NFT holders can sponsor a candidate
    function sponsorCandidate(uint256 candidateId) external {
        Candidate storage c = candidates[candidateId];
        require(!c.promoted, "Already promoted");
        require(nft.balanceOf(msg.sender) > 0, "Must hold NFT");
        require(!hasSponsored[candidateId][msg.sender], "Already sponsored");

        c.sponsorCount++;
        hasSponsored[candidateId][msg.sender] = true;

        emit CandidateSponsored(candidateId, msg.sender, c.sponsorCount);

        // Step 3: If threshold reached, promote to ProposalContract
        if (c.sponsorCount >= sponsorThreshold) {
            uint256 proposalId = IProposalContract(proposalContract).propose(
                c.description
            );
            c.promoted = true;
            emit CandidatePromoted(candidateId, proposalId);
        }
    }
}
