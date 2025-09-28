const { ethers } = require('ethers');

// Test the new rate-limited RPC setup
async function testRateLimitedRPC() {
    console.log('Testing rate-limited RPC configuration...\n');

    // RPC URLs to test
    const rpcUrls = [
        'https://worldchain-sepolia.rpc.thirdweb.com',
        'https://worldchain-sepolia.g.alchemy.com/v2/demo',
        'https://worldchain-sepolia.gateway.tenderly.co',
        'https://worldchain-sepolia.g.alchemy.com/public'
    ];

    for (let i = 0; i < rpcUrls.length; i++) {
        const rpcUrl = rpcUrls[i];
        console.log(`Testing RPC ${i + 1}: ${rpcUrl}`);

        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl, {
                chainId: 4801,
                name: 'World Chain Sepolia'
            });

            // Test basic connectivity
            const chainId = await provider.send('eth_chainId', []);
            console.log(`✅ Chain ID: ${parseInt(chainId, 16)}`);

            // Test block number
            const blockNumber = await provider.send('eth_blockNumber', []);
            console.log(`✅ Latest block: ${parseInt(blockNumber, 16)}`);

            // Test multiple rapid requests to check rate limiting
            console.log('Testing rapid requests...');
            const promises = [];
            for (let j = 0; j < 5; j++) {
                promises.push(provider.send('eth_blockNumber', []));
            }

            const results = await Promise.all(promises);
            console.log(`✅ Rapid requests successful: ${results.length} responses`);

        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
            if (error.message.includes('429')) {
                console.log('   Rate limited - provider has restrictions');
            }
        }
        console.log('');
    }
}

// Run the test
testRateLimitedRPC().catch(console.error);