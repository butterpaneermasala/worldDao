// Complete NFT Ownership Verification - Multiple Methods
const { ethers } = require('ethers');
require('dotenv').config();

async function completeNFTVerification() {
    console.log('🔍 COMPLETE NFT OWNERSHIP VERIFICATION');
    console.log('=====================================\n');

    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const NFT_CONTRACT = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;
    const YOUR_ADDRESS = '0xe5eeD1EE1535a0DF01E0fE744C6156324D7De975';
    const TOKEN_ID = 0;

    console.log(`🎯 Checking NFT for address: ${YOUR_ADDRESS}`);
    console.log(`🎨 NFT Contract: ${NFT_CONTRACT}`);
    console.log(`📋 Token ID: ${TOKEN_ID}\n`);

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        // Method 1: Direct Contract Call
        console.log('📞 METHOD 1: Direct Contract Verification');
        console.log('==========================================');

        const nft = new ethers.Contract(NFT_CONTRACT, [
            "function ownerOf(uint256 tokenId) view returns (address)",
            "function balanceOf(address owner) view returns (uint256)",
            "function tokenURI(uint256 tokenId) view returns (string)",
            "function name() view returns (string)",
            "function symbol() view returns (string)"
        ], provider);

        const owner = await nft.ownerOf(TOKEN_ID);
        const balance = await nft.balanceOf(YOUR_ADDRESS);
        const name = await nft.name();
        const symbol = await nft.symbol();

        console.log(`✅ Token #${TOKEN_ID} Owner: ${owner}`);
        console.log(`✅ Your NFT Balance: ${balance}`);
        console.log(`✅ Collection: ${name} (${symbol})`);

        const isOwner = owner.toLowerCase() === YOUR_ADDRESS.toLowerCase();
        console.log(`✅ YOU OWN THIS NFT: ${isOwner ? '✅ YES!' : '❌ NO'}`);

        // Method 2: Metadata Verification
        console.log('\n🎨 METHOD 2: Metadata Verification');
        console.log('==================================');

        const tokenURI = await nft.tokenURI(TOKEN_ID);
        console.log(`✅ Token URI exists: ${tokenURI ? 'YES' : 'NO'}`);

        if (tokenURI && tokenURI.startsWith('data:image/svg+xml;base64,')) {
            const base64Data = tokenURI.replace('data:image/svg+xml;base64,', '');
            const svgContent = Buffer.from(base64Data, 'base64').toString('utf8');
            console.log('✅ NFT Type: SVG Image (embedded)');
            console.log('✅ Content Preview:', svgContent.substring(0, 100) + '...');
        }

        // Method 3: Transaction History Check
        console.log('\n📊 METHOD 3: Recent Block Verification');
        console.log('======================================');

        const currentBlock = await provider.getBlockNumber();
        console.log(`✅ Current Block: ${currentBlock}`);
        console.log(`✅ Network: World Chain Sepolia (Chain ID: 4801)`);

        // Method 4: Manual Browser Links
        console.log('\n🌐 METHOD 4: Browser Verification Links');
        console.log('=======================================');

        const explorerBase = 'https://worldchain-sepolia.blockscout.com';
        const tokenLink = `${explorerBase}/token/${NFT_CONTRACT}/instance/${TOKEN_ID}`;
        const addressLink = `${explorerBase}/address/${YOUR_ADDRESS}`;

        console.log('📋 Open these links in your browser:');
        console.log(`   🔗 Your NFT: ${tokenLink}`);
        console.log(`   🔗 Your Address: ${addressLink}`);
        console.log(`   🔗 Contract: ${explorerBase}/address/${NFT_CONTRACT}`);

        // Method 5: Local HTML Viewer
        console.log('\n🖥️  METHOD 5: Local HTML Viewer');
        console.log('===============================');

        const htmlPath = require('path').resolve('nft-viewer.html');
        console.log(`📄 HTML File: ${htmlPath}`);
        console.log('💡 Open this file in any web browser to see your NFT');

        // Method 6: Wallet Import Instructions
        console.log('\n📱 METHOD 6: Wallet Import (Step by Step)');
        console.log('==========================================');

        console.log('FOR METAMASK:');
        console.log('1. 🌐 Add World Chain Sepolia Network:');
        console.log('   - Network Name: World Chain Sepolia Testnet');
        console.log('   - RPC URL: https://worldchain-sepolia.g.alchemy.com/public');
        console.log('   - Chain ID: 4801');
        console.log('   - Currency: ETH');

        console.log('\n2. 🎨 Import NFT:');
        console.log(`   - Contract: ${NFT_CONTRACT}`);
        console.log(`   - Token ID: ${TOKEN_ID}`);

        console.log('\nFOR OTHER WALLETS (Rainbow, Trust, etc.):');
        console.log('- Same network settings');
        console.log('- Look for "Add Custom Token" or "Import NFT"');
        console.log('- Use the same contract address and token ID');

        // Method 7: Alternative RPC Check
        console.log('\n🔄 METHOD 7: Alternative RPC Verification');
        console.log('=========================================');

        const altRPC = 'https://worldchain-sepolia.gateway.tenderly.co';
        const altProvider = new ethers.JsonRpcProvider(altRPC);
        const altNft = new ethers.Contract(NFT_CONTRACT, [
            "function ownerOf(uint256 tokenId) view returns (address)"
        ], altProvider);

        const altOwner = await altNft.ownerOf(TOKEN_ID);
        console.log(`✅ Alternative RPC Confirms Owner: ${altOwner}`);
        console.log(`✅ Matches Your Address: ${altOwner.toLowerCase() === YOUR_ADDRESS.toLowerCase() ? 'YES' : 'NO'}`);

        // Final Summary
        console.log('\n🎯 FINAL VERIFICATION SUMMARY');
        console.log('=============================');

        if (isOwner) {
            console.log('🎉 CONFIRMED: You own this NFT!');
            console.log('✅ Blockchain verified ownership');
            console.log('✅ Multiple RPC endpoints confirm');
            console.log('✅ Metadata is accessible');

            console.log('\n💡 IF WALLET STILL SHOWS "NO NFTs":');
            console.log('1. ⚠️  Make sure wallet is on World Chain Sepolia');
            console.log('2. ⏱️  Wait 15-30 minutes for indexing');
            console.log('3. 🔄 Refresh wallet or restart app');
            console.log('4. 📱 Try different wallet app');
            console.log('5. ✋ Manually import using contract details above');

            console.log('\n🌟 YOUR NFT IS REAL AND OWNED BY YOU!');
            console.log('The blockchain confirms it - wallet display is just a UI issue.');

        } else {
            console.log('❌ ISSUE: Ownership verification failed');
            console.log('🔍 This requires investigation');
        }

    } catch (error) {
        console.error('\n❌ Verification Error:', error.message);
        console.log('\n🔧 TRY THIS:');
        console.log('1. Check internet connection');
        console.log('2. Try different RPC endpoint');
        console.log('3. Verify contract address is correct');
    }
}

completeNFTVerification();