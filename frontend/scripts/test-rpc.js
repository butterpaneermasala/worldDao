#!/usr/bin/env node

// Simple script to test RPC connectivity and contract deployment
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function testRPCConnectivity() {
    console.log('🔍 Testing RPC connectivity...\n');

    const rpcUrls = [
        'https://worldchain-sepolia.g.alchemy.com/public'
    ];

    for (const rpcUrl of rpcUrls) {
        console.log(`Testing RPC: ${rpcUrl}`);
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const network = await provider.getNetwork();
            const blockNumber = await provider.getBlockNumber();

            console.log(`✅ Connected - Chain ID: ${network.chainId}, Block: ${blockNumber}\n`);

            // Test contract deployment
            const votingAddress = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
            if (votingAddress) {
                const code = await provider.getCode(votingAddress);
                console.log(`Contract at ${votingAddress}: ${code !== '0x' ? 'Deployed ✅' : 'Not deployed ❌'}`);
            }

            return provider; // Return first working provider
        } catch (error) {
            console.log(`❌ Failed: ${error.message}\n`);
        }
    }

    throw new Error('No working RPC endpoints found');
}

// Run the test
testRPCConnectivity()
    .then(() => console.log('RPC connectivity test completed'))
    .catch(console.error);

export { testRPCConnectivity };