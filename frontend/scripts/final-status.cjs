// Working Auction Status Check
const { ethers } = require('ethers');
require('dotenv').config();

async function checkStatus() {
    console.log('🎯 Auction Status Check');

    // Use public RPC that works
    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
    const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
    const NFT_MINTER_ADDRESS = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        console.log('📡 Testing connection...');
        const blockNumber = await provider.getBlockNumber();
        console.log(`   Current block: ${blockNumber}`);

        // Check phase
        const voting = new ethers.Contract(VOTING_ADDRESS, [
            "function currentPhase() view returns (uint8)"
        ], provider);

        const phase = await voting.currentPhase();
        const phases = ['Uploading', 'Voting', 'Bidding'];

        console.log(`\n📊 Current Phase: ${phases[phase]} (${phase})`);

        if (phase === 2) {
            console.log('✅ System is in BIDDING phase!');

            // Check auction
            const auction = new ethers.Contract(AUCTION_ADDRESS, [
                "function auctionActive() view returns (bool)",
                "function tokenId() view returns (uint256)",
                "function highestBid() view returns (uint256)"
            ], provider);

            const isActive = await auction.auctionActive();
            console.log(`💰 Auction Active: ${isActive}`);

            if (isActive) {
                const tokenId = await auction.tokenId();
                const highestBid = await auction.highestBid();

                console.log(`   Token ID: ${tokenId}`);
                console.log(`   Highest Bid: ${ethers.formatEther(highestBid)} ETH`);

                // Check NFT ownership
                const nft = new ethers.Contract(NFT_MINTER_ADDRESS, [
                    "function ownerOf(uint256 tokenId) view returns (address)"
                ], provider);

                const owner = await nft.ownerOf(tokenId);
                console.log(`   NFT Owner: ${owner}`);

                if (owner.toLowerCase() === AUCTION_ADDRESS.toLowerCase()) {
                    console.log('\n🎉 SUCCESS! AUCTION FULLY FINALIZED!');
                    console.log('✅ NFT has been minted');
                    console.log('✅ NFT transferred to auction contract');
                    console.log('✅ Auction is active and accepting bids');
                    console.log('🔥 The relayer successfully performed upkeep and minted the NFT!');
                } else {
                    console.log('\n⚠️  NFT not in auction contract');
                }

            } else {
                console.log('\n❌ Auction not active despite being in bidding phase');
            }
        } else {
            console.log('\n⏳ Still in phase:', phases[phase]);
            console.log('   Need to complete finalization to start auction');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

checkStatus();