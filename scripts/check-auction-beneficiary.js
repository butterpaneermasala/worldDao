const { ethers } = require('ethers');

async function checkAuctionBeneficiary() {
    const RPC_URL = 'https://worldchain-sepolia.g.alchemy.com/public';
    const AUCTION_ADDRESS = '0x30B0ebC3D5415D1075582cb006B5d60E7B718DDD';
    const TREASURY_ADDRESS = '0x09D96fCC17b16752ec3673Ea85B9a6fea697f697';

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Simple ABI for the beneficiary function
    const auctionABI = [
        "function beneficiary() view returns (address)"
    ];

    try {
        const auction = new ethers.Contract(AUCTION_ADDRESS, auctionABI, provider);
        const currentBeneficiary = await auction.beneficiary();

        console.log('=== NFT Auction Configuration ===');
        console.log('Auction Address:', AUCTION_ADDRESS);
        console.log('Current Beneficiary:', currentBeneficiary);
        console.log('Treasury Address:', TREASURY_ADDRESS);
        console.log('Beneficiary matches Treasury:', currentBeneficiary.toLowerCase() === TREASURY_ADDRESS.toLowerCase());

        if (currentBeneficiary.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
            console.log('\n❌ ISSUE: Auction beneficiary is NOT set to Treasury!');
            console.log('📝 Action needed: Update auction beneficiary to Treasury address');
        } else {
            console.log('\n✅ SUCCESS: Auction beneficiary is correctly set to Treasury!');
        }

    } catch (error) {
        console.error('Error checking auction beneficiary:', error.message);
    }
}

checkAuctionBeneficiary();