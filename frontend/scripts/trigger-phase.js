#!/usr/bin/env node
/*
  Manual Phase Trigger - since Chainlink Automation is not set up
  
  This script will manually trigger phase transitions:
  1. Check current phase and if it's expired
  2. Call performUpkeep() to advance to next phase
  3. If in voting phase and ended, call finalizeWithWinner()
*/

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const RPC_URL = process.env.RPC_URL || 'https://worldchain-sepolia.g.alchemy.com/public';
const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Add this to your .env file

if (!PRIVATE_KEY) {
    console.error('❌ Please set PRIVATE_KEY in your .env file');
    console.log('💡 You can use the deployer private key or any wallet with some ETH');
    process.exit(1);
}

console.log('🚀 MANUAL PHASE TRIGGER\n');

// Load ABI
function loadABI(filename) {
    const abiPath = path.join(process.cwd(), 'abis', filename);
    return JSON.parse(fs.readFileSync(abiPath, 'utf8'));
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Using wallet: ${wallet.address}`);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther('0.01')) {
        console.log('⚠️  Low balance - you may need more ETH for gas fees');
    }

    // Load voting contract
    const votingABI = loadABI('Voting.json');
    const votingContract = new ethers.Contract(VOTING_ADDRESS, votingABI, wallet);

    try {
        // Check current state
        const phaseResult = await votingContract.currentPhaseInfo();
        const phase = Number(phaseResult[0]);
        const phaseEnd = Number(phaseResult[1]);
        const currentTime = Math.floor(Date.now() / 1000);

        const phaseNames = ['Uploading', 'Voting', 'Bidding'];

        console.log(`\n📊 Current Status:`);
        console.log(`  Phase: ${phaseNames[phase]} (${phase})`);
        console.log(`  Phase End: ${new Date(phaseEnd * 1000).toLocaleString()}`);
        console.log(`  Current Time: ${new Date(currentTime * 1000).toLocaleString()}`);
        console.log(`  Expired: ${currentTime >= phaseEnd ? '✅ Yes' : '❌ No'}`);

        if (currentTime < phaseEnd) {
            console.log('\n✅ Phase is still active - no action needed');
            return;
        }

        // Check if upkeep is needed
        const [upkeepNeeded] = await votingContract.checkUpkeep('0x');

        if (!upkeepNeeded) {
            console.log('\n❌ Contract says upkeep not needed');
            return;
        }

        console.log('\n🔄 Phase transition needed!');

        if (phase === 0) {
            console.log('🎯 Triggering: Uploading → Voting');

            const tx = await votingContract.performUpkeep('0x');
            console.log(`Transaction hash: ${tx.hash}`);
            console.log('⏳ Waiting for confirmation...');

            await tx.wait();
            console.log('✅ Successfully moved to Voting phase!');

            // Check new state
            const newPhase = await votingContract.currentPhaseInfo();
            console.log(`New phase: ${phaseNames[Number(newPhase[0])]}`);
            console.log(`Voting ends: ${new Date(Number(newPhase[1]) * 1000).toLocaleString()}`);

        } else if (phase === 1) {
            console.log('🗳️  Voting phase has ended');
            console.log('💡 The relayer should call finalizeWithWinner() now');
            console.log('   Or you can manually trigger it using the relayer script');

        } else if (phase === 2) {
            console.log('🎯 Triggering: Bidding → Uploading (new cycle)');

            const tx = await votingContract.performUpkeep('0x');
            console.log(`Transaction hash: ${tx.hash}`);
            console.log('⏳ Waiting for confirmation...');

            await tx.wait();
            console.log('✅ Successfully started new cycle!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.message.includes('Upkeep not needed')) {
            console.log('💡 The phase transition might not be ready yet');
        } else if (error.message.includes('insufficient funds')) {
            console.log('💡 You need more ETH in your wallet for gas fees');
        }
    }
}

main().catch(console.error);