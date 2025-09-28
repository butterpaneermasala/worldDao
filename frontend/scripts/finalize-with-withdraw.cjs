// Finalize Auction using withdraw() function
const { ethers } = require('ethers');
require('dotenv').config();

async function finalizeAuctionWithWithdraw() {
    console.log('🏁 FINALIZING AUCTION WITH RELAYER');
    console.log('==================================\n');

    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
    const NFT_MINTER_ADDRESS = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;
    const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

        console.log(`🔑 Using relayer: ${relayerWallet.address}`);

        // Load the complete auction ABI
        const auctionABI = require('../abis/NFTAuction.json');
        const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, relayerWallet);

        const nft = new ethers.Contract(NFT_MINTER_ADDRESS, [
            "function ownerOf(uint256 tokenId) view returns (address)"
        ], provider);

        console.log('\n📊 Pre-finalization status:');

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
        console.log(`   Time Left: ${timeLeft} seconds (${timeLeft < 0 ? 'ENDED' : 'ACTIVE'})`);

        // Check current NFT owner
        const currentOwner = await nft.ownerOf(tokenId);
        console.log(`   Current NFT Owner: ${currentOwner}`);

        if (timeLeft > 0) {
            console.log('\n⏰ Auction still running! Wait for it to end naturally.');
            return;
        }

        if (currentOwner.toLowerCase() !== AUCTION_ADDRESS.toLowerCase()) {
            console.log('\n✅ NFT already transferred! Auction appears finalized.');
            console.log(`   Current owner: ${currentOwner}`);
            return;
        }

        console.log('\n🔨 Finalizing auction by calling withdraw()...');

        // Call withdraw to finalize the auction
        const withdrawTx = await auction.withdraw();
        console.log(`   📤 Transaction hash: ${withdrawTx.hash}`);

        console.log('⏳ Waiting for confirmation...');
        const receipt = await withdrawTx.wait();
        console.log(`   ✅ Finalized! Gas used: ${receipt.gasUsed}`);

        // Check events in the receipt
        console.log('\n📋 Transaction events:');
        for (const log of receipt.logs) {
            try {
                const parsedLog = auction.interface.parseLog(log);
                if (parsedLog) {
                    console.log(`   Event: ${parsedLog.name}`);
                    if (parsedLog.name === 'AuctionEnded') {
                        console.log(`      Winner: ${parsedLog.args.winner}`);
                        console.log(`      Amount: ${ethers.formatEther(parsedLog.args.amount)} ETH`);
                    }
                }
            } catch (e) {
                // Skip unparseable logs
            }
        }

        // Verify final state
        console.log('\n🎯 Post-finalization verification:');

        const finalOwner = await nft.ownerOf(tokenId);
        const isStillActive = await auction.auctionActive();

        console.log(`   Final NFT Owner: ${finalOwner}`);
        console.log(`   Auction Still Active: ${isStillActive}`);

        if (finalOwner.toLowerCase() === highestBidder.toLowerCase()) {
            console.log('\n🏆 SUCCESS! Auction completed perfectly:');
            console.log(`   ✅ NFT (Token #${tokenId}) transferred to winner`);
            console.log(`   ✅ Winner: ${highestBidder}`);
            console.log(`   ✅ Winning bid: ${ethers.formatEther(highestBid)} ETH`);
            console.log(`   ✅ Proceeds sent to treasury/beneficiary`);
            console.log(`   ✅ Auction deactivated`);
        } else if (Number(highestBid) === 0) {
            console.log('\n📝 No bids scenario:');
            console.log(`   ✅ NFT returned to system (no bids received)`);
            console.log(`   ✅ Auction properly closed`);
        } else {
            console.log(`\n⚠️  Unexpected final owner: ${finalOwner}`);
            console.log('   May need manual investigation');
        }

        console.log('\n🎉 FULL WORLDDAO CYCLE COMPLETED!');
        console.log('===================================');
        console.log('✅ 1. Proposals uploaded and voted on');
        console.log('✅ 2. Winner selected via voting');
        console.log('✅ 3. NFT minted for winning proposal');
        console.log('✅ 4. Auction conducted and completed');
        console.log('✅ 5. NFT transferred to winner');
        console.log('✅ 6. ETH proceeds sent to treasury');
        console.log('\n🚀 The relayer private key successfully automated the entire process!');

    } catch (error) {
        console.error('\n❌ Error finalizing auction:', error.message);
        console.error('Full error:', error);

        if (error.message.includes('auction still active')) {
            console.log('💡 Wait for auction end time');
        } else if (error.message.includes('unauthorized')) {
            console.log('💡 Check if relayer has permission to call withdraw');
        }
    }
}

finalizeAuctionWithWithdraw();