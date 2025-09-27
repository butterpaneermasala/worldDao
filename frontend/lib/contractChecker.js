import { getProvider } from './web3';
import { ethers } from 'ethers';

/**
 * Comprehensive contract deployment checker for WorldDAO
 */

// Contract addresses from environment
const CONTRACT_ADDRESSES = {
    VOTING: process.env.NEXT_PUBLIC_VOTING_ADDRESS,
    GOVERNOR: process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS,
    CANDIDATE: process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS,
    WORLD_NFT: process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS,
    TREASURY: process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
    AUCTION: process.env.NEXT_PUBLIC_AUCTION_ADDRESS,
};

// Expected network information
const EXPECTED_NETWORKS = {
    4801: 'World Chain Sepolia',
    480: 'World Chain Mainnet'
};

/**
 * Check if a contract is deployed at the given address
 */
async function isContractDeployed(provider, address, name) {
    if (!address || address === '0x0000000000000000000000000000000000000000') {
        return {
            name,
            address,
            deployed: false,
            error: 'Address not configured or zero address',
            codeSize: 0
        };
    }

    try {
        const code = await provider.getCode(address);
        const isDeployed = code !== '0x';

        return {
            name,
            address,
            deployed: isDeployed,
            error: isDeployed ? null : 'No contract code found at address',
            codeSize: code.length
        };
    } catch (error) {
        return {
            name,
            address,
            deployed: false,
            error: error.message,
            codeSize: 0
        };
    }
}

/**
 * Test basic contract functionality
 */
async function testContractFunctionality(provider, contractInfo) {
    if (!contractInfo.deployed) {
        return { ...contractInfo, functionality: 'N/A - Not deployed' };
    }

    try {
        switch (contractInfo.name) {
            case 'Voting':
                return await testVotingContract(provider, contractInfo);
            case 'Governor':
                return await testGovernorContract(provider, contractInfo);
            case 'Candidate':
                return await testCandidateContract(provider, contractInfo);
            case 'World NFT':
                return await testNFTContract(provider, contractInfo);
            case 'Treasury':
                return await testTreasuryContract(provider, contractInfo);
            case 'Auction':
                return await testAuctionContract(provider, contractInfo);
            default:
                return { ...contractInfo, functionality: 'Unknown contract type' };
        }
    } catch (error) {
        return {
            ...contractInfo,
            functionality: `Error testing: ${error.message}`
        };
    }
}

/**
 * Test Voting contract functionality
 */
async function testVotingContract(provider, contractInfo) {
    try {
        const VotingAbi = require("../abis/Voting.json");
        const contract = new ethers.Contract(contractInfo.address, VotingAbi, provider);

        // Test basic read functions
        const isVotingOpen = await contract.isVotingOpen();
        const currentPhase = await contract.currentPhase();
        const proposalCount = await contract.proposalCount();

        return {
            ...contractInfo,
            functionality: 'Working ✅',
            details: {
                isVotingOpen,
                currentPhase: currentPhase.toString(),
                proposalCount: proposalCount.toString()
            }
        };
    } catch (error) {
        return {
            ...contractInfo,
            functionality: `Partial/Error: ${error.message}`,
            details: { error: error.message }
        };
    }
}

/**
 * Test Governor contract functionality
 */
async function testGovernorContract(provider, contractInfo) {
    try {
        const GovernorAbi = require("../abis/WorldChainGovernor.json");
        const contract = new ethers.Contract(contractInfo.address, GovernorAbi, provider);

        // Test basic read function
        const name = await contract.name();

        return {
            ...contractInfo,
            functionality: 'Working ✅',
            details: { name }
        };
    } catch (error) {
        return {
            ...contractInfo,
            functionality: `Partial/Error: ${error.message}`,
            details: { error: error.message }
        };
    }
}

/**
 * Test Candidate contract functionality
 */
async function testCandidateContract(provider, contractInfo) {
    try {
        const CandidateAbi = require("../abis/CandidateContract.json");
        const contract = new ethers.Contract(contractInfo.address, CandidateAbi, provider);

        // Test basic read function
        const candidateCount = await contract.candidateCount();

        return {
            ...contractInfo,
            functionality: 'Working ✅',
            details: { candidateCount: candidateCount.toString() }
        };
    } catch (error) {
        return {
            ...contractInfo,
            functionality: `Partial/Error: ${error.message}`,
            details: { error: error.message }
        };
    }
}

/**
 * Test NFT contract functionality
 */
async function testNFTContract(provider, contractInfo) {
    try {
        // Simple ERC721 ABI for basic testing
        const abi = [
            "function name() external view returns (string)",
            "function symbol() external view returns (string)",
            "function totalSupply() external view returns (uint256)"
        ];
        const contract = new ethers.Contract(contractInfo.address, abi, provider);

        const name = await contract.name();
        const symbol = await contract.symbol();
        let totalSupply = 'N/A';

        try {
            totalSupply = (await contract.totalSupply()).toString();
        } catch (e) {
            // totalSupply might not exist in all NFT contracts
        }

        return {
            ...contractInfo,
            functionality: 'Working ✅',
            details: { name, symbol, totalSupply }
        };
    } catch (error) {
        return {
            ...contractInfo,
            functionality: `Partial/Error: ${error.message}`,
            details: { error: error.message }
        };
    }
}

/**
 * Test Treasury contract functionality
 */
async function testTreasuryContract(provider, contractInfo) {
    try {
        // Basic treasury check - just verify it responds
        const balance = await provider.getBalance(contractInfo.address);

        return {
            ...contractInfo,
            functionality: 'Working ✅',
            details: {
                balance: ethers.formatEther(balance) + ' ETH',
                note: 'Treasury contract responding'
            }
        };
    } catch (error) {
        return {
            ...contractInfo,
            functionality: `Partial/Error: ${error.message}`,
            details: { error: error.message }
        };
    }
}

/**
 * Test Auction contract functionality
 */
async function testAuctionContract(provider, contractInfo) {
    try {
        // Basic auction contract test
        const balance = await provider.getBalance(contractInfo.address);

        return {
            ...contractInfo,
            functionality: 'Working ✅',
            details: {
                balance: ethers.formatEther(balance) + ' ETH',
                note: 'Auction contract responding'
            }
        };
    } catch (error) {
        return {
            ...contractInfo,
            functionality: `Partial/Error: ${error.message}`,
            details: { error: error.message }
        };
    }
}

/**
 * Main function to check all contracts
 */
export async function checkAllContracts() {
    console.log('🔍 Starting comprehensive contract deployment check...\n');

    try {
        const provider = getProvider();
        const network = await provider.getNetwork();
        const networkName = EXPECTED_NETWORKS[Number(network.chainId)] || 'Unknown Network';

        console.log(`📊 Network Information:`);
        console.log(`   Chain ID: ${network.chainId}`);
        console.log(`   Network: ${networkName}`);
        console.log(`   RPC: Connected ✅\n`);

        // Check all contracts
        const contractChecks = await Promise.all([
            isContractDeployed(provider, CONTRACT_ADDRESSES.VOTING, 'Voting'),
            isContractDeployed(provider, CONTRACT_ADDRESSES.GOVERNOR, 'Governor'),
            isContractDeployed(provider, CONTRACT_ADDRESSES.CANDIDATE, 'Candidate'),
            isContractDeployed(provider, CONTRACT_ADDRESSES.WORLD_NFT, 'World NFT'),
            isContractDeployed(provider, CONTRACT_ADDRESSES.TREASURY, 'Treasury'),
            isContractDeployed(provider, CONTRACT_ADDRESSES.AUCTION, 'Auction'),
        ]);

        // Test functionality for deployed contracts
        const functionalityResults = await Promise.all(
            contractChecks.map(contract => testContractFunctionality(provider, contract))
        );

        // Display results
        console.log('📋 Contract Deployment Status:\n');

        let deployedCount = 0;
        let workingCount = 0;

        functionalityResults.forEach(contract => {
            const status = contract.deployed ? '✅ Deployed' : '❌ Not Deployed';
            const functionality = contract.functionality || 'Not tested';

            console.log(`🔸 ${contract.name}:`);
            console.log(`   Address: ${contract.address}`);
            console.log(`   Status: ${status}`);
            console.log(`   Functionality: ${functionality}`);

            if (contract.details) {
                console.log(`   Details:`, contract.details);
            }

            if (contract.error) {
                console.log(`   Error: ${contract.error}`);
            }

            console.log('');

            if (contract.deployed) deployedCount++;
            if (contract.functionality && contract.functionality.includes('Working ✅')) workingCount++;
        });

        // Summary
        console.log(`📈 Summary:`);
        console.log(`   Deployed: ${deployedCount}/${functionalityResults.length} contracts`);
        console.log(`   Working: ${workingCount}/${deployedCount} deployed contracts`);
        console.log(`   Network: ${networkName} (${network.chainId})`);

        return {
            network: {
                chainId: Number(network.chainId),
                name: networkName
            },
            contracts: functionalityResults,
            summary: {
                total: functionalityResults.length,
                deployed: deployedCount,
                working: workingCount
            }
        };

    } catch (error) {
        console.error('❌ Contract check failed:', error);
        throw error;
    }
}

/**
 * Quick contract address validation
 */
export function validateContractAddresses() {
    console.log('🔍 Validating contract addresses from environment...\n');

    const issues = [];

    Object.entries(CONTRACT_ADDRESSES).forEach(([name, address]) => {
        if (!address) {
            issues.push(`❌ ${name}: Not configured (undefined)`);
        } else if (address === '0x0000000000000000000000000000000000000000') {
            issues.push(`⚠️  ${name}: Zero address`);
        } else if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            issues.push(`❌ ${name}: Invalid address format`);
        } else {
            console.log(`✅ ${name}: ${address}`);
        }
    });

    if (issues.length > 0) {
        console.log('\n🚨 Issues found:');
        issues.forEach(issue => console.log(`   ${issue}`));
    } else {
        console.log('\n✅ All contract addresses are properly configured!');
    }

    return issues.length === 0;
}

/**
 * Export for use in components or console
 */
export default {
    checkAllContracts,
    validateContractAddresses,
    CONTRACT_ADDRESSES
};