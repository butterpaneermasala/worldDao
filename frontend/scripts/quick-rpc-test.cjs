// Simple test to verify the new rate-limited RPC setup works
const { ethers } = require('ethers');

async function quickRPCTest() {
    console.log('Quick RPC test with Alchemy demo endpoint...\n');

    const rpcUrl = 'https://worldchain-sepolia.g.alchemy.com/v2/demo';

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, {
            chainId: 4801,
            name: 'World Chain Sepolia'
        });

        console.log('✅ Provider created');

        // Test chain ID
        const chainId = await provider.send('eth_chainId', []);
        console.log(`✅ Chain ID: ${parseInt(chainId, 16)}`);

        // Test latest block
        const blockNumber = await provider.send('eth_blockNumber', []);
        console.log(`✅ Latest block: ${parseInt(blockNumber, 16)}`);

        console.log('\n🎯 RPC provider is working correctly!');
        console.log('You can now refresh your browser and try the bidding page again.');

    } catch (error) {
        console.error('❌ RPC test failed:', error.message);
    }
}

quickRPCTest();