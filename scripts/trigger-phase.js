// Phase Transition Trigger Script
const { ethers } = require('ethers');
require('dotenv').config();

const VOTING_ADDRESS = '0xE8f5Cc47813466C67196B20504C1decB8B8F913c';
const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

const votingABI = [
    "function currentPhase() view returns (uint8)",
    "function phaseEnd() view returns (uint256)",
    "function timeLeft() view returns (uint256)",
    "function triggerPhaseTransition()",
    "event PhaseChanged(uint8 phase, uint256 phaseEnd)"
];

async function triggerPhaseTransition() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const voting = new ethers.Contract(VOTING_ADDRESS, votingABI, wallet);

    // Get current phase info
    const phase = await voting.currentPhase();
    const phaseEnd = await voting.phaseEnd();
    const timeLeft = await voting.timeLeft();

    const phases = ['Uploading', 'Voting', 'Bidding'];
    const currentPhase = phases[phase];

    console.log('📊 Current Phase Status:');
    console.log(`   Phase: ${currentPhase}`);
    console.log(`   End Time: ${new Date(Number(phaseEnd) * 1000).toLocaleString()}`);
    console.log(`   Time Left: ${timeLeft} seconds`);

    if (Number(timeLeft) > 0) {
        console.log('⏳ Phase is still active, waiting for it to end naturally...');
        return;
    }

    console.log('⚡ Triggering phase transition...');

    try {
        const tx = await voting.triggerPhaseTransition();
        console.log(`📤 Transaction sent: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`✅ Phase transition completed! Gas used: ${receipt.gasUsed}`);

        // Get new phase info
        const newPhase = await voting.currentPhase();
        const newPhaseEnd = await voting.phaseEnd();
        const newCurrentPhase = phases[newPhase];

        console.log(`🔄 New Phase: ${newCurrentPhase}`);
        console.log(`🕐 New End Time: ${new Date(Number(newPhaseEnd) * 1000).toLocaleString()}`);

    } catch (error) {
        console.log(`❌ Phase transition failed: ${error.message}`);
    }
}

triggerPhaseTransition().catch(console.error);