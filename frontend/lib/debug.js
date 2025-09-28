import { getProvider, getRPCProvider } from './web3';
import { diagnoseNFTContract } from './contractUtils';

/**
 * Debug utilities for troubleshooting contract issues
 */

// Comprehensive NFT contract diagnosis
export async function debugNFTContract() {
    console.log('🔧 Starting comprehensive NFT contract diagnosis...');

    const nftAddress = process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS;
    if (!nftAddress) {
        console.log('❌ No NFT contract address configured');
        return { success: false, error: 'No contract address' };
    }

    const results = {
        contractAddress: nftAddress,
        walletProviderResult: null,
        rpcProviderResult: null,
        recommendations: []
    };

    // Test with wallet provider
    try {
        const walletProvider = getProvider();
        console.log('🔄 Testing with wallet provider...');
        results.walletProviderResult = await diagnoseNFTContract(nftAddress, walletProvider);
    } catch (error) {
        console.log('❌ Wallet provider test failed:', error.message);
        results.walletProviderResult = { error: error.message };
    }

    // Test with RPC provider
    try {
        const rpcProvider = getRPCProvider();
        console.log('🔄 Testing with RPC provider...');
        results.rpcProviderResult = await diagnoseNFTContract(nftAddress, rpcProvider);
    } catch (error) {
        console.log('❌ RPC provider test failed:', error.message);
        results.rpcProviderResult = { error: error.message };
    }

    // Generate recommendations
    const walletResult = results.walletProviderResult;
    const rpcResult = results.rpcProviderResult;

    if (walletResult?.isDeployed || rpcResult?.isDeployed) {
        console.log('✅ Contract is deployed');

        if (walletResult?.isERC721 || rpcResult?.isERC721) {
            console.log('✅ Contract appears to be ERC721 compliant');
            results.recommendations.push('Contract is properly deployed and ERC721 compliant');
        } else {
            console.log('⚠️ Contract deployed but not fully ERC721 compliant');

            if (walletResult?.hasBalanceOf || rpcResult?.hasBalanceOf) {
                results.recommendations.push('Contract has balanceOf function but other ERC721 functions may be missing');
            } else {
                console.log('❌ Critical: balanceOf function not working');
                results.recommendations.push('CRITICAL: balanceOf function is not working - contract may need to be redeployed');
                results.recommendations.push('Consider using a different NFT contract address');
                results.recommendations.push('For development: temporarily disable NFT requirement');
            }
        }
    } else {
        console.log('❌ Contract not deployed at specified address');
        results.recommendations.push('Contract not deployed - check the contract address');
        results.recommendations.push('Deploy NFT contract or update address in environment variables');
    }

    return results;
}

// Quick fix for development - bypass NFT check
export function enableDevBypass() {
    console.log('🚀 Enabling development bypass for NFT ownership...');

    // Store original function
    const originalCheck = window.__originalNFTCheck;

    // Override the NFT ownership check
    if (typeof window !== 'undefined') {
        window.__nftBypassEnabled = true;
        console.log('✅ NFT bypass enabled - all users will be treated as NFT owners');
        console.log('⚠️ This is for development only - disable in production');
    }

    return true;
}

// Disable development bypass
export function disableDevBypass() {
    console.log('🔒 Disabling development bypass for NFT ownership...');

    if (typeof window !== 'undefined') {
        window.__nftBypassEnabled = false;
        console.log('✅ NFT bypass disabled - normal ownership checks restored');
    }

    return true;
}

// Check if development bypass is enabled
export function isDevBypassEnabled() {
    return typeof window !== 'undefined' && window.__nftBypassEnabled === true;
}

// Print helpful debug info
export function printDebugInfo() {
    console.log('\n🔧 worldDao Debug Information');
    console.log('================================');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('NFT Contract:', process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS);
    console.log('Governor Contract:', process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS);
    console.log('Candidate Contract:', process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS);
    console.log('Chain ID:', process.env.NEXT_PUBLIC_CHAIN_ID);
    console.log('RPC URL:', process.env.NEXT_PUBLIC_RPC_URL);
    console.log('Dev Bypass Enabled:', isDevBypassEnabled());
    console.log('================================\n');

    console.log('🔧 Available Debug Commands:');
    console.log('- debugNFTContract(): Diagnose NFT contract issues');
    console.log('- enableDevBypass(): Enable development bypass for NFT checks');
    console.log('- disableDevBypass(): Disable development bypass');
    console.log('- printDebugInfo(): Show this information again');
}

// Auto-expose debug functions in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    window.worldDaoDebug = {
        debugNFTContract,
        enableDevBypass,
        disableDevBypass,
        isDevBypassEnabled,
        printDebugInfo
    };

    console.log('🔧 Debug utilities loaded! Use window.worldDaoDebug in console');
    console.log('   Example: await window.worldDaoDebug.debugNFTContract()');
}

const debugUtils = {
    debugNFTContract,
    enableDevBypass,
    disableDevBypass,
    isDevBypassEnabled,
    printDebugInfo
};

export default debugUtils;