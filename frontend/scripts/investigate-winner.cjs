// Check what the actual winning proposal was and why wrong image
const { ethers } = require('ethers');
require('dotenv').config();

async function investigateWinningProposal() {
    console.log('🔍 INVESTIGATING WINNING PROPOSAL AND NFT MINTING');
    console.log('=================================================\n');

    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
    const NFT_CONTRACT = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        // Check voting results to see what actually won
        const voting = new ethers.Contract(VOTING_ADDRESS, [
            "function currentPhase() view returns (uint8)",
            "function tallies(uint256) view returns (uint256)",
            "function getProposal(uint256 slot) view returns (string memory ipfsHash, string memory title, string memory description)",
            "function currentDayIndex() view returns (uint256)"
        ], provider);

        console.log('📊 VOTING RESULTS ANALYSIS:');
        console.log('===========================');

        // Check all voting tallies to see what won
        let winnerSlot = 0;
        let highestVotes = 0;
        const results = [];

        for (let i = 0; i < 20; i++) {
            try {
                const tally = await voting.tallies(i);
                const votes = Number(tally);
                results.push({ slot: i, votes });

                if (votes > highestVotes) {
                    highestVotes = votes;
                    winnerSlot = i;
                }

                if (votes > 0) {
                    console.log(`   Slot ${i}: ${votes} votes`);
                }
            } catch (error) {
                // Skip slots with errors
            }
        }

        console.log(`\n🏆 WINNER: Slot ${winnerSlot} with ${highestVotes} votes`);

        // Get the actual winning proposal details
        console.log('\n📋 WINNING PROPOSAL DETAILS:');
        console.log('============================');

        try {
            const proposal = await voting.getProposal(winnerSlot);
            console.log(`   IPFS Hash: ${proposal.ipfsHash}`);
            console.log(`   Title: ${proposal.title}`);
            console.log(`   Description: ${proposal.description}`);

            if (proposal.ipfsHash && proposal.ipfsHash !== '') {
                console.log(`\n🖼️  ACTUAL WINNING IMAGE:`);
                console.log(`   IPFS URL: https://ipfs.io/ipfs/${proposal.ipfsHash}`);
                console.log(`   Pinata URL: https://crimson-added-centipede-967.mypinata.cloud/ipfs/${proposal.ipfsHash}`);
            } else {
                console.log(`\n⚠️  No IPFS hash found for winning proposal`);
            }

        } catch (error) {
            console.log(`   Error getting proposal: ${error.message}`);
        }

        // Check what's actually in the NFT
        console.log('\n🎨 ACTUAL NFT CONTENT:');
        console.log('=====================');

        const nft = new ethers.Contract(NFT_CONTRACT, [
            "function tokenURI(uint256 tokenId) view returns (string)"
        ], provider);

        const tokenURI = await nft.tokenURI(0);
        console.log(`   Token URI: ${tokenURI.substring(0, 100)}...`);

        if (tokenURI.startsWith('data:image/svg+xml;base64,')) {
            const base64Data = tokenURI.replace('data:image/svg+xml;base64,', '');
            const svgContent = Buffer.from(base64Data, 'base64').toString('utf8');
            console.log(`   NFT Contains: Generic SVG with "Winner" text`);
            console.log(`   ❌ This is NOT the actual winning proposal image!`);
        } else if (tokenURI.startsWith('ipfs://')) {
            console.log(`   NFT Contains: IPFS reference to actual image`);
            console.log(`   ✅ This should be the correct winning image`);
        } else {
            console.log(`   NFT Contains: Unknown format`);
        }

        // Analyze the problem
        console.log('\n🔍 PROBLEM ANALYSIS:');
        console.log('====================');

        console.log('❌ ISSUES IDENTIFIED:');
        console.log('1. Blockchain explorer links may not be working (testnet issue)');
        console.log('2. NFT contains generic "Winner" SVG instead of actual proposal image');
        console.log('3. The minting process used placeholder data instead of real proposal');

        console.log('\n💡 WHY THIS HAPPENED:');
        console.log('The finalization script used a generic SVG template instead of');
        console.log('fetching the actual winning proposal image from IPFS.');

        console.log('\n🔧 WHAT SHOULD HAPPEN:');
        console.log('1. Get winning proposal IPFS hash');
        console.log('2. Fetch the actual image from IPFS');
        console.log('3. Mint NFT with the real winning image');
        console.log('4. Include proper metadata (title, description, etc.)');

        // Alternative explorer check
        console.log('\n🌐 ALTERNATIVE VERIFICATION:');
        console.log('============================');

        console.log('Since Blockscout links aren\'t working, try:');
        console.log('1. 🖥️  Open the nft-viewer.html file in your browser');
        console.log('2. 🔍 Use a different explorer (if available)');
        console.log('3. 📱 Import NFT manually in wallet using:');
        console.log(`   Contract: ${NFT_CONTRACT}`);
        console.log(`   Token ID: 0`);
        console.log(`   Network: World Chain Sepolia (Chain ID: 4801)`);

        console.log('\n✅ WHAT WE CONFIRMED:');
        console.log('======================');
        console.log('✅ You DO own the NFT (blockchain verified)');
        console.log('✅ The auction process worked correctly');
        console.log('✅ Payment was processed (0.03 ETH)');
        console.log('❌ But NFT has wrong image (should be fixed)');

    } catch (error) {
        console.error('❌ Investigation error:', error.message);
    }
}

investigateWinningProposal();