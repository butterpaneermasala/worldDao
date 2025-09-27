#!/usr/bin/env node

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;

// Read voting ABI
const ABI_PATH = path.join(process.cwd(), 'abis', 'Voting.json');
const VOTING_ABI = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));

async function checkOperator() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const voting = new ethers.Contract(VOTING_ADDRESS, VOTING_ABI, provider);

    console.log('Voting Contract:', VOTING_ADDRESS);
    console.log('RPC URL:', RPC_URL);

    try {
        const operator = await voting.operator();
        console.log('Current operator:', operator);

        const admin = await voting.admin();
        console.log('Admin:', admin);

        // Check if relayer private key matches
        const relayerKey = process.env.RELAYER_PRIVATE_KEY;
        if (relayerKey) {
            const wallet = new ethers.Wallet(relayerKey);
            console.log('Relayer address:', wallet.address);
            console.log('Operator matches relayer:', operator.toLowerCase() === wallet.address.toLowerCase());
        }

        // Check current phase
        const info = await voting.currentPhaseInfo();
        console.log('Current phase:', info[0], '(0=Setup, 1=Voting, 2=Auction)');
        console.log('Phase end time:', new Date(Number(info[1]) * 1000).toLocaleString());

    } catch (error) {
        console.error('Error checking operator:', error.message);
    }
}

checkOperator();