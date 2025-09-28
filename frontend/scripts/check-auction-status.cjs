// Check Auction Status and NFT Minting
const { ethers } = require('ethers');
require('dotenv').config();

const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
const NFT_MINTER_ADDRESS = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;
const RPC_URL = process.env.RPC_URL;

const votingABI = [
    "function currentPhase() view returns (uint8)"
];

const auctionABI = [
    "function auctionActive() view returns (bool)",
    "function nft() view returns (address)",
    "function tokenId() view returns (uint256)",
    "function highestBid() view returns (uint256)",
    "function highestBidder() view returns (address)",
    "function auctionEndTime() view returns (uint256)"
];

const nftABI = [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function balanceOf(address owner) view returns (uint256)",
    "function totalSupply() view returns (uint256)"
];

async function checkAuctionStatus() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const voting = new ethers.Contract(VOTING_ADDRESS, votingABI, provider);
        const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, provider);
        const nftMinter = new ethers.Contract(NFT_MINTER_ADDRESS, nftABI, provider);

        console.log('🎯 World DAO Auction Status Check');
        console.log('================================\n');

        // Check current phase
        const phase = await voting.currentPhase();
        const phases = ['Uploading', 'Voting', 'Bidding'];
        console.log(`📊 Current Phase: ${phases[phase]}`);

        if (phase === 2) {
            console.log('✅ System is in BIDDING phase - Auction is active!\n');

            // Check auction details
            console.log('💰 Auction Details:');
            const isAuctionActive = await auction.auctionActive();
            console.log(`   Active: ${isAuctionActive}`);

            if (isAuctionActive) {
                try {
                    const tokenId = await auction.tokenId();
                    console.log(`   Token ID: ${tokenId}`);

                    const auctionEndTime = await auction.auctionEndTime();
                    const currentTime = Math.floor(Date.now() / 1000);
                    const timeLeft = Number(auctionEndTime) - currentTime;

                    console.log(`   End Time: ${new Date(Number(auctionEndTime) * 1000).toLocaleString()}`);
                    console.log(`   Time Left: ${timeLeft > 0 ? timeLeft : 0} seconds`);

                    const highestBid = await auction.highestBid();
                    const highestBidder = await auction.highestBidder();

                    console.log(`   Highest Bid: ${ethers.formatEther(highestBid)} ETH`);
                    console.log(`   Highest Bidder: ${highestBidder}`);

                    // Check NFT details
                    console.log('\n🎨 NFT Details:');
                    const nftOwner = await nftMinter.ownerOf(tokenId);
                    console.log(`   Owner: ${nftOwner}`);

                    if (nftOwner.toLowerCase() === AUCTION_ADDRESS.toLowerCase()) {
                        console.log(`   ✅ NFT is properly held by auction contract`);
                    } else {
                        console.log(`   ⚠️  NFT is not in auction contract`);
                    }

                    try {
                        const tokenURI = await nftMinter.tokenURI(tokenId);
                        console.log(`   Token URI: ${tokenURI}`);
                    } catch (error) {
                        console.log(`   Token URI: Unable to fetch (${error.message})`);
                    }

                    try {
                        const totalSupply = await nftMinter.totalSupply();
                        console.log(`   Total NFTs Minted: ${totalSupply}`);
                    } catch (error) {
                        console.log(`   Total Supply: Unable to fetch`);
                    }

                } catch (error) {
                    console.log(`   ❌ Error fetching auction details: ${error.message}`);
                }
            } else {
                console.log('   ❌ Auction is not active');
            }

        } else {
            console.log(`⚠️  System is not in bidding phase yet. Current: ${phases[phase]}`);

            if (phase === 1) {
                console.log('   The voting phase is still active.');
                console.log('   Wait for voting to end or trigger phase transition.');
            } else if (phase === 0) {
                console.log('   The uploading phase is still active.');
                console.log('   Wait for proposals to be uploaded.');
            }
        }

        console.log('\n🎯 Status Summary:');
        if (phase === 2) {
            console.log('✅ Auction has been successfully finalized!');
            console.log('✅ NFT has been minted and transferred to auction!');
            console.log('🔥 Bidding is now active - users can place bids!');
        } else {
            console.log('❌ Auction finalization is not yet complete.');
            console.log('   Need to complete the current phase first.');
        }

    } catch (error) {
        console.error('❌ Error checking auction status:', error.message);
    }
}

checkAuctionStatus().catch(console.error);