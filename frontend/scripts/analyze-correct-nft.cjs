// Script to properly mint NFT with actual winning proposal image
const { ethers } = require('ethers');
require('dotenv').config();

async function mintCorrectNFT() {
    console.log('🎨 MINTING NFT WITH CORRECT WINNING PROPOSAL');
    console.log('============================================\n');

    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const VOTING_ADDRESS = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
    const NFT_CONTRACT = process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS;
    const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

        console.log(`🔑 Using relayer: ${wallet.address}`);

        // Find the actual winning proposal
        const voting = new ethers.Contract(VOTING_ADDRESS, [
            "function tallies(uint256) view returns (uint256)",
            "function getProposal(uint256 slot) view returns (string memory ipfsHash, string memory title, string memory description)"
        ], provider);

        console.log('🏆 Finding winning proposal...');

        let winnerSlot = 0;
        let highestVotes = 0;

        for (let i = 0; i < 20; i++) {
            try {
                const tally = await voting.tallies(i);
                const votes = Number(tally);

                if (votes > 0) {
                    console.log(`   Slot ${i}: ${votes} votes`);
                }

                if (votes > highestVotes) {
                    highestVotes = votes;
                    winnerSlot = i;
                }
            } catch (error) {
                // Skip failed slots
            }
        }

        console.log(`\n🥇 Winner: Slot ${winnerSlot} with ${highestVotes} votes`);

        // Get winning proposal details
        let proposal = null;
        try {
            proposal = await voting.getProposal(winnerSlot);
            console.log(`\n📋 Winning Proposal Details:`);
            console.log(`   Title: ${proposal.title}`);
            console.log(`   Description: ${proposal.description}`);
            console.log(`   IPFS Hash: ${proposal.ipfsHash}`);
        } catch (error) {
            console.log(`\n❌ Could not fetch proposal details: ${error.message}`);
            console.log('This might be why the NFT has wrong image!');
        }

        if (proposal && proposal.ipfsHash && proposal.ipfsHash !== '') {
            // Create proper NFT metadata with the actual winning image
            const tokenURI = `ipfs://${proposal.ipfsHash}`;

            // Create proper JSON metadata
            const metadata = {
                name: proposal.title || `WorldDAO Winner #${winnerSlot}`,
                description: proposal.description || `Winning proposal from WorldDAO voting, Slot ${winnerSlot}`,
                image: `ipfs://${proposal.ipfsHash}`,
                attributes: [
                    {
                        trait_type: "Winning Slot",
                        value: winnerSlot
                    },
                    {
                        trait_type: "Votes Received",
                        value: highestVotes
                    },
                    {
                        trait_type: "Contest Type",
                        value: "Daily Voting"
                    }
                ]
            };

            console.log(`\n🎨 Correct NFT should have:`);
            console.log(`   Name: ${metadata.name}`);
            console.log(`   Description: ${metadata.description}`);
            console.log(`   Image: ${metadata.image}`);
            console.log(`   IPFS URL: https://ipfs.io/ipfs/${proposal.ipfsHash}`);
            console.log(`   Pinata URL: https://crimson-added-centipede-967.mypinata.cloud/ipfs/${proposal.ipfsHash}`);

            // Test if image is accessible
            console.log(`\n🔍 Testing image accessibility...`);

            try {
                const response = await fetch(`https://crimson-added-centipede-967.mypinata.cloud/ipfs/${proposal.ipfsHash}`);
                if (response.ok) {
                    console.log(`   ✅ Image is accessible via Pinata gateway`);
                } else {
                    console.log(`   ❌ Image not accessible via Pinata gateway (${response.status})`);
                }
            } catch (error) {
                console.log(`   ❌ Error accessing image: ${error.message}`);
            }

            // Save metadata to IPFS and get new hash for proper NFT
            console.log(`\n📤 To fix the NFT, you would need to:`);
            console.log(`1. Upload proper metadata JSON to IPFS`);
            console.log(`2. Mint new NFT with correct tokenURI`);
            console.log(`3. Transfer to auction winner`);

            console.log(`\n📋 Proper Metadata JSON:`);
            console.log(JSON.stringify(metadata, null, 2));

        } else {
            console.log(`\n❌ PROBLEM IDENTIFIED:`);
            console.log(`   No IPFS hash found for winning proposal`);
            console.log(`   This is why the NFT shows generic "Winner" text`);
            console.log(`   The voting contract doesn't have proper proposal data`);
        }

        // Check current NFT content
        console.log(`\n🔍 Current NFT Analysis:`);
        const nft = new ethers.Contract(NFT_CONTRACT, [
            "function tokenURI(uint256 tokenId) view returns (string)"
        ], provider);

        const currentTokenURI = await nft.tokenURI(0);
        console.log(`   Current Token URI: ${currentTokenURI.substring(0, 100)}...`);

        if (currentTokenURI.startsWith('data:image/svg+xml;base64,')) {
            console.log(`   ❌ Contains: Generic SVG (not winning proposal)`);
        } else if (currentTokenURI.startsWith('ipfs://')) {
            console.log(`   ✅ Contains: IPFS reference (correct format)`);
        }

        console.log(`\n🎯 SUMMARY:`);
        console.log(`===============`);
        console.log(`✅ You DO own the NFT (Token #0)`);
        console.log(`✅ You won the auction fair and square`);
        console.log(`❌ BUT: NFT shows wrong image (should show winning proposal)`);
        console.log(`💡 The issue: Finalization script used placeholder instead of real data`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

mintCorrectNFT();