// Simple Auction Status Check
const { ethers } = require('ethers');
require('dotenv').config();

async function quickStatusCheck() {
    console.log('🎯 Quick Auction Status Check');

    const RPC_URL = process.env.RPC_URL;
    const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
    const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        // Simple phase check
        const voting = new ethers.Contract(VOTING_ADDRESS, [
            "function currentPhase() view returns (uint8)"
        ], provider);

        const phase = await voting.currentPhase();
        const phases = ['Uploading', 'Voting', 'Bidding'];

        console.log(`Current Phase: ${phases[phase]} (${phase})`);

        if (phase === 2) {
            // Check auction
            const auction = new ethers.Contract(AUCTION_ADDRESS, [
                "function auctionActive() view returns (bool)"
            ], provider);

            const isActive = await auction.auctionActive();
            console.log(`Auction Active: ${isActive}`);

            if (isActive) {
                console.log('\n✅ SUCCESS! Auction has been finalized and NFT minted!');
                console.log('🎉 The relayer successfully performed upkeep');
                console.log('💰 Bidding is now active');
            } else {
                console.log('\n❌ Phase is bidding but auction not active');
            }
        } else {
            console.log('\n⏳ Still need to complete finalization');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

quickStatusCheck();