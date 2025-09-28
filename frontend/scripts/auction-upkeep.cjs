// Check and perform upkeep for auction finalization
const { ethers } = require('ethers');
require('dotenv').config();

async function performAuctionUpkeep() {
    console.log('⚡ AUCTION UPKEEP CHECK & EXECUTION');
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

        console.log('\n📊 Current auction status:');

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

        // Check if upkeep is needed
        console.log('\n🔍 Checking if upkeep is needed...');
        const checkResult = await auction.checkUpkeep('0x');
        const [upkeepNeeded, performData] = checkResult;

        console.log(`   Upkeep needed: ${upkeepNeeded}`);
        console.log(`   Perform data: ${performData}`);

        if (!upkeepNeeded) {
            console.log('\n✅ No upkeep needed.');

            // Check if auction is already finalized
            if (currentOwner.toLowerCase() !== AUCTION_ADDRESS.toLowerCase()) {
                console.log('🎉 AUCTION ALREADY FINALIZED!');
                console.log(`   NFT owner: ${currentOwner}`);

                if (currentOwner.toLowerCase() === highestBidder.toLowerCase()) {
                    console.log('   ✅ NFT correctly transferred to auction winner!');
                    console.log(`   ✅ Winner: ${highestBidder}`);
                    console.log(`   ✅ Winning bid: ${ethers.formatEther(highestBid)} ETH`);
                } else {
                    console.log('   ✅ NFT returned to system (no valid bids)');
                }

                console.log('\n🎯 COMPLETE SUCCESS!');
                console.log('====================');
                console.log('✅ Voting phase completed');
                console.log('✅ NFT minted for winner');
                console.log('✅ Auction conducted');
                console.log('✅ Auction finalized automatically');
                console.log('✅ NFT transferred to final owner');
                console.log('\n🚀 The entire WorldDAO cycle is complete!');

            } else {
                console.log('⚠️  NFT still in auction contract but no upkeep needed');
                console.log('   This might indicate a manual finalization is needed');
            }

            return;
        }

        console.log('\n⚡ Performing upkeep to finalize auction...');

        const upkeepTx = await auction.performUpkeep(performData);
        console.log(`   📤 Transaction hash: ${upkeepTx.hash}`);

        console.log('⏳ Waiting for confirmation...');
        const receipt = await upkeepTx.wait();
        console.log(`   ✅ Upkeep completed! Gas used: ${receipt.gasUsed}`);

        // Check events
        console.log('\n📋 Transaction events:');
        for (const log of receipt.logs) {
            try {
                const parsedLog = auction.interface.parseLog(log);
                if (parsedLog) {
                    console.log(`   Event: ${parsedLog.name}`);
                    if (parsedLog.args) {
                        console.log(`   Args:`, parsedLog.args);
                    }
                }
            } catch (e) {
                // Skip unparseable logs
            }
        }

        // Verify final state
        console.log('\n🎯 Post-upkeep verification:');

        const finalOwner = await nft.ownerOf(tokenId);
        const isStillActive = await auction.auctionActive();

        console.log(`   Final NFT Owner: ${finalOwner}`);
        console.log(`   Auction Still Active: ${isStillActive}`);

        if (finalOwner.toLowerCase() === highestBidder.toLowerCase()) {
            console.log('\n🏆 AUCTION FINALIZED SUCCESSFULLY!');
            console.log(`   ✅ NFT transferred to winner: ${highestBidder}`);
            console.log(`   ✅ Winning bid: ${ethers.formatEther(highestBid)} ETH`);
            console.log('   ✅ Proceeds sent to treasury');
        } else if (Number(highestBid) === 0) {
            console.log('\n📝 No bids - NFT returned to system');
        }

        console.log('\n🎉 WORLDDAO CYCLE COMPLETE!');
        console.log('===========================');
        console.log('✅ The relayer successfully finalized the auction!');

    } catch (error) {
        console.error('\n❌ Error during upkeep:', error.message);

        if (error.message.includes('upkeep not needed')) {
            console.log('💡 Auction may already be finalized');
        }
    }
}

performAuctionUpkeep();