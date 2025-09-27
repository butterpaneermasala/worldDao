import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("WorldChain DAO Governance System", function () {
    let governor: any;
    let candidateContract: any;
    let mockWorldNFT: any;
    let owner: Signer;
    let voter1: Signer;
    let voter2: Signer;
    let voter3: Signer;
    let proposer: Signer;
    let nonNFTHolder: Signer;

    // Governance parameters
    const VOTING_PERIOD = 100800; // 7 days in blocks
    const VOTING_DELAY = 1;       // 1 block
    const QUORUM = 10;            // 10 minimum voters
    const SPONSOR_THRESHOLD = 3;  // 3 sponsors needed

    beforeEach(async function () {
        [owner, voter1, voter2, voter3, proposer, nonNFTHolder] = await ethers.getSigners();

        // Deploy MockWorldNFT for testing
        const MockWorldNFT = await ethers.getContractFactory("MockWorldNFT");
        mockWorldNFT = await MockWorldNFT.deploy();
        await mockWorldNFT.waitForDeployment();

        // Mint NFTs to test accounts
        await mockWorldNFT.mint(await owner.getAddress(), 5);
        await mockWorldNFT.mint(await voter1.getAddress(), 3);
        await mockWorldNFT.mint(await voter2.getAddress(), 2);
        await mockWorldNFT.mint(await voter3.getAddress(), 1);
        await mockWorldNFT.mint(await proposer.getAddress(), 1);
        // nonNFTHolder gets 0 NFTs

        // Deploy WorldChainGovernor with MockWorldNFT for testing
        const WorldChainGovernor = await ethers.getContractFactory("WorldChainGovernor");
        governor = await WorldChainGovernor.deploy(
            await mockWorldNFT.getAddress(),
            VOTING_PERIOD,
            VOTING_DELAY,
            QUORUM
        );
        await governor.waitForDeployment();

        // Deploy CandidateContract with MockWorldNFT for testing
        const CandidateContract = await ethers.getContractFactory("CandidateContract");
        candidateContract = await CandidateContract.deploy(
            await governor.getAddress(),  // proposal contract
            await owner.getAddress(),     // treasury (temporary)
            await mockWorldNFT.getAddress(),
            SPONSOR_THRESHOLD
        );
        await candidateContract.waitForDeployment();

        // Note: We'll use direct propose() calls in tests since we own the test accounts
    });

    describe("🏛️ WorldChainGovernor Deployment", function () {
        it("Should set correct initial parameters", async function () {
            expect(await governor.worldNFT()).to.equal(await mockWorldNFT.getAddress());
            expect(await governor.votingPeriod()).to.equal(VOTING_PERIOD);
            expect(await governor.votingDelay()).to.equal(VOTING_DELAY);
            expect(await governor.quorum()).to.equal(QUORUM);
            expect(await governor.owner()).to.equal(await owner.getAddress());
        });

        it("Should start with zero proposals", async function () {
            expect(await governor.proposalCount()).to.equal(0);
        });

        it("Should not be paused initially", async function () {
            expect(await governor.paused()).to.equal(false);
        });
    });

    describe("🗳️ Proposal Creation", function () {
        it("Should allow NFT holders to create proposals", async function () {
            const description = "Proposal to allocate 100 ETH for development";
            const executionData = "0x";

            const tx = await governor.connect(proposer).propose(description, executionData);

            expect(tx).to.emit(governor, "ProposalCreated");
            expect(await governor.proposalCount()).to.equal(1);

            // Check proposal was created correctly
            const proposal = await governor.proposals(1);
            expect(proposal.proposer).to.equal(await proposer.getAddress());
            expect(proposal.description).to.equal(description);
        });

        it("Should reject proposals from non-NFT holders", async function () {
            const description = "Invalid proposal";
            const executionData = "0x";

            await expect(
                governor.connect(nonNFTHolder).propose(description, executionData)
            ).to.be.revertedWith("Must hold at least 1 WorldNFT to propose");
        });

        it("Should reject empty descriptions", async function () {
            await expect(
                governor.connect(proposer).propose("", "0x")
            ).to.be.revertedWith("Description cannot be empty");
        });

        it("Should prevent multiple active proposals from same user", async function () {
            await governor.connect(proposer).propose("First proposal", "0x");

            await expect(
                governor.connect(proposer).propose("Second proposal", "0x")
            ).to.be.revertedWith("Previous proposal still active");
        });
    });

    describe("🗳️ Voting System", function () {
        let proposalId: number;

        beforeEach(async function () {
            // Create a proposal
            await governor.connect(proposer).propose("Test proposal", "0x");
            proposalId = 1;

            // Move past voting delay
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(VOTING_DELAY + 1)]);
        });

        it("Should allow NFT holders to vote", async function () {
            const voterBalance = await mockWorldNFT.balanceOf(await voter1.getAddress());

            await expect(
                governor.connect(voter1).vote(proposalId, 1) // Vote For
            ).to.emit(governor, "VoteCast")
                .withArgs(proposalId, await voter1.getAddress(), 1, voterBalance);
        });

        it("Should reject votes from non-NFT holders", async function () {
            await expect(
                governor.connect(nonNFTHolder).vote(proposalId, 1)
            ).to.be.revertedWith("Must hold at least 1 WorldNFT to vote");
        });

        it("Should prevent double voting", async function () {
            await governor.connect(voter1).vote(proposalId, 1);

            await expect(
                governor.connect(voter1).vote(proposalId, 1)
            ).to.be.revertedWith("Already voted on this proposal");
        });

        it("Should count votes correctly", async function () {
            // Get balances
            const balance1 = await mockWorldNFT.balanceOf(await voter1.getAddress());
            const balance2 = await mockWorldNFT.balanceOf(await voter2.getAddress());

            // Cast votes
            await governor.connect(voter1).vote(proposalId, 1); // For
            await governor.connect(voter2).vote(proposalId, 0); // Against

            const proposal = await governor.proposals(proposalId);
            expect(proposal.forVotes).to.equal(balance1);
            expect(proposal.againstVotes).to.equal(balance2);
        });

        it("Should handle abstain votes", async function () {
            const balance = await mockWorldNFT.balanceOf(await voter1.getAddress());

            await governor.connect(voter1).vote(proposalId, 2); // Abstain

            const proposal = await governor.proposals(proposalId);
            expect(proposal.abstainVotes).to.equal(balance);
        });
    });

    describe("⏰ Proposal Lifecycle", function () {
        let proposalId: number;

        beforeEach(async function () {
            await governor.connect(proposer).propose("Test proposal", "0x");
            proposalId = 1;
        });

        it("Should start in Pending state", async function () {
            const state = await governor.getProposalState(proposalId);
            expect(state).to.equal(0); // Pending
        });

        it("Should move to Active after delay", async function () {
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(VOTING_DELAY + 1)]);

            const state = await governor.getProposalState(proposalId);
            expect(state).to.equal(1); // Active
        });

        it("Should succeed with enough votes", async function () {
            // Move to active
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(VOTING_DELAY + 1)]);

            // Get enough votes (need at least QUORUM)
            await governor.connect(owner).vote(proposalId, 1);      // 5 votes
            await governor.connect(voter1).vote(proposalId, 1);     // 3 votes  
            await governor.connect(voter2).vote(proposalId, 1);     // 2 votes
            // Total: 10 votes (meets quorum)

            // Move past voting period
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(VOTING_PERIOD + 1)]);

            await governor.finalize(proposalId);

            const state = await governor.getProposalState(proposalId);
            expect(state).to.equal(2); // Succeeded
        });

        it("Should fail with insufficient votes", async function () {
            // Move to active
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(VOTING_DELAY + 1)]);

            // Only get a few votes (less than quorum)
            await governor.connect(voter1).vote(proposalId, 1); // 3 votes

            // Move past voting period
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(VOTING_PERIOD + 1)]);

            await governor.finalize(proposalId);

            const state = await governor.getProposalState(proposalId);
            expect(state).to.equal(3); // Defeated
        });
    });

    describe("🏆 Candidate System", function () {
        it("Should allow creating candidates with fee", async function () {
            const description = "Candidate for treasury manager";
            const fee = ethers.parseEther("0.01");

            await expect(
                candidateContract.connect(proposer).createCandidate(description, { value: fee })
            ).to.emit(candidateContract, "CandidateCreated")
                .withArgs(1, await proposer.getAddress(), description);

            expect(await candidateContract.candidateCount()).to.equal(1);
        });

        it("Should reject candidates without proper fee", async function () {
            const description = "Invalid candidate";
            const wrongFee = ethers.parseEther("0.005"); // Half the required fee

            await expect(
                candidateContract.connect(proposer).createCandidate(description, { value: wrongFee })
            ).to.be.revertedWith("Fee must be 0.01 ETH");
        });

        it("Should allow NFT holders to sponsor candidates", async function () {
            // Create candidate
            const fee = ethers.parseEther("0.01");
            await candidateContract.connect(proposer).createCandidate("Test candidate", { value: fee });

            // Sponsor the candidate
            await expect(
                candidateContract.connect(voter1).sponsorCandidate(1)
            ).to.emit(candidateContract, "CandidateSponsored")
                .withArgs(1, await voter1.getAddress(), 1);
        });

        it("Should promote candidates with enough sponsors", async function () {
            // Create candidate
            const fee = ethers.parseEther("0.01");
            await candidateContract.connect(proposer).createCandidate("Test candidate", { value: fee });

            // Get enough sponsors
            await candidateContract.connect(voter1).sponsorCandidate(1);
            await candidateContract.connect(voter2).sponsorCandidate(1);
            await candidateContract.connect(voter3).sponsorCandidate(1);

            // Should automatically promote
            const candidate = await candidateContract.candidates(1);
            expect(candidate.promoted).to.equal(true);
            expect(candidate.sponsorCount).to.equal(SPONSOR_THRESHOLD);

            // Original proposer should be able to get description for manual governance proposal
            const description = await candidateContract.getPromotedCandidateDescription(1);
            expect(description).to.equal("Test candidate");

            // Original proposer can now create a governance proposal manually
            await expect(
                governor.connect(proposer).propose(description, "0x")
            ).to.not.be.reverted;
        });

        it("Should reject non-NFT holders as sponsors", async function () {
            const fee = ethers.parseEther("0.01");
            await candidateContract.connect(proposer).createCandidate("Test candidate", { value: fee });

            await expect(
                candidateContract.connect(nonNFTHolder).sponsorCandidate(1)
            ).to.be.revertedWith("Must hold NFT");
        });

        it("Should prevent double sponsoring", async function () {
            const fee = ethers.parseEther("0.01");
            await candidateContract.connect(proposer).createCandidate("Test candidate", { value: fee });

            await candidateContract.connect(voter1).sponsorCandidate(1);

            await expect(
                candidateContract.connect(voter1).sponsorCandidate(1)
            ).to.be.revertedWith("Already sponsored");
        });
    });

    describe("🔧 Administrative Functions", function () {
        it("Should allow owner to pause contract", async function () {
            await governor.connect(owner).setPaused(true);
            expect(await governor.paused()).to.equal(true);

            // Should reject proposals when paused
            await expect(
                governor.connect(proposer).propose("Test", "0x")
            ).to.be.revertedWith("Contract is paused");
        });

        it("Should allow owner to update voting period", async function () {
            const newVotingPeriod = 50400; // 3.5 days

            await expect(
                governor.connect(owner).setVotingPeriod(newVotingPeriod)
            ).to.emit(governor, "VotingPeriodUpdated")
                .withArgs(newVotingPeriod);

            expect(await governor.votingPeriod()).to.equal(newVotingPeriod);
        });

        it("Should allow owner to update quorum", async function () {
            const newQuorum = 5;

            await expect(
                governor.connect(owner).setQuorum(newQuorum)
            ).to.emit(governor, "QuorumUpdated")
                .withArgs(newQuorum);

            expect(await governor.quorum()).to.equal(newQuorum);
        });

        it("Should reject unauthorized admin calls", async function () {
            await expect(
                governor.connect(voter1).setPaused(true)
            ).to.be.revertedWith("Not authorized");

            await expect(
                governor.connect(voter1).setVotingPeriod(12345)
            ).to.be.revertedWith("Not authorized");
        });
    });

    describe("🔗 Integration Tests", function () {
        it("Should complete full governance workflow", async function () {
            // 1. Create candidate
            const fee = ethers.parseEther("0.01");
            await candidateContract.connect(proposer).createCandidate("Treasury allocation proposal", { value: fee });

            // 2. Get sponsors
            await candidateContract.connect(voter1).sponsorCandidate(1);
            await candidateContract.connect(voter2).sponsorCandidate(1);
            await candidateContract.connect(voter3).sponsorCandidate(1);

            // 3. Create governance proposal from promoted candidate
            const candidateDescription = await candidateContract.getPromotedCandidateDescription(1);
            await governor.connect(proposer).propose(candidateDescription, "0x1234");
            const proposalId = 1;

            // 4. Vote on proposal
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(VOTING_DELAY + 1)]);

            await governor.connect(owner).vote(proposalId, 1);   // 5 votes
            await governor.connect(voter1).vote(proposalId, 1);  // 3 votes
            await governor.connect(voter2).vote(proposalId, 1);  // 2 votes
            // Total: 10 votes (meets quorum)

            // 5. Finalize proposal
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(VOTING_PERIOD + 1)]);
            await governor.finalize(proposalId);

            // 6. Verify success
            const state = await governor.getProposalState(proposalId);
            expect(state).to.equal(2); // Succeeded

            const candidate = await candidateContract.candidates(1);
            expect(candidate.promoted).to.equal(true);
        });
    });
});

// Helper function for testing events with unknown values
const anyValue = require("@nomicfoundation/hardhat-chai-matchers").anyValue;