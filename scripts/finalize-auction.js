// Auction Finalization Script
const { ethers } = require('ethers');
require('dotenv').config();

const VOTING_ADDRESS = '0xE8f5Cc47813466C67196B20504C1decB8B8F913c';
const AUCTION_ADDRESS = '0x41F8031297ec34b9ba0771e149D272977eD43D35';
const NFT_MINTER_ADDRESS = '0x277b3a1dD185713C32C1FB5958E7188219Bfc002';

const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

const votingABI = [
    "function currentPhase() view returns (uint8)",
    "function timeLeft() view returns (uint256)",
    "function finalizeWithWinner(string calldata tokenURI, string calldata svgBase64, uint8 winnerIndex)",
    "function tallies(uint256) view returns (uint256)",
    "event Finalized(uint256 indexed dayIndex, uint256 indexed winningProposalId, uint256 winningVotes, uint256 tokenId, string winningTokenURI)"
];

const auctionABI = [
    "function auctionActive() view returns (bool)",
    "function nft() view returns (address)",
    "function tokenId() view returns (uint256)"
];

const nftABI = [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)"
];

async function finalizeAuction() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const voting = new ethers.Contract(VOTING_ADDRESS, votingABI, wallet);
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, provider);
    const nftMinter = new ethers.Contract(NFT_MINTER_ADDRESS, nftABI, provider);

    // Check current phase
    const phase = await voting.currentPhase();
    const phases = ['Uploading', 'Voting', 'Bidding'];

    console.log(`📊 Current phase: ${phases[phase]}`);

    if (phase !== 1) {
        console.log('❌ Not in voting phase!');
        return;
    }

    const timeLeft = await voting.timeLeft();
    console.log(`⏰ Time left in voting: ${timeLeft} seconds`);

    if (Number(timeLeft) > 0) {
        console.log('⏳ Voting phase not ended yet. Wait for it to end or trigger transition.');
        return;
    }

    // Find winner (slot with highest votes)
    console.log('\n🏆 Finding winner...');
    let winnerSlot = 0;
    let highestVotes = 0;

    for (let i = 0; i < 20; i++) {
        const tally = await voting.tallies(i);
        console.log(`   Slot ${i}: ${tally} votes`);

        if (Number(tally) > highestVotes) {
            highestVotes = Number(tally);
            winnerSlot = i;
        }
    }

    console.log(`🥇 Winner: Slot ${winnerSlot} with ${highestVotes} votes`);

    // Prepare finalization data
    const tokenURI = `ipfs://QmWinner${winnerSlot}Hash${Date.now()}`;

    // Create a simple SVG for the winner
    const svgContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#${Math.floor(Math.random() * 16777215).toString(16)}"/>
        <circle cx="100" cy="100" r="80" fill="white"/>
        <text x="100" y="110" text-anchor="middle" font-size="24" fill="black">Winner ${winnerSlot}</text>
    </svg>`;

    const svgBase64 = Buffer.from(svgContent).toString('base64');

    console.log('\n🔨 Finalizing with winner...');
    console.log(`📄 Token URI: ${tokenURI}`);
    console.log(`🎨 SVG Base64 length: ${svgBase64.length} chars`);

    try {
        const tx = await voting.finalizeWithWinner(tokenURI, svgBase64, winnerSlot);
        console.log(`📤 Finalization transaction: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`✅ Finalization successful! Gas used: ${receipt.gasUsed}`);

        // Check if NFT was minted
        console.log('\n🎨 Checking NFT minting...');

        try {
            const nftOwner = await nftMinter.ownerOf(0);
            console.log(`🏆 NFT #0 owner: ${nftOwner}`);

            if (nftOwner.toLowerCase() === AUCTION_ADDRESS.toLowerCase()) {
                console.log(`✅ NFT successfully transferred to auction contract`);
            } else {
                console.log(`⚠️  NFT owner is not auction contract`);
            }

            const uri = await nftMinter.tokenURI(0);
            console.log(`📋 Token URI: ${uri}`);

        } catch (error) {
            console.log(`❌ Could not check NFT: ${error.message}`);
        }

        // Check auction status
        console.log('\n💰 Checking auction status...');
        const isAuctionActive = await auction.auctionActive();
        console.log(`🔥 Auction active: ${isAuctionActive}`);

        if (isAuctionActive) {
            console.log(`✅ Auction successfully started!`);
            console.log(`🎯 Phase should now be: Bidding`);
        }

    } catch (error) {
        console.log(`❌ Finalization failed: ${error.message}`);

        if (error.message.includes('not ended')) {
            console.log('ℹ️  Voting phase has not ended yet');
        } else if (error.message.includes('wrong winner')) {
            console.log('ℹ️  Winner calculation mismatch - check tally computation');
        }
    }
}

finalizeAuction().catch(console.error);