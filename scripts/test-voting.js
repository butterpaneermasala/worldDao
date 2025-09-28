// Voting Test Script
const { ethers } = require('ethers');
require('dotenv').config();

const VOTING_ADDRESS = '0xE8f5Cc47813466C67196B20504C1decB8B8F913c';
const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

const votingABI = [
    "function currentPhase() view returns (uint8)",
    "function vote(uint8 slotIndex) payable",
    "function tallies(uint256) view returns (uint256)",
    "function timeLeft() view returns (uint256)",
    "event Voted(address indexed voter, uint8 indexed slotIndex, uint256 timestamp)"
];

async function testVoting() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const voting = new ethers.Contract(VOTING_ADDRESS, votingABI, wallet);

    // Check current phase
    const phase = await voting.currentPhase();
    const phases = ['Uploading', 'Voting', 'Bidding'];

    console.log(`📊 Current phase: ${phases[phase]}`);

    if (phase !== 1) {
        console.log('❌ Not in voting phase! Current phase:', phases[phase]);
        return;
    }

    const timeLeft = await voting.timeLeft();
    console.log(`⏰ Time left in voting: ${timeLeft} seconds`);

    // Check current tallies
    console.log('\n📈 Current vote tallies:');
    for (let i = 0; i < 5; i++) {
        const tally = await voting.tallies(i);
        console.log(`   Slot ${i}: ${tally} votes`);
    }

    // Cast a vote for slot 0
    console.log('\n🗳️  Casting vote for slot 0...');

    try {
        const tx = await voting.vote(0);
        console.log(`📤 Vote transaction: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`✅ Vote cast successfully! Gas used: ${receipt.gasUsed}`);

        // Check updated tally
        const newTally = await voting.tallies(0);
        console.log(`📊 Slot 0 now has: ${newTally} votes`);

    } catch (error) {
        console.log(`❌ Voting failed: ${error.message}`);

        if (error.message.includes('already voted')) {
            console.log('ℹ️  You have already voted in this session');
        }
    }
}

testVoting().catch(console.error);