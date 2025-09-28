const { ethers } = require('ethers');

// Deployed contract addresses from deployment records
const ADDRESSES = {
    Voting: '0xe8f5cc47813466c67196b20504c1decb8b8f913c',
    NFTAuction: '0x41f8031297ec34b9ba0771e149d272977ed43d35',
    NFTMinter: '0x277b3a1dd185713c32c1fb5958e7188219bfc002',
    Treasury: '0x09d96fcc17b16752ec3673ea85b9a6fea697f697',
    WorldChainGovernor: '0x627e9A7DF8e3860B14B95cf7Cf0D7eE120163dD8',
    CandidateContract: '0xB28Ba0b7c34832528154ce4a7AcC12b08A004d5D',
    WorldNFT: '0x5BCAEf9a3059340f39e640875fE803422b5100C8'
};

const provider = new ethers.JsonRpcProvider('https://worldchain-sepolia.g.alchemy.com/public');

async function checkContracts() {
    console.log('🔍 Checking WorldDAO Contract Deployments');
    console.log('='.repeat(50));

    for (const [name, address] of Object.entries(ADDRESSES)) {
        try {
            const code = await provider.getCode(address);
            if (code === '0x') {
                console.log(`❌ ${name.padEnd(15)} NOT DEPLOYED`);
            } else {
                const size = Math.floor((code.length - 2) / 2);
                console.log(`✅ ${name.padEnd(15)} DEPLOYED (${size} bytes)`);
            }
        } catch (error) {
            console.log(`⚠️  ${name.padEnd(15)} ERROR: ${error.message.substring(0, 50)}...`);
        }
    }

    console.log('\n🌐 Network: World Chain Sepolia (Chain ID: 4801)');
    console.log('📡 RPC: https://worldchain-sepolia.g.alchemy.com/public');
}

checkContracts().catch(console.error);