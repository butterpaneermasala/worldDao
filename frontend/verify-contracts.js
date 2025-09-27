#!/usr/bin/env node

/**
 * Contract Address Verification Script
 * Run with: node verify-contracts.js
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const CONTRACTS = {
    'Voting': process.env.NEXT_PUBLIC_VOTING_ADDRESS,
    'Auction': process.env.NEXT_PUBLIC_AUCTION_ADDRESS,
    'Governor': process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS,
    'Candidate': process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS,
    'World NFT': process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS,
    'Treasury': process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
};

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://worldchain-sepolia.g.alchemy.com/public';

async function verifyContracts() {
    console.log('🔍 Verifying Contract Deployments...\n');

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        const network = await provider.getNetwork();
        console.log(`📡 Connected to: ${network.name} (Chain ID: ${network.chainId})\n`);
    } catch (err) {
        console.error('❌ Failed to connect to network:', err.message);
        return;
    }

    for (const [name, address] of Object.entries(CONTRACTS)) {
        console.log(`🔎 Checking ${name}:`);

        if (!address || address === '0x0000000000000000000000000000000000000000') {
            console.log(`   ❌ Not configured in environment`);
            console.log();
            continue;
        }

        try {
            // Check if contract exists
            const code = await provider.getCode(address);

            if (code === '0x' || code === '0x0') {
                console.log(`   ❌ No contract deployed at ${address}`);
            } else {
                console.log(`   ✅ Contract deployed at ${address}`);
                console.log(`   📊 Code size: ${Math.round(code.length / 2)} bytes`);

                // Get contract balance
                try {
                    const balance = await provider.getBalance(address);
                    console.log(`   💰 Balance: ${ethers.formatEther(balance)} ETH`);
                } catch (e) {
                    console.log(`   💰 Balance: Failed to fetch`);
                }

                // Try to get creation info (approximate)
                try {
                    const currentBlock = await provider.getBlockNumber();
                    console.log(`   🧱 Current block: ${currentBlock}`);
                } catch (e) {
                    // Skip if can't get block info
                }
            }
        } catch (err) {
            console.log(`   ❌ Error checking contract: ${err.message}`);
        }

        console.log();
    }

    console.log('🔄 To update contract addresses, edit your .env file');
    console.log('📋 Latest deployments can be found in:');
    console.log('   - contracts/world-governor/deployments/');
    console.log('   - contracts/world-treasure/deployments/');
    console.log('   - contracts/Auction/broadcast/DeployVoting.s.sol/4801/');
}

// Check if latest deployment files exist and compare
async function checkLatestDeployments() {
    console.log('\n📂 Checking Latest Deployment Files...\n');

    const paths = [
        '../contracts/world-governor/deployments',
        '../contracts/world-treasure/deployments',
        '../contracts/Auction/broadcast/DeployVoting.s.sol/4801'
    ];

    for (const deployPath of paths) {
        const fullPath = path.resolve(__dirname, deployPath);

        try {
            if (fs.existsSync(fullPath)) {
                const files = fs.readdirSync(fullPath)
                    .filter(f => f.endsWith('.json'))
                    .sort()
                    .reverse(); // Most recent first

                if (files.length > 0) {
                    console.log(`📁 ${deployPath}:`);
                    files.slice(0, 3).forEach(file => { // Show latest 3 files
                        const filePath = path.join(fullPath, file);
                        const stats = fs.statSync(filePath);
                        console.log(`   📄 ${file} (${stats.mtime.toLocaleDateString()})`);
                    });
                }
            } else {
                console.log(`📁 ${deployPath}: Directory not found`);
            }
        } catch (err) {
            console.log(`📁 ${deployPath}: Error reading - ${err.message}`);
        }
    }
}

// Run verification
async function main() {
    await verifyContracts();
    await checkLatestDeployments();

    console.log('\n✨ Verification complete!');
    console.log('💡 Tip: Run "npm run dev" and check the Contract Status on dashboard');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { verifyContracts, checkLatestDeployments };