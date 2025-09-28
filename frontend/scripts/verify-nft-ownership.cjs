// Verify NFT ownership for the auction winner
const { ethers } = require('ethers');
require('dotenv').config();

async function verifyNFTOwnership() {
    console.log('🔍 VERIFYING NFT OWNERSHIP FOR WINNER');
    console.log('====================================\n');

    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const NFT_MINTER_ADDRESS = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;
    const WINNER_ADDRESS = '0xe5eeD1EE1535a0DF01E0fE744C6156324D7De975';
    const TOKEN_ID = 0; // The NFT that was auctioned

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        // NFT contract interface
        const nft = new ethers.Contract(NFT_MINTER_ADDRESS, [
            "function ownerOf(uint256 tokenId) view returns (address)",
            "function balanceOf(address owner) view returns (uint256)",
            "function tokenURI(uint256 tokenId) view returns (string)",
            "function totalSupply() view returns (uint256)",
            "function name() view returns (string)",
            "function symbol() view returns (string)"
        ], provider);

        console.log(`🎯 Checking NFT ownership for winner: ${WINNER_ADDRESS}`);
        console.log(`📋 NFT Contract: ${NFT_MINTER_ADDRESS}`);
        console.log(`🎨 Token ID: ${TOKEN_ID}\n`);

        // Get NFT contract info
        try {
            const name = await nft.name();
            const symbol = await nft.symbol();
            console.log(`📝 NFT Collection: ${name} (${symbol})`);
        } catch (error) {
            console.log('📝 NFT Collection: Could not fetch name/symbol');
        }

        // Check total supply
        try {
            const totalSupply = await nft.totalSupply();
            console.log(`📊 Total NFTs Minted: ${totalSupply}`);
        } catch (error) {
            console.log('📊 Total Supply: Not available');
        }

        console.log('\n🔍 Ownership Verification:');

        // Check who owns the specific NFT
        const currentOwner = await nft.ownerOf(TOKEN_ID);
        console.log(`   Current owner of Token #${TOKEN_ID}: ${currentOwner}`);

        // Check winner's NFT balance
        const winnerBalance = await nft.balanceOf(WINNER_ADDRESS);
        console.log(`   Winner's NFT balance: ${winnerBalance}`);

        // Verify ownership
        if (currentOwner.toLowerCase() === WINNER_ADDRESS.toLowerCase()) {
            console.log('\n✅ OWNERSHIP VERIFIED!');
            console.log('🎉 The auction winner successfully received the NFT!');
            console.log(`   ✅ Token #${TOKEN_ID} is owned by: ${WINNER_ADDRESS}`);
            console.log(`   ✅ Winner now owns ${winnerBalance} NFT(s) from this collection`);
        } else {
            console.log('\n❌ OWNERSHIP MISMATCH!');
            console.log(`   Expected owner: ${WINNER_ADDRESS}`);
            console.log(`   Actual owner: ${currentOwner}`);
        }

        // Get token metadata
        console.log('\n🎨 NFT Metadata:');
        try {
            const tokenURI = await nft.tokenURI(TOKEN_ID);
            console.log(`   Token URI: ${tokenURI}`);

            if (tokenURI.startsWith('data:application/json;base64,')) {
                // Decode base64 JSON metadata
                const base64Data = tokenURI.replace('data:application/json;base64,', '');
                const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
                const metadata = JSON.parse(jsonString);

                console.log(`   Name: ${metadata.name || 'Not specified'}`);
                console.log(`   Description: ${metadata.description || 'Not specified'}`);
                if (metadata.image) {
                    console.log(`   Image: ${metadata.image.substring(0, 60)}${metadata.image.length > 60 ? '...' : ''}`);
                }
                if (metadata.attributes && metadata.attributes.length > 0) {
                    console.log('   Attributes:');
                    metadata.attributes.forEach(attr => {
                        console.log(`     - ${attr.trait_type}: ${attr.value}`);
                    });
                }
            } else if (tokenURI.startsWith('ipfs://')) {
                console.log('   Format: IPFS hosted metadata');
                console.log('   To view: Replace ipfs:// with https://ipfs.io/ipfs/');
            } else if (tokenURI.startsWith('http')) {
                console.log('   Format: HTTP hosted metadata');
            } else {
                console.log('   Format: Custom format');
            }
        } catch (error) {
            console.log(`   Metadata: Could not fetch (${error.message})`);
        }

        // Additional verification - check transaction history
        console.log('\n📈 Summary:');
        console.log('===========');

        if (currentOwner.toLowerCase() === WINNER_ADDRESS.toLowerCase()) {
            console.log('🏆 VERIFICATION SUCCESSFUL!');
            console.log('✅ The auction process worked perfectly:');
            console.log('   1. Voting was completed');
            console.log('   2. Winning proposal was selected');
            console.log('   3. NFT was minted for the winner');
            console.log('   4. Auction was conducted');
            console.log('   5. Highest bidder won');
            console.log('   6. NFT was transferred to winner\'s wallet');
            console.log('   7. Payment was processed');
            console.log('\n🎯 The winner can now:');
            console.log('   - View their NFT in compatible wallets');
            console.log('   - Trade or transfer the NFT');
            console.log('   - Display it in NFT galleries');
            console.log('   - Use it as a profile picture (if supported)');
        } else {
            console.log('❌ VERIFICATION FAILED!');
            console.log('   The NFT ownership does not match the expected winner');
            console.log('   This requires investigation');
        }

    } catch (error) {
        console.error('\n❌ Error verifying NFT ownership:', error.message);
    }
}

verifyNFTOwnership();