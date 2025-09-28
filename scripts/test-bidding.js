// Auction Bidding Test Script
const { ethers } = require('ethers');
require('dotenv').config();

const AUCTION_ADDRESS = '0x41F8031297ec34b9ba0771e149D272977eD43D35';
const NFT_MINTER_ADDRESS = '0x277b3a1dD185713C32C1FB5958E7188219Bfc002';
const TREASURY_ADDRESS = '0x09D96fCC17b16752ec3673Ea85B9a6fea697f697';

const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
const BIDDER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY; // Using relayer key as test bidder

const auctionABI = [
    "function auctionActive() view returns (bool)",
    "function auctionEndTime() view returns (uint256)",
    "function highestBidder() view returns (address)",
    "function highestBid() view returns (uint256)",
    "function beneficiary() view returns (address)",
    "function bid() payable",
    "function bidAmounts(address) view returns (uint256)",
    "function performUpkeep(bytes calldata)",
    "event HighestBidIncreased(address indexed bidder, uint256 amount)"
];

const nftABI = [
    "function ownerOf(uint256 tokenId) view returns (address)"
];

const treasuryABI = [
    "function getETHBalance() view returns (uint256)"
];

async function testBidding() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(BIDDER_PRIVATE_KEY, provider);
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, wallet);
    const nftMinter = new ethers.Contract(NFT_MINTER_ADDRESS, nftABI, provider);
    const treasury = new ethers.Contract(TREASURY_ADDRESS, treasuryABI, provider);

    console.log('🏷️  === AUCTION BIDDING TEST ===');
    console.log(`🏦 Bidder: ${wallet.address}`);

    // Check auction status
    const isActive = await auction.auctionActive();
    console.log(`🔥 Auction active: ${isActive}`);

    if (!isActive) {
        console.log('❌ Auction is not active! Make sure to finalize voting first.');
        return;
    }

    // Get auction info
    const endTime = await auction.auctionEndTime();
    const currentTime = Math.floor(Date.now() / 1000);
    const timeLeft = Number(endTime) - currentTime;

    console.log(`⏰ Auction ends at: ${new Date(Number(endTime) * 1000).toLocaleString()}`);
    console.log(`⏳ Time left: ${timeLeft} seconds`);

    if (timeLeft <= 0) {
        console.log('⏰ Auction has ended! Triggering finalization...');
        await endAuction();
        return;
    }

    // Get current bid info
    const highestBid = await auction.highestBid();
    const highestBidder = await auction.highestBidder();
    const beneficiary = await auction.beneficiary();

    console.log(`💎 Current highest bid: ${ethers.formatEther(highestBid)} ETH`);
    console.log(`🏆 Current highest bidder: ${highestBidder}`);
    console.log(`🏦 Beneficiary (Treasury): ${beneficiary}`);

    // Verify treasury is beneficiary
    if (beneficiary.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
        console.log('⚠️  Warning: Beneficiary is not Treasury!');
    } else {
        console.log('✅ Treasury correctly set as beneficiary');
    }

    // Get bidder balance
    const bidderBalance = await provider.getBalance(wallet.address);
    console.log(`💰 Bidder balance: ${ethers.formatEther(bidderBalance)} ETH`);

    // Place a bid
    const bidAmount = ethers.parseEther('0.1'); // 0.1 ETH
    const currentBidAmount = await auction.bidAmounts(wallet.address);
    const newTotalBid = currentBidAmount + bidAmount;

    console.log(`\n📈 Placing bid of ${ethers.formatEther(bidAmount)} ETH...`);
    console.log(`📊 Current total bid: ${ethers.formatEther(currentBidAmount)} ETH`);
    console.log(`🎯 New total bid will be: ${ethers.formatEther(newTotalBid)} ETH`);

    if (newTotalBid <= highestBid) {
        console.log('⚠️  This bid is not higher than current highest bid!');
        console.log('💡 Try increasing the bid amount...');
        return;
    }

    try {
        const tx = await auction.bid({ value: bidAmount });
        console.log(`📤 Bid transaction: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`✅ Bid placed successfully! Gas used: ${receipt.gasUsed}`);

        // Check updated auction state
        const newHighestBid = await auction.highestBid();
        const newHighestBidder = await auction.highestBidder();

        console.log(`🎉 New highest bid: ${ethers.formatEther(newHighestBid)} ETH`);
        console.log(`🏆 New highest bidder: ${newHighestBidder}`);

        if (newHighestBidder.toLowerCase() === wallet.address.toLowerCase()) {
            console.log(`🥇 You are now the highest bidder!`);
        }

    } catch (error) {
        console.log(`❌ Bidding failed: ${error.message}`);

        if (error.message.includes('Bid too low')) {
            console.log('💡 Your bid is too low. Try a higher amount.');
        } else if (error.message.includes('No auction')) {
            console.log('💡 No active auction. Make sure auction is running.');
        }
    }
}

async function endAuction() {
    console.log('\n🏁 === ENDING AUCTION ===');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(BIDDER_PRIVATE_KEY, provider);
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, wallet);
    const nftMinter = new ethers.Contract(NFT_MINTER_ADDRESS, nftABI, provider);
    const treasury = new ethers.Contract(TREASURY_ADDRESS, treasuryABI, provider);

    // Get data before ending
    const treasuryBalanceBefore = await treasury.getETHBalance();
    const highestBidder = await auction.highestBidder();
    const highestBid = await auction.highestBid();

    console.log(`💰 Treasury balance before: ${ethers.formatEther(treasuryBalanceBefore)} ETH`);
    console.log(`🏆 Expected winner: ${highestBidder}`);
    console.log(`💎 Winning bid: ${ethers.formatEther(highestBid)} ETH`);

    try {
        const tx = await auction.performUpkeep('0x');
        console.log(`📤 Auction end transaction: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`✅ Auction ended successfully! Gas used: ${receipt.gasUsed}`);

        // Check results
        const nftOwner = await nftMinter.ownerOf(0);
        const treasuryBalanceAfter = await treasury.getETHBalance();
        const treasuryIncrease = treasuryBalanceAfter - treasuryBalanceBefore;

        console.log(`\n🎊 AUCTION RESULTS:`);
        console.log(`🎨 NFT #0 owner: ${nftOwner}`);
        console.log(`💰 Treasury balance after: ${ethers.formatEther(treasuryBalanceAfter)} ETH`);
        console.log(`📈 Treasury increase: ${ethers.formatEther(treasuryIncrease)} ETH`);

        // Verify results
        if (nftOwner.toLowerCase() === highestBidder.toLowerCase()) {
            console.log(`✅ SUCCESS: Winner correctly received NFT!`);
        } else {
            console.log(`❌ ERROR: NFT not transferred to winner!`);
        }

        if (treasuryIncrease > 0) {
            console.log(`✅ SUCCESS: Treasury received auction proceeds!`);
        } else {
            console.log(`❌ ERROR: Treasury did not receive funds!`);
        }

        console.log(`\n🎉 Auction completed successfully!`);

    } catch (error) {
        console.log(`❌ Auction end failed: ${error.message}`);
    }
}

// Check if we should end auction automatically
async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, provider);

    const isActive = await auction.auctionActive();

    if (!isActive) {
        console.log('ℹ️  No active auction to test');
        return;
    }

    const endTime = await auction.auctionEndTime();
    const currentTime = Math.floor(Date.now() / 1000);

    if (currentTime >= Number(endTime)) {
        console.log('⏰ Auction time ended, finalizing...');
        await endAuction();
    } else {
        await testBidding();
    }
}

main().catch(console.error);