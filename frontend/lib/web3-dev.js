// Development mode with minimal RPC calls
import { ethers } from "ethers";

// Ultra-minimal RPC setup for development
let devProvider = null;
let devCache = {
    blockNumber: null,
    blockTimestamp: 0,
    chainId: null,
    contracts: new Map()
};

const DEV_CACHE_DURATION = 30000; // 30 seconds cache in dev mode

export function getDevProvider() {
    if (!devProvider) {
        // Use the public Alchemy endpoint with minimal requests
        devProvider = new ethers.JsonRpcProvider(
            'https://worldchain-sepolia.g.alchemy.com/public',
            {
                chainId: 4801,
                name: 'World Chain Sepolia'
            }
        );

        console.log('🔧 Using development mode with minimal RPC calls');
    }

    return devProvider;
}

// Cached block number to reduce RPC calls
export async function getCachedBlockNumber() {
    const now = Date.now();

    if (devCache.blockNumber && (now - devCache.blockTimestamp) < DEV_CACHE_DURATION) {
        return devCache.blockNumber;
    }

    try {
        const provider = getDevProvider();
        const blockNumber = await provider.getBlockNumber();
        devCache.blockNumber = blockNumber;
        devCache.blockTimestamp = now;
        return blockNumber;
    } catch (error) {
        console.warn('Failed to get block number, using cached or default');
        return devCache.blockNumber || 0;
    }
}

// Cached chain ID
export async function getCachedChainId() {
    if (devCache.chainId) {
        return devCache.chainId;
    }

    try {
        const provider = getDevProvider();
        const network = await provider.getNetwork();
        devCache.chainId = Number(network.chainId);
        return devCache.chainId;
    } catch (error) {
        console.warn('Failed to get chain ID, using default');
        return 4801;
    }
}

// Minimal contract interface that reduces calls
export function getMinimalContract(address, abi) {
    const provider = getDevProvider();
    return new ethers.Contract(address, abi, provider);
}

// Export for compatibility
export { getDevProvider as getRPCProvider };