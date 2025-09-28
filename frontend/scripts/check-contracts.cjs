// System Status Checker
const { ethers } = require('ethers');
require('dotenv').config();

const VOTING_ADDRESS = '0xE8f5Cc47813466C67196B20504C1decB8B8F913c';
const AUCTION_ADDRESS = '0x41F8031297ec34b9ba0771e149D272977eD43D35';
const NFT_MINTER_ADDRESS = '0x277b3a1dD185713C32C1FB5958E7188219Bfc002';
const TREASURY_ADDRESS = '0x09D96fCC17b16752ec3673Ea85B9a6fea697f697';

const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';

const votingABI = [
    "function currentPhase() view returns (uint8)",
    "function phaseEnd() view returns (uint256)",
    "function timeLeft() view returns (uint256)",
    "function tallies(uint256) view returns (uint256)"
];

const auctionABI = [
    "function auctionActive() view returns (bool)",
    "function auctionEndTime() view returns (uint256)",
    "function highestBidder() view returns (address)",
    "function highestBid() view returns (uint256)",
    "function beneficiary() view returns (address)"
];

const treasuryABI = [
    "function getETHBalance() view returns (uint256)",
    "function governor() view returns (address)"
];

async function checkSystemStatus() {
    console.log('🔍 === WORLDDAO SYSTEM STATUS ===');
    console.log(`📅 ${new Date().toLocaleString()}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const voting = new ethers.Contract(VOTING_ADDRESS, votingABI, provider);
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, provider);
    const treasury = new ethers.Contract(TREASURY_ADDRESS, treasuryABI, provider);

    try {
        // === VOTING CONTRACT STATUS ===
        console.log('🗳️  === VOTING CONTRACT ===');
        console.log(`📍 Address: ${VOTING_ADDRESS}`);

        const phase = await voting.currentPhase();
        const phaseEnd = await voting.phaseEnd();
        const timeLeft = await voting.timeLeft();

        const phases = ['Uploading', 'Voting', 'Bidding'];
        const currentPhase = phases[phase];

        console.log(`📊 Current Phase: ${currentPhase}`);
        console.log(`⏰ Phase End: ${new Date(Number(phaseEnd) * 1000).toLocaleString()}`);
        console.log(`⏳ Time Left: ${timeLeft} seconds`);

        if (phase === 1) { // Voting phase
            console.log('\n📈 Vote Tallies:');
            for (let i = 0; i < 5; i++) {
                const tally = await voting.tallies(i);
                if (Number(tally) > 0) {
                    console.log(`   Slot ${i}: ${tally} votes`);
                }
            }
        }

        // === AUCTION CONTRACT STATUS ===
        console.log('\n💰 === AUCTION CONTRACT ===');
        console.log(`📍 Address: ${AUCTION_ADDRESS}`);

        const isAuctionActive = await auction.auctionActive();
        const beneficiary = await auction.beneficiary();

        console.log(`🔥 Auction Active: ${isAuctionActive}`);
        console.log(`🏦 Beneficiary: ${beneficiary}`);

        if (beneficiary.toLowerCase() === TREASURY_ADDRESS.toLowerCase()) {
            console.log(`✅ Treasury correctly set as beneficiary`);
        } else {
            console.log(`⚠️  Warning: Beneficiary is not Treasury!`);
        }

        if (isAuctionActive) {
            const auctionEndTime = await auction.auctionEndTime();
            const highestBidder = await auction.highestBidder();
            const highestBid = await auction.highestBid();

            const auctionTimeLeft = Number(auctionEndTime) - Math.floor(Date.now() / 1000);

            console.log(`⏰ Auction End: ${new Date(Number(auctionEndTime) * 1000).toLocaleString()}`);
            console.log(`⏳ Time Left: ${Math.max(0, auctionTimeLeft)} seconds`);
            console.log(`🏆 Highest Bidder: ${highestBidder || 'None'}`);
            console.log(`💎 Highest Bid: ${ethers.formatEther(highestBid || 0)} ETH`);
        }

        // === TREASURY STATUS ===
        console.log('\n🏦 === TREASURY CONTRACT ===');
        console.log(`📍 Address: ${TREASURY_ADDRESS}`);

        const treasuryBalance = await treasury.getETHBalance();
        const governor = await treasury.governor();

        console.log(`💰 ETH Balance: ${ethers.formatEther(treasuryBalance)} ETH`);
        console.log(`👑 Governor: ${governor}`);

        // === NFT STATUS ===
        console.log('\n🎨 === NFT MINTER ===');
        console.log(`📍 Address: ${NFT_MINTER_ADDRESS}`);

        try {
            const nftCode = await provider.getCode(NFT_MINTER_ADDRESS);
            if (nftCode === '0x') {
                console.log('❌ Contract not deployed');
            } else {
                console.log('✅ Contract deployed');
            }
        } catch (error) {
            console.log(`⚠️  Could not check NFT contract: ${error.message}`);
        }

        // === RECOMMENDATIONS ===
        console.log('\n💡 === RECOMMENDATIONS ===');

        if (phase === 0) { // Uploading
            console.log('📤 System is in Uploading phase');
            console.log('   → Wait for automatic transition to Voting phase');
        } else if (phase === 1) { // Voting
            if (Number(timeLeft) > 0) {
                console.log('🗳️  Voting is active');
                console.log('   → Cast votes using: node scripts/test-voting.js');
            } else {
                console.log('⏰ Voting phase ended');
                console.log('   → Finalize auction: node scripts/finalize-auction.js');
            }
        } else if (phase === 2) { // Bidding
            if (isAuctionActive) {
                console.log('💰 Auction is active');
                console.log('   → Place bids using: node scripts/test-bidding.js');
            } else {
                console.log('🏁 Auction ended');
                console.log('   → Wait for next cycle or trigger new phase');
            }
        }

        console.log('\n🔄 To trigger phase transitions: node scripts/trigger-phase.js');
        console.log('🧪 To run complete flow test: node scripts/test-complete-flow.js');

    } catch (error) {
        console.log(`❌ Error checking system status: ${error.message}`);
    }
}

checkSystemStatus().catch(console.error);