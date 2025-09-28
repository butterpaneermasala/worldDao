// Test NFT contract calls to verify the correct address
const { ethers } = require('ethers');

async function testNFTContract() {
    console.log('🧪 TESTING NFT CONTRACT CALLS');
    console.log('=============================\n');

    const provider = new ethers.JsonRpcProvider('https://worldchain-sepolia.g.alchemy.com/public');
    const NFT_CONTRACT = '0x277b3a1dd185713c32c1fb5958e7188219bfc002'; // Correct NFT Minter
    const TEST_ADDRESS = '0xe5eeD1EE1535a0DF01E0fE744C6156324D7De975'; // Winner address

    try {
        console.log(`🔍 Testing contract: ${NFT_CONTRACT}`);
        console.log(`👤 Testing address: ${TEST_ADDRESS}\n`);

        const nft = new ethers.Contract(NFT_CONTRACT, [
            "function balanceOf(address owner) view returns (uint256)",
            "function ownerOf(uint256 tokenId) view returns (address)",
            "function name() view returns (string)",
            "function symbol() view returns (string)"
        ], provider);

        // Test each function separately
        console.log('📋 Testing contract functions:\n');

        try {
            const name = await nft.name();
            console.log(`✅ name(): ${name}`);
        } catch (error) {
            console.log(`❌ name(): ${error.message}`);
        }

        try {
            const symbol = await nft.symbol();
            console.log(`✅ symbol(): ${symbol}`);
        } catch (error) {
            console.log(`❌ symbol(): ${error.message}`);
        }

        try {
            const balance = await nft.balanceOf(TEST_ADDRESS);
            console.log(`✅ balanceOf(${TEST_ADDRESS}): ${balance}`);
        } catch (error) {
            console.log(`❌ balanceOf(): ${error.message}`);
        }

        let owner = null;
        try {
            owner = await nft.ownerOf(0);
            console.log(`✅ ownerOf(0): ${owner}`);
        } catch (error) {
            console.log(`❌ ownerOf(0): ${error.message}`);
        }

        console.log('\n🎯 Contract Summary:');
        if (owner && owner.toLowerCase() === TEST_ADDRESS.toLowerCase()) {
            console.log('✅ Contract is working correctly!');
            console.log('✅ Address owns Token ID 0');
            console.log('✅ This is the correct NFT contract to use');
        } else {
            console.log('❌ Something is wrong with ownership verification');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testNFTContract();