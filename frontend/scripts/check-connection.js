#!/usr/bin/env node
/*
  Contract Status Checker & Manual Connection Trigger
  
  This script will:
  1. Check current voting phase and results
  2. Check auction status  
  3. If voting has ended but auction hasn't started, trigger the connection
  4. Show detailed status of the voting → auction flow
*/

import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://worldchain-sepolia.g.alchemy.com/public';
const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
const NFT_MINTER_ADDRESS = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;

console.log('🔍 CHECKING CONTRACT CONNECTIONS...\n');
console.log('Configuration:');
console.log('  RPC URL:', RPC_URL);
console.log('  Voting:', VOTING_ADDRESS);
console.log('  Auction:', AUCTION_ADDRESS);
console.log('  NFT Minter:', NFT_MINTER_ADDRESS);
console.log('');

// Load ABIs
function loadABI(filename) {
    const abiPath = path.join(process.cwd(), 'abis', filename);
    try {
        return JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    } catch (e) {
        console.error(`❌ Failed to load ${filename}:`, e.message);
        return null;
    }
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Load ABIs
    const votingABI = loadABI('Voting.json');
    const auctionABI = loadABI('NFTAuction.json');

    if (!votingABI || !auctionABI) {
        console.error('❌ Missing required ABIs');
        return;
    }

    // Create contract instances
    const votingContract = new ethers.Contract(VOTING_ADDRESS, votingABI, provider);
    const auctionContract = new ethers.Contract(AUCTION_ADDRESS, auctionABI, provider);

    try {
        console.log('📊 VOTING CONTRACT STATUS:');

        // Check voting phase - function returns [phase, endTime]
        const phaseResult = await votingContract.currentPhaseInfo();
        const phase = Number(phaseResult[0]);
        const phaseEnd = Number(phaseResult[1]);
        const phaseNames = ['Uploading', 'Voting', 'Bidding'];
        const currentTime = Math.floor(Date.now() / 1000);

        console.log(`  Phase: ${phaseNames[phase]} (${phase})`);
        console.log(`  Phase End Time: ${new Date(phaseEnd * 1000).toLocaleString()}`);
        console.log(`  Current Time: ${new Date(currentTime * 1000).toLocaleString()}`);
        console.log(`  Time Left: ${Math.max(0, phaseEnd - currentTime)} seconds`);

        if (phase === 1 && currentTime >= phaseEnd) {
            console.log('  🏆 VOTING HAS ENDED - Should trigger auction!');

            // Check voting results
            console.log('\n🗳️  VOTING RESULTS:');
            const tallies = [];
            for (let i = 0; i < 20; i++) {
                try {
                    const tally = await votingContract.slotVotes(i);
                    const count = Number(tally);
                    if (count > 0) {
                        tallies.push({ index: i, votes: count });
                    }
                } catch (e) {
                    console.warn(`    Slot ${i}: Failed to read votes`);
                }
            }

            tallies.sort((a, b) => b.votes - a.votes);
            console.log('  Top voted slots:');
            tallies.slice(0, 5).forEach(slot => {
                console.log(`    Slot ${slot.index}: ${slot.votes} votes`);
            });

            if (tallies.length > 0) {
                const winner = tallies[0];
                console.log(`  🎉 Winner: Slot ${winner.index} with ${winner.votes} votes`);
            } else {
                console.log('  ⚠️  No votes found!');
            }
        }

        console.log('\n🏛️  AUCTION CONTRACT STATUS:');

        // Check auction status
        const auctionActive = await auctionContract.auctionActive();
        console.log(`  Auction Active: ${auctionActive}`);

        if (auctionActive) {
            const highestBid = await auctionContract.highestBid();
            const highestBidder = await auctionContract.highestBidder();
            const auctionEndTime = await auctionContract.auctionEndTime();
            const nftAddress = await auctionContract.nft();
            const tokenId = await auctionContract.tokenId();

            console.log(`  Highest Bid: ${ethers.formatEther(highestBid)} ETH`);
            console.log(`  Highest Bidder: ${highestBidder}`);
            console.log(`  Auction End: ${new Date(Number(auctionEndTime) * 1000).toLocaleString()}`);
            console.log(`  NFT Contract: ${nftAddress}`);
            console.log(`  Token ID: ${tokenId}`);
        } else {
            console.log('  📭 No active auction');

            // Check if voting ended but auction hasn't started
            if (phase === 1 && currentTime >= phaseEnd) {
                console.log('  🚨 ISSUE: Voting ended but auction not started!');
                console.log('  💡 The relayer should have called finalizeWithWinner()');
            }
        }

        console.log('\n🔗 CONNECTION ANALYSIS:');

        // Check if contracts are properly connected
        try {
            const operator = await auctionContract.operator();
            console.log(`  Auction Operator: ${operator}`);
            console.log(`  Expected (Voting): ${VOTING_ADDRESS}`);

            if (operator.toLowerCase() === VOTING_ADDRESS.toLowerCase()) {
                console.log('  ✅ Auction operator is correctly set to Voting contract');
            } else {
                console.log('  ❌ Auction operator is NOT set to Voting contract!');
            }
        } catch (e) {
            console.log('  ❌ Failed to check auction operator:', e.message);
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');

        if (phase === 1 && currentTime >= phaseEnd && !auctionActive) {
            console.log('  🎯 MANUAL TRIGGER NEEDED:');
            console.log('  1. Run the relayer: node scripts/relayer.js');
            console.log('  2. Or manually call finalizeWithWinner() with the winning slot');
            console.log('  3. Check that the relayer has proper permissions');
        } else if (phase === 2 && auctionActive) {
            console.log('  ✅ Everything looks good! Auction is running.');
        } else if (phase === 0) {
            console.log('  📝 Currently in Uploading phase - normal state');
        } else if (phase === 1 && currentTime < phaseEnd) {
            console.log('  🗳️  Voting is still active - wait for it to end');
        }

    } catch (error) {
        console.error('❌ Error checking contracts:', error.message);
    }
}

main().catch(console.error);