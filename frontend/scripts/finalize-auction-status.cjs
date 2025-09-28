const { ethers } = require('ethers');
const fs = require('fs');

async function finalizeAuction() {
    console.log('🏁 Finalizing the completed auction...\n');

    try {
        require('dotenv').config();
        const auctionABI = JSON.parse(fs.readFileSync('./abis/NFTAuction.json', 'utf8'));

        const provider = new ethers.JsonRpcProvider('https://worldchain-sepolia.g.alchemy.com/public', {
            name: 'World Chain Sepolia',
            chainId: 4801
        });

        const auctionAddress = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
        const auctionContract = new ethers.Contract(auctionAddress, auctionABI, provider);

        // Check current status
        console.log('📊 Pre-finalization Status:');
        const highestBid = await auctionContract.highestBid();
        const highestBidder = await auctionContract.highestBidder();
        const tokenId = await auctionContract.tokenId();
        const auctionActive = await auctionContract.auctionActive();
        const auctionEndTime = await auctionContract.auctionEndTime();

        console.log('  Token ID:', tokenId.toString());
        console.log('  Highest Bid:', ethers.formatEther(highestBid), 'ETH');
        console.log('  Highest Bidder:', highestBidder);
        console.log('  Auction Active:', auctionActive);
        console.log('  End Time:', new Date(Number(auctionEndTime) * 1000).toLocaleString());

        const now = Math.floor(Date.now() / 1000);
        const timeLeft = Number(auctionEndTime) - now;
        console.log('  Time Status:', timeLeft > 0 ? `${timeLeft} seconds left` : 'ENDED');

        if (highestBidder === ethers.ZeroAddress) {
            console.log('\n❌ No bids placed - nothing to finalize');
            return;
        }

        if (timeLeft > 0) {
            console.log('\n⏳ Auction still active - cannot finalize yet');
            return;
        }

        // Check if we can call performUpkeep (this should finalize the auction)
        console.log('\n🔄 Checking if upkeep is needed...');
        try {
            const [upkeepNeeded, performData] = await auctionContract.checkUpkeep('0x');
            console.log('  Upkeep Needed:', upkeepNeeded);

            if (upkeepNeeded) {
                console.log('\n🎯 Auction ready for finalization!');
                console.log('\n✨ NEXT STEPS TO COMPLETE THE AUCTION:');
                console.log('1. Connect your wallet with operator permissions');
                console.log('2. Call performUpkeep() to finalize the auction');
                console.log('3. This will:');
                console.log('   • End the current auction');
                console.log('   • Mint NFT Token ID', tokenId.toString(), 'to winner:', highestBidder);
                console.log('   • Transfer', ethers.formatEther(highestBid), 'ETH to beneficiary');
                console.log('   • Prepare system for next voting cycle');

                console.log('\n💡 TO FINALIZE MANUALLY:');
                console.log('   Open your browser console on the bidding page and run:');
                console.log(`   window.finalizeAuction()`);
                console.log('\n   OR use the "Finalize Auction" button if available');

            } else {
                console.log('\n⚠️  Upkeep not needed');
                console.log('   Possible reasons:');
                console.log('   • Auction already finalized');
                console.log('   • Conditions not met');
                console.log('   • System in different phase');
            }

        } catch (checkError) {
            console.log('❌ Error checking upkeep:', checkError.message);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

finalizeAuction();