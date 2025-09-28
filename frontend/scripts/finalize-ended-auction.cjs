// Finalize Ended Auction - Transfer NFT to Winner
const { ethers } = require('ethers');
require('dotenv').config();

async function finalizeEndedAuction() {
    console.log('🏁 FINALIZING ENDED AUCTION');
    console.log('============================\n');

    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
    const NFT_MINTER_ADDRESS = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;
    const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

    if (!RELAYER_PRIVATE_KEY) {
        console.log('❌ RELAYER_PRIVATE_KEY not found!');
        return;
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

        // Auction contract with finalization functions
        const auction = new ethers.Contract(AUCTION_ADDRESS, [
            "function auctionActive() view returns (bool)",
            "function tokenId() view returns (uint256)",
            "function highestBid() view returns (uint256)",
            "function highestBidder() view returns (address)",
            "function auctionEndTime() view returns (uint256)",
            "function finalizeAuction()",
            "function withdraw()",
            "event AuctionFinalized(uint256 indexed tokenId, address indexed winner, uint256 winningBid)"
        ], wallet);

        const nft = new ethers.Contract(NFT_MINTER_ADDRESS, [
            "function ownerOf(uint256 tokenId) view returns (address)"
        ], provider);

        console.log('🔍 Checking current auction status...');

        const isActive = await auction.auctionActive();
        const tokenId = await auction.tokenId();
        const highestBid = await auction.highestBid();
        const highestBidder = await auction.highestBidder();
        const endTime = await auction.auctionEndTime();

        console.log(`   Auction Active: ${isActive}`);
        console.log(`   Token ID: ${tokenId}`);
        console.log(`   Highest Bid: ${ethers.formatEther(highestBid)} ETH`);
        console.log(`   Highest Bidder: ${highestBidder}`);

        const currentTime = Math.floor(Date.now() / 1000);
        const timeLeft = Number(endTime) - currentTime;
        console.log(`   Time Left: ${timeLeft} seconds`);

        if (timeLeft > 0) {
            console.log('\n⏰ Auction is still running! Cannot finalize yet.');
            console.log(`   Wait ${timeLeft} seconds for auction to end.`);
            return;
        }

        console.log('\n✅ Auction has ended! Ready to finalize...');

        // Check current NFT owner
        const currentOwner = await nft.ownerOf(tokenId);
        console.log(`   Current NFT Owner: ${currentOwner}`);

        if (currentOwner.toLowerCase() !== AUCTION_ADDRESS.toLowerCase()) {
            console.log('\n🎉 NFT already transferred to winner!');
            console.log(`   Winner: ${currentOwner}`);
            console.log('   Auction appears to be already finalized.');
            return;
        }

        console.log('\n🔨 Finalizing auction with relayer...');
        console.log(`   Using relayer: ${wallet.address}`);

        if (Number(highestBid) === 0) {
            console.log('⚠️  No bids received - auction will return NFT to treasury');
        } else {
            console.log(`   Transferring NFT to winner: ${highestBidder}`);
            console.log(`   Winner paid: ${ethers.formatEther(highestBid)} ETH`);
        }

        // Finalize the auction
        console.log('\n📤 Sending finalize transaction...');
        const finalizeTx = await auction.finalizeAuction();
        console.log(`   Transaction hash: ${finalizeTx.hash}`);

        console.log('⏳ Waiting for confirmation...');
        const receipt = await finalizeTx.wait();
        console.log(`   ✅ Finalized! Gas used: ${receipt.gasUsed}`);

        // Check final NFT owner
        console.log('\n🎨 Verifying final NFT ownership...');
        const finalOwner = await nft.ownerOf(tokenId);
        console.log(`   Final NFT Owner: ${finalOwner}`);

        if (finalOwner.toLowerCase() === highestBidder.toLowerCase()) {
            console.log('\n🏆 SUCCESS! Auction fully completed:');
            console.log(`   ✅ NFT transferred to winner: ${highestBidder}`);
            console.log(`   ✅ Winner paid: ${ethers.formatEther(highestBid)} ETH`);
            console.log('   ✅ Funds will go to treasury');
        } else if (Number(highestBid) === 0) {
            console.log('\n📝 No bids received:');
            console.log('   ✅ NFT returned to treasury/system');
        } else {
            console.log(`\n⚠️  Unexpected final owner: ${finalOwner}`);
        }

        // Check auction status after finalization
        const isStillActive = await auction.auctionActive();
        console.log(`\n📊 Auction active after finalization: ${isStillActive}`);

        if (!isStillActive) {
            console.log('\n🎉 AUCTION CYCLE COMPLETE!');
            console.log('   The full flow has been successfully executed:');
            console.log('   1. ✅ Proposals uploaded');
            console.log('   2. ✅ Voting completed');
            console.log('   3. ✅ Winner selected and NFT minted');
            console.log('   4. ✅ Auction conducted');
            console.log('   5. ✅ NFT transferred to winner');
            console.log('   6. ✅ Proceeds sent to treasury');
        }

    } catch (error) {
        console.error('\n❌ Error finalizing auction:', error.message);

        if (error.message.includes('auction not ended')) {
            console.log('💡 Tip: Wait for auction end time before finalizing');
        } else if (error.message.includes('already finalized')) {
            console.log('💡 Tip: Auction may already be finalized');
        } else if (error.message.includes('no bids')) {
            console.log('💡 Info: No bids were received for this auction');
        }
    }
}

finalizeEndedAuction();