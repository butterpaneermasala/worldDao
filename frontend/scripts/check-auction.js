#!/usr/bin/env node

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;

// Read auction ABI
const ABI_PATH = path.join(process.cwd(), 'abis', 'NFTAuction.json');
const AUCTION_ABI = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));

async function checkAuctionDetails() {
    console.log('=== AUCTION DEBUG INFO ===');
    console.log('Auction Contract:', AUCTION_ADDRESS);
    console.log('RPC URL:', RPC_URL);

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, provider);

        // Check if contract is deployed
        const code = await provider.getCode(AUCTION_ADDRESS);
        console.log('Contract deployed:', code !== '0x');

        if (code === '0x') {
            console.log('❌ Contract not deployed at this address');
            return;
        }

        // Get auction details
        const active = await contract.auctionActive();
        console.log('Auction Active:', active);

        if (active) {
            const bid = await contract.highestBid();
            const bidder = await contract.highestBidder();
            const endTime = await contract.auctionEndTime();
            const nftContract = await contract.nft();
            const tokenId = await contract.tokenId();

            console.log('Highest Bid:', ethers.formatEther(bid), 'ETH');
            console.log('Highest Bidder:', bidder);
            console.log('End Time:', new Date(Number(endTime) * 1000).toLocaleString());
            console.log('NFT Contract:', nftContract);
            console.log('Token ID:', tokenId.toString());

            const now = Math.floor(Date.now() / 1000);
            const timeLeft = Number(endTime) - now;
            console.log('Time Left:', timeLeft > 0 ? `${timeLeft} seconds` : 'ENDED');
        } else {
            console.log('❌ No active auction');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkAuctionDetails();