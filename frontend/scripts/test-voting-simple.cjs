const { ethers } = require('ethers');
require('dotenv').config();

// Contract configuration
const VOTING_ADDRESS = '0xe8f5cc47813466c67196b20504c1decb8b8f913c';
const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

const votingABI = [
    "function currentPhase() view returns (uint8)",
    "function phaseEnd() view returns (uint256)",
    "function timeLeft() view returns (uint256)",
    "function vote(uint8 slotIndex) payable",
    "function tallies(uint256) view returns (uint256)",
    "event Voted(address indexed voter, uint8 indexed slotIndex, uint256 timestamp)"
];

async function testVoting() {
    console.log('🗳️ VOTING TEST');
    console.log('='.repeat(40));

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const voting = new ethers.Contract(VOTING_ADDRESS, votingABI, wallet);

    // Check current status
    const phase = await voting.currentPhase();
    const phaseEnd = await voting.phaseEnd();
    const timeLeft = await voting.timeLeft();

    const phases = ['Uploading', 'Voting', 'Bidding'];
    console.log('📊 Current Status:');
    console.log('  Phase:', phases[phase]);
    console.log('  Phase End:', new Date(Number(phaseEnd) * 1000).toLocaleString());
    console.log('  Time Left:', timeLeft.toString(), 'seconds');

    if (Number(phase) !== 1) {
        console.log('❌ Not in voting phase!');
        return;
    }

    console.log('\n📈 Current Vote Tallies:');
    for (let i = 0; i < 5; i++) {
        const tally = await voting.tallies(i);
        console.log(`  Slot ${i}: ${tally} votes`);
    }

    // Test vote (vote for slot 0)
    console.log('\n🗳️ Casting test vote for Slot 0...');
    try {
        const tx = await voting.vote(0, { value: ethers.parseEther('0') });
        console.log('  Transaction:', tx.hash);
        await tx.wait();
        console.log('  ✅ Vote cast successfully!');

        // Check updated tally
        const newTally = await voting.tallies(0);
        console.log('  New tally for Slot 0:', newTally.toString());

    } catch (error) {
        console.log('  ❌ Vote failed:', error.message);
    }
}

if (require.main === module) {
    testVoting().catch(console.error);
}

module.exports = { testVoting };