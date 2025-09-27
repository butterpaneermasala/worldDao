#!/usr/bin/env node

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// Read auction ABI
const ABI_PATH = path.join(process.cwd(), 'abis', 'NFTAuction.json');
const AUCTION_ABI = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));

async function endAuction() {
    console.log('=== ENDING AUCTION ===');

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, wallet);

        console.log('Wallet address:', wallet.address);
        console.log('Auction contract:', AUCTION_ADDRESS);

        // Check if auction needs upkeep
        const needsUpkeep = await contract.checkUpkeep('0x');
        console.log('Needs upkeep:', needsUpkeep[0]);

        if (needsUpkeep[0]) {
            console.log('Calling performUpkeep...');
            const tx = await contract.performUpkeep('0x');
            console.log('Transaction sent:', tx.hash);

            const receipt = await tx.wait();
            console.log('✅ Auction ended! Gas used:', receipt.gasUsed.toString());
        } else {
            console.log('❌ Auction does not need upkeep');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

endAuction();