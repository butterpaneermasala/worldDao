// Auction Finalization Script with NFT Minting
const { ethers } = require('ethers');
require('dotenv').config();

const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
const NFT_MINTER_ADDRESS = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;

const RPC_URL = process.env.RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

console.log('🔧 Configuration:');
console.log(`   Voting: ${VOTING_ADDRESS}`);
console.log(`   Auction: ${AUCTION_ADDRESS}`);
console.log(`   NFT Minter: ${NFT_MINTER_ADDRESS}`);
console.log(`   RPC: ${RPC_URL}`);
console.log(`   Relayer Key: ${RELAYER_PRIVATE_KEY ? 'Present' : 'Missing'}`);

const votingABI = [
    "function currentPhase() view returns (uint8)",
    "function timeLeft() view returns (uint256)",
    "function finalizeWithWinner(string calldata tokenURI, string calldata svgBase64, uint8 winnerIndex)",
    "function tallies(uint256) view returns (uint256)",
    "function performUpkeep(bytes calldata performData)",
    "function checkUpkeep(bytes calldata checkData) view returns (bool upkeepNeeded, bytes memory performData)",
    "event Finalized(uint256 indexed dayIndex, uint256 indexed winningProposalId, uint256 winningVotes, uint256 tokenId, string winningTokenURI)",
    "event PhaseTransitioned(uint8 indexed newPhase, uint256 timestamp)"
];

const auctionABI = [
    "function auctionActive() view returns (bool)",
    "function nft() view returns (address)",
    "function tokenId() view returns (uint256)",
    "function highestBid() view returns (uint256)",
    "function highestBidder() view returns (address)"
];

const nftABI = [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function balanceOf(address owner) view returns (uint256)"
];

async function finalizeAuctionWithKeepup() {
    try {
        if (!RELAYER_PRIVATE_KEY) {
            console.log('❌ RELAYER_PRIVATE_KEY not found in environment variables');
            return;
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
        const voting = new ethers.Contract(VOTING_ADDRESS, votingABI, wallet);
        const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, provider);
        const nftMinter = new ethers.Contract(NFT_MINTER_ADDRESS, nftABI, provider);

        console.log('\n📊 Checking current system status...');

        // Check current phase
        const phase = await voting.currentPhase();
        const phases = ['Uploading', 'Voting', 'Bidding'];
        console.log(`   Current phase: ${phases[phase]}`);

        const timeLeft = await voting.timeLeft();
        console.log(`   Time left in current phase: ${timeLeft} seconds`);

        // Check if upkeep is needed
        console.log('\n🔄 Checking if upkeep is needed...');
        const [upkeepNeeded, performData] = await voting.checkUpkeep('0x');
        console.log(`   Upkeep needed: ${upkeepNeeded}`);

        if (upkeepNeeded) {
            console.log('\n⚡ Performing upkeep (phase transition)...');
            const upkeepTx = await voting.performUpkeep(performData);
            console.log(`   Transaction hash: ${upkeepTx.hash}`);

            const receipt = await upkeepTx.wait();
            console.log(`   ✅ Upkeep completed! Gas used: ${receipt.gasUsed}`);

            // Wait a moment for state to update
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check new phase
            const newPhase = await voting.currentPhase();
            console.log(`   New phase: ${phases[newPhase]}`);
        }

        // If we're in voting phase and time is up, we need to finalize with winner
        const currentPhase = await voting.currentPhase();

        if (currentPhase === 1) { // Voting phase
            const currentTimeLeft = await voting.timeLeft();

            if (Number(currentTimeLeft) === 0) {
                console.log('\n🏆 Voting ended! Finding winner and finalizing...');

                // Find winner (slot with highest votes)
                let winnerSlot = 0;
                let highestVotes = 0;

                for (let i = 0; i < 20; i++) {
                    try {
                        const tally = await voting.tallies(i);
                        const votes = Number(tally);
                        console.log(`   Slot ${i}: ${votes} votes`);

                        if (votes > highestVotes) {
                            highestVotes = votes;
                            winnerSlot = i;
                        }
                    } catch (error) {
                        console.log(`   Slot ${i}: Error reading tally`);
                    }
                }

                console.log(`🥇 Winner: Slot ${winnerSlot} with ${highestVotes} votes`);

                // Prepare finalization data
                const timestamp = Math.floor(Date.now() / 1000);
                const tokenURI = `ipfs://QmWinner${winnerSlot}Hash${timestamp}`;

                // Create a simple SVG for the winner
                const svgContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="200" fill="#${Math.floor(Math.random() * 16777215).toString(16)}"/>
                    <circle cx="100" cy="100" r="80" fill="white"/>
                    <text x="100" y="110" text-anchor="middle" font-size="20" fill="black">Winner</text>
                    <text x="100" y="130" text-anchor="middle" font-size="16" fill="black">Slot ${winnerSlot}</text>
                </svg>`;

                const svgBase64 = Buffer.from(svgContent).toString('base64');

                console.log('\n🔨 Finalizing with winner...');
                console.log(`   Token URI: ${tokenURI}`);
                console.log(`   Winner Slot: ${winnerSlot}`);

                const finalizeTx = await voting.finalizeWithWinner(tokenURI, svgBase64, winnerSlot);
                console.log(`   Finalization transaction: ${finalizeTx.hash}`);

                const receipt = await finalizeTx.wait();
                console.log(`   ✅ Finalization successful! Gas used: ${receipt.gasUsed}`);

                // Wait for state update
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // Check final status
        console.log('\n📈 Final Status Check:');

        const finalPhase = await voting.currentPhase();
        console.log(`   Final phase: ${phases[finalPhase]}`);

        if (finalPhase === 2) { // Bidding phase
            console.log('\n💰 Auction Status:');
            const isAuctionActive = await auction.auctionActive();
            console.log(`   Auction active: ${isAuctionActive}`);

            if (isAuctionActive) {
                try {
                    const tokenId = await auction.tokenId();
                    console.log(`   Token ID being auctioned: ${tokenId}`);

                    const highestBid = await auction.highestBid();
                    const highestBidder = await auction.highestBidder();

                    console.log(`   Highest bid: ${ethers.formatEther(highestBid)} ETH`);
                    console.log(`   Highest bidder: ${highestBidder}`);

                    // Check NFT ownership
                    const nftOwner = await nftMinter.ownerOf(tokenId);
                    console.log(`   NFT owner: ${nftOwner}`);

                    if (nftOwner.toLowerCase() === AUCTION_ADDRESS.toLowerCase()) {
                        console.log(`   ✅ NFT successfully in auction contract`);
                    } else {
                        console.log(`   ⚠️  NFT not in auction contract`);
                    }

                } catch (error) {
                    console.log(`   ⚠️  Could not get auction details: ${error.message}`);
                }
            }

            console.log('\n✅ Auction finalization and NFT minting process completed!');
            console.log('🎯 You can now bid on the NFT in the bidding phase.');

        } else {
            console.log('\n⚠️  Not yet in bidding phase. Current phase:', phases[finalPhase]);
        }

    } catch (error) {
        console.error('❌ Error during finalization:', error.message);
        console.error('Full error:', error);
    }
}

finalizeAuctionWithKeepup().catch(console.error);