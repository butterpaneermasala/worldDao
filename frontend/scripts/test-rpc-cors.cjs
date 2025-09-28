// Test RPC connection with new endpoint
const { ethers } = require('ethers');

async function testRPC() {
    console.log('🧪 Testing RPC Endpoints for CORS...');

    const endpoints = [
        'https://worldchain-sepolia.gateway.tenderly.co',
        'https://worldchain-sepolia.rpc.thirdweb.com',
        'https://worldchain-sepolia.g.alchemy.com/v2/demo'
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\nTesting: ${endpoint}`);
            const provider = new ethers.JsonRpcProvider(endpoint);
            const network = await provider.getNetwork();
            console.log(`✅ SUCCESS - Chain ID: ${network.chainId}`);

            // Test contract call
            const code = await provider.getCode('0xe8f5cc47813466c67196b20504c1decb8b8f913c');
            console.log(`✅ Contract call works - Code length: ${code.length}`);
            break;

        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
        }
    }
}

testRPC().catch(console.error);