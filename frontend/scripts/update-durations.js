#!/usr/bin/env node

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// Read voting ABI
const ABI_PATH = path.join(process.cwd(), 'abis', 'Voting.json');
const VOTING_ABI = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));

async function updateDurations() {
    console.log('=== UPDATING VOTING DURATIONS ===');

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(VOTING_ADDRESS, VOTING_ABI, wallet);

        console.log('Wallet address:', wallet.address);
        console.log('Voting contract:', VOTING_ADDRESS);

        // Get current phase
        const info = await contract.currentPhaseInfo();
        const currentPhase = Number(info[0]);
        console.log('Current phase:', currentPhase, '(0=Setup, 1=Voting, 2=Auction)');

        if (currentPhase !== 0) {
            console.log('❌ Cannot change durations - not in Setup/Upload phase');
            console.log('💡 You need to redeploy contracts or wait for next cycle');
            return;
        }

        // Set new durations (in seconds)
        const uploadDuration = parseInt(process.env.UPLOAD_DURATION) || 600;   // 10 minutes
        const votingDuration = parseInt(process.env.VOTING_DURATION) || 900;   // 15 minutes  
        const biddingDuration = parseInt(process.env.BIDDING_DURATION) || 600; // 10 minutes

        console.log('Setting durations:');
        console.log('- Upload:', uploadDuration, 'seconds (', Math.round(uploadDuration / 60), 'minutes )');
        console.log('- Voting:', votingDuration, 'seconds (', Math.round(votingDuration / 60), 'minutes )');
        console.log('- Bidding:', biddingDuration, 'seconds (', Math.round(biddingDuration / 60), 'minutes )');

        const tx = await contract.setDurations(uploadDuration, votingDuration, biddingDuration);
        console.log('Transaction sent:', tx.hash);

        const receipt = await tx.wait();
        console.log('✅ Durations updated! Gas used:', receipt.gasUsed.toString());

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

updateDurations();