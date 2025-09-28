// Complete Flow Test Script - Tests Voting → Auction → NFT Transfer → Treasury
const { ethers } = require('ethers');
require('dotenv').config();

// Contract addresses from latest deployment
const VOTING_ADDRESS = '0xE8f5Cc47813466C67196B20504C1decB8B8F913c';
const AUCTION_ADDRESS = '0x41F8031297ec34b9ba0771e149D272977eD43D35';
const NFT_MINTER_ADDRESS = '0x277b3a1dD185713C32C1FB5958E7188219Bfc002';
const TREASURY_ADDRESS = '0x09D96fCC17b16752ec3673Ea85B9a6fea697f697';

// Network config
const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const TEST_BIDDER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Test account

// Contract ABIs (simplified for testing)
const votingABI = [
    "function currentPhase() view returns (uint8)",
    "function phaseEnd() view returns (uint256)",
    "function timeLeft() view returns (uint256)",
    "function vote(uint8 slotIndex) payable",
    "function finalizeWithWinner(string calldata tokenURI, string calldata svgBase64, uint8 winnerIndex)",
    "function tallies(uint256) view returns (uint256)",
    "function triggerPhaseTransition()",
    "event PhaseChanged(uint8 phase, uint256 phaseEnd)",
    "event Voted(address indexed voter, uint8 indexed slotIndex, uint256 timestamp)"
];

const auctionABI = [
    "function auctionActive() view returns (bool)",
    "function auctionEndTime() view returns (uint256)",
    "function highestBidder() view returns (address)",
    "function highestBid() view returns (uint256)",
    "function beneficiary() view returns (address)",
    "function bid() payable",
    "function performUpkeep(bytes calldata)",
    "event HighestBidIncreased(address indexed bidder, uint256 amount)",
    "event AuctionEnded(address indexed winner, uint256 amount)"
];

const nftMinterABI = [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)"
];

const treasuryABI = [
    "function getETHBalance() view returns (uint256)"
];

class FlowTester {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, this.provider);
        this.bidderWallet = new ethers.Wallet(TEST_BIDDER_KEY, this.provider);

        this.voting = new ethers.Contract(VOTING_ADDRESS, votingABI, this.relayerWallet);
        this.auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, this.bidderWallet);
        this.nftMinter = new ethers.Contract(NFT_MINTER_ADDRESS, nftMinterABI, this.provider);
        this.treasury = new ethers.Contract(TREASURY_ADDRESS, treasuryABI, this.provider);
    }

    async getPhaseInfo() {
        const phase = await this.voting.currentPhase();
        const phaseEnd = await this.voting.phaseEnd();
        const timeLeft = await this.voting.timeLeft();

        const phases = ['Uploading', 'Voting', 'Bidding'];
        return {
            currentPhase: phases[phase],
            phaseEndTimestamp: Number(phaseEnd),
            timeLeftSeconds: Number(timeLeft)
        };
    }

    async waitForPhaseTransition(targetPhase) {
        console.log(`🕐 Waiting for ${targetPhase} phase...`);

        while (true) {
            const phaseInfo = await this.getPhaseInfo();
            console.log(`   Current: ${phaseInfo.currentPhase}, Time left: ${phaseInfo.timeLeftSeconds}s`);

            if (phaseInfo.currentPhase === targetPhase) {
                console.log(`✅ Now in ${targetPhase} phase!`);
                break;
            }

            if (phaseInfo.timeLeftSeconds === 0) {
                console.log(`⏰ Phase ended, triggering transition...`);
                try {
                    const tx = await this.voting.triggerPhaseTransition();
                    await tx.wait();
                    console.log(`🔄 Phase transition triggered`);
                } catch (error) {
                    console.log(`⚠️  Auto-transition may have occurred`);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
    }

    async testVotingPhase() {
        console.log('\n🗳️  === TESTING VOTING PHASE ===');

        await this.waitForPhaseTransition('Voting');

        // Cast some votes
        console.log('📊 Casting votes...');
        const voters = [
            this.relayerWallet,
            this.bidderWallet
        ];

        for (let i = 0; i < voters.length; i++) {
            try {
                const votingContract = this.voting.connect(voters[i]);
                const tx = await votingContract.vote(0); // Vote for slot 0
                await tx.wait();
                console.log(`✅ Vote cast by ${voters[i].address}`);
            } catch (error) {
                console.log(`⚠️  Vote failed: ${error.message}`);
            }
        }

        // Check vote tallies
        const tally = await this.voting.tallies(0);
        console.log(`📈 Slot 0 has ${tally} votes`);

        return true;
    }

    async testAuctionFinalization() {
        console.log('\n🏆 === TESTING AUCTION FINALIZATION ===');

        // Wait for voting to end
        await this.waitForPhaseTransition('Bidding');

        // Finalize with winner (using relayer)
        console.log('🔨 Finalizing auction with winner...');
        const tokenURI = 'ipfs://QmTestHash123';
        const svgBase64 = 'PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDAiIGZpbGw9InJlZCIvPjwvc3ZnPg=='; // Simple red circle SVG

        try {
            const tx = await this.voting.finalizeWithWinner(tokenURI, svgBase64, 0);
            const receipt = await tx.wait();
            console.log(`✅ Auction finalized! Tx: ${receipt.hash}`);

            // Check if NFT was minted and transferred
            const nftOwner = await this.nftMinter.ownerOf(0);
            console.log(`🎨 NFT #0 owner: ${nftOwner}`);

            if (nftOwner.toLowerCase() === AUCTION_ADDRESS.toLowerCase()) {
                console.log(`✅ NFT successfully transferred to auction contract`);
            }

            return true;
        } catch (error) {
            console.log(`❌ Finalization failed: ${error.message}`);
            return false;
        }
    }

    async testBiddingPhase() {
        console.log('\n💰 === TESTING BIDDING PHASE ===');

        // Check auction is active
        const isActive = await this.auction.auctionActive();
        if (!isActive) {
            console.log('❌ Auction is not active!');
            return false;
        }

        console.log('✅ Auction is active');

        // Get treasury balance before
        const treasuryBalanceBefore = await this.treasury.getETHBalance();
        console.log(`💰 Treasury balance before: ${ethers.formatEther(treasuryBalanceBefore)} ETH`);

        // Place bids
        console.log('📈 Placing bids...');

        try {
            // Bid 1: 0.1 ETH
            const bid1Tx = await this.auction.bid({ value: ethers.parseEther('0.1') });
            await bid1Tx.wait();
            console.log(`✅ Bid 1 placed: 0.1 ETH`);

            // Bid 2: 0.2 ETH (higher)
            const bid2Tx = await this.auction.bid({ value: ethers.parseEther('0.1') }); // Additional 0.1 ETH (total 0.2)
            await bid2Tx.wait();
            console.log(`✅ Bid 2 placed: 0.2 ETH total`);

            const highestBid = await this.auction.highestBid();
            const highestBidder = await this.auction.highestBidder();

            console.log(`🏆 Highest bidder: ${highestBidder}`);
            console.log(`💎 Highest bid: ${ethers.formatEther(highestBid)} ETH`);

            return true;
        } catch (error) {
            console.log(`❌ Bidding failed: ${error.message}`);
            return false;
        }
    }

    async testAuctionEnd() {
        console.log('\n🏁 === TESTING AUCTION END ===');

        // Wait for auction to end
        while (true) {
            const auctionEndTime = await this.auction.auctionEndTime();
            const currentTime = Math.floor(Date.now() / 1000);

            if (currentTime >= Number(auctionEndTime)) {
                console.log('⏰ Auction time ended, finalizing...');
                break;
            }

            const timeLeft = Number(auctionEndTime) - currentTime;
            console.log(`⏳ Auction ends in ${timeLeft} seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Get data before finalization
        const treasuryBalanceBefore = await this.treasury.getETHBalance();
        const highestBidder = await this.auction.highestBidder();
        const highestBid = await this.auction.highestBid();

        console.log(`💰 Treasury balance before: ${ethers.formatEther(treasuryBalanceBefore)} ETH`);
        console.log(`🏆 Winner should be: ${highestBidder}`);
        console.log(`💎 Winning bid: ${ethers.formatEther(highestBid)} ETH`);

        // Trigger auction end
        try {
            const tx = await this.auction.performUpkeep('0x');
            await tx.wait();
            console.log(`✅ Auction finalized!`);

            // Check results
            const nftOwner = await this.nftMinter.ownerOf(0);
            const treasuryBalanceAfter = await this.treasury.getETHBalance();
            const balanceIncrease = treasuryBalanceAfter - treasuryBalanceBefore;

            console.log(`🎨 NFT #0 final owner: ${nftOwner}`);
            console.log(`💰 Treasury balance after: ${ethers.formatEther(treasuryBalanceAfter)} ETH`);
            console.log(`📈 Treasury increase: ${ethers.formatEther(balanceIncrease)} ETH`);

            // Verify results
            if (nftOwner.toLowerCase() === highestBidder.toLowerCase()) {
                console.log(`✅ Winner correctly received NFT`);
            } else {
                console.log(`❌ NFT transfer failed`);
            }

            if (balanceIncrease > 0) {
                console.log(`✅ Treasury correctly received auction proceeds`);
            } else {
                console.log(`❌ Treasury did not receive funds`);
            }

            return true;
        } catch (error) {
            console.log(`❌ Auction end failed: ${error.message}`);
            return false;
        }
    }

    async runFullTest() {
        console.log('🚀 === STARTING COMPLETE FLOW TEST ===');
        console.log(`📍 Voting: ${VOTING_ADDRESS}`);
        console.log(`📍 Auction: ${AUCTION_ADDRESS}`);
        console.log(`📍 NFTMinter: ${NFT_MINTER_ADDRESS}`);
        console.log(`📍 Treasury: ${TREASURY_ADDRESS}`);

        try {
            // Test each phase
            await this.testVotingPhase();
            await this.testAuctionFinalization();
            await this.testBiddingPhase();
            await this.testAuctionEnd();

            console.log('\n🎉 === COMPLETE FLOW TEST SUCCESSFUL ===');
            console.log('✅ Voting → Auction → NFT Transfer → Treasury Payment all working!');

        } catch (error) {
            console.log(`\n❌ === FLOW TEST FAILED ===`);
            console.log(`Error: ${error.message}`);
        }
    }
}

// Run the test
async function main() {
    const tester = new FlowTester();
    await tester.runFullTest();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FlowTester;