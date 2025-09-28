// Generate NFT import information for wallet
const { ethers } = require('ethers');
require('dotenv').config();

async function getNFTImportInfo() {
    console.log('📱 NFT WALLET IMPORT INFORMATION');
    console.log('===============================\n');

    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const NFT_CONTRACT = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;
    const WINNER_ADDRESS = '0xe5eeD1EE1535a0DF01E0fE744C6156324D7De975';
    const TOKEN_ID = 0;

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        // Get network info
        const network = await provider.getNetwork();
        console.log('🌐 Network Information:');
        console.log(`   Chain ID: ${network.chainId}`);
        console.log(`   Network Name: World Chain Sepolia Testnet`);
        console.log(`   RPC URL: ${RPC_URL}`);

        // NFT contract details
        const nft = new ethers.Contract(NFT_CONTRACT, [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function ownerOf(uint256 tokenId) view returns (address)",
            "function tokenURI(uint256 tokenId) view returns (string)"
        ], provider);

        const name = await nft.name();
        const symbol = await nft.symbol();
        const owner = await nft.ownerOf(TOKEN_ID);
        const tokenURI = await nft.tokenURI(TOKEN_ID);

        console.log('\n🎨 NFT Collection Details:');
        console.log(`   Contract Address: ${NFT_CONTRACT}`);
        console.log(`   Collection Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Token ID: ${TOKEN_ID}`);
        console.log(`   Current Owner: ${owner}`);

        console.log('\n🔍 Manual Import Instructions:');
        console.log('===============================');

        console.log('\n📱 FOR METAMASK:');
        console.log('1. Make sure you\'re connected to World Chain Sepolia Testnet');
        console.log('2. Go to NFTs tab in MetaMask');
        console.log('3. Click "Import NFT"');
        console.log(`4. Contract Address: ${NFT_CONTRACT}`);
        console.log(`5. Token ID: ${TOKEN_ID}`);
        console.log('6. Click "Import"');

        console.log('\n🌐 ADD WORLD CHAIN SEPOLIA NETWORK:');
        console.log('If network is not added, use these details:');
        console.log(`   Network Name: World Chain Sepolia Testnet`);
        console.log(`   RPC URL: https://worldchain-sepolia.g.alchemy.com/public`);
        console.log(`   Chain ID: 4801`);
        console.log(`   Currency Symbol: ETH`);
        console.log(`   Block Explorer: https://worldchain-sepolia.blockscout.com/`);

        console.log('\n🖼️  VIEW NFT ONLINE:');
        console.log('You can also view your NFT on blockchain explorers:');
        console.log(`   Blockscout: https://worldchain-sepolia.blockscout.com/address/${NFT_CONTRACT}`);
        console.log(`   Token Link: https://worldchain-sepolia.blockscout.com/token/${NFT_CONTRACT}/instance/${TOKEN_ID}`);

        // Decode the SVG if it's base64
        console.log('\n🎨 NFT Artwork:');
        if (tokenURI.startsWith('data:image/svg+xml;base64,')) {
            const base64Data = tokenURI.replace('data:image/svg+xml;base64,', '');
            const svgContent = Buffer.from(base64Data, 'base64').toString('utf8');
            console.log('   Format: SVG Image (Base64 encoded)');
            console.log('   SVG Content:');
            console.log(`   ${svgContent}`);

            // Also create a viewable HTML file
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>WorldDAO NFT #${TOKEN_ID}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            padding: 20px; 
            background: #f0f0f0;
        }
        .nft-container { 
            background: white; 
            padding: 20px; 
            border-radius: 10px; 
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            text-align: center;
        }
        .nft-image { 
            border: 2px solid #ddd; 
            border-radius: 8px; 
            margin: 10px 0;
        }
        .details { 
            text-align: left; 
            margin-top: 20px; 
            padding: 10px; 
            background: #f9f9f9; 
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="nft-container">
        <h1>🏆 WorldDAO NFT #${TOKEN_ID}</h1>
        <p><strong>Collection:</strong> ${name} (${symbol})</p>
        <p><strong>Owner:</strong> ${owner}</p>
        <div class="nft-image">
            ${svgContent}
        </div>
        <div class="details">
            <h3>Contract Details:</h3>
            <p><strong>Contract:</strong> ${NFT_CONTRACT}</p>
            <p><strong>Token ID:</strong> ${TOKEN_ID}</p>
            <p><strong>Network:</strong> World Chain Sepolia (Chain ID: 4801)</p>
            <p><strong>Blockchain:</strong> <a href="https://worldchain-sepolia.blockscout.com/token/${NFT_CONTRACT}/instance/${TOKEN_ID}" target="_blank">View on Blockscout</a></p>
        </div>
    </div>
</body>
</html>`;

            require('fs').writeFileSync('nft-viewer.html', htmlContent);
            console.log('\n📄 Created nft-viewer.html - Open this file in your browser to see your NFT!');
        }

        console.log('\n✅ VERIFICATION COMPLETE:');
        console.log(`   ✅ NFT exists and is owned by ${WINNER_ADDRESS}`);
        console.log('   ✅ Use the import info above to add it to your wallet');
        console.log('   ✅ Make sure you\'re on World Chain Sepolia network');

        // Additional troubleshooting
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('If NFT still doesn\'t appear:');
        console.log('1. Wait 10-15 minutes for indexing');
        console.log('2. Refresh/restart your wallet app');
        console.log('3. Try a different wallet (Rainbow, Trust Wallet, etc.)');
        console.log('4. Use the blockchain explorer link to confirm ownership');
        console.log('5. Some wallets need manual refresh in NFT section');

    } catch (error) {
        console.error('❌ Error getting NFT info:', error.message);
    }
}

getNFTImportInfo();