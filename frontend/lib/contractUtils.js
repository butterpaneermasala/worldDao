import { ethers } from 'ethers';

/**
 * Utility functions for contract validation and error handling
 */

// Check if an address is valid
export function isValidAddress(address) {
    return address && ethers.isAddress(address);
}

// Check if contract is deployed with retries
export async function checkContractDeployment(address, provider, maxRetries = 3) {
    if (!isValidAddress(address)) {
        throw new Error(`Invalid contract address: ${address}`);
    }

    for (let i = 0; i < maxRetries; i++) {
        try {
            const code = await provider.getCode(address);
            const isDeployed = code !== '0x';

            if (i > 0) {
                console.log(`Contract deployment check succeeded on retry ${i + 1}`);
            }

            return {
                isDeployed,
                address,
                code: code.length > 2 ? `${code.slice(0, 10)}...` : code
            };
        } catch (error) {
            console.warn(`Contract deployment check attempt ${i + 1} failed:`, error.message);

            if (i === maxRetries - 1) {
                throw new Error(`Failed to check contract deployment after ${maxRetries} attempts: ${error.message}`);
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Safe contract method call with timeout and retries
export async function safeContractCall(contract, methodName, args = [], options = {}) {
    const {
        timeout = 15000,
        maxRetries = 2,
        description = `${methodName} call`
    } = options;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`${description} timeout after ${timeout}ms`)), timeout)
            );

            const callPromise = contract[methodName](...args);
            const result = await Promise.race([callPromise, timeoutPromise]);

            if (i > 0) {
                console.log(`${description} succeeded on retry ${i + 1}`);
            }

            return result;
        } catch (error) {
            console.warn(`${description} attempt ${i + 1} failed:`, error.message);

            // Don't retry for certain error types
            if (error.message.includes('missing revert data') ||
                error.message.includes('CALL_EXCEPTION') ||
                error.message.includes('execution reverted')) {
                throw error;
            }

            if (i === maxRetries - 1) {
                throw new Error(`${description} failed after ${maxRetries} attempts: ${error.message}`);
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Get contract instance with validation
export async function getValidatedContract(address, abi, signerOrProvider, contractName = 'Contract') {
    if (!isValidAddress(address)) {
        throw new Error(`Invalid ${contractName} address: ${address}`);
    }

    // Extract provider from signer if needed
    let provider = signerOrProvider;
    if (signerOrProvider && typeof signerOrProvider.getCode !== 'function') {
        // This is likely a signer, get the provider from it
        if (signerOrProvider.provider) {
            provider = signerOrProvider.provider;
            console.log(`Using provider from signer for ${contractName} deployment check`);
        } else if (signerOrProvider.getProvider) {
            // Some signers have getProvider() method
            provider = signerOrProvider.getProvider();
            console.log(`Using getProvider() method for ${contractName} deployment check`);
        } else {
            throw new Error(`Unable to get provider for contract deployment check. signerOrProvider type: ${typeof signerOrProvider}, has getCode: ${typeof signerOrProvider.getCode}`);
        }
    }

    // Check if contract is deployed
    const deploymentInfo = await checkContractDeployment(address, provider);
    if (!deploymentInfo.isDeployed) {
        throw new Error(`${contractName} not deployed at address: ${address}`);
    }

    try {
        const contract = new ethers.Contract(address, abi, signerOrProvider);

        // Test the contract by trying to get its interface
        if (contract.interface && contract.interface.fragments.length === 0) {
            throw new Error(`Invalid ABI for ${contractName}`);
        }

        console.log(`✅ ${contractName} validated at ${address}`);
        return contract;
    } catch (error) {
        throw new Error(`Failed to create ${contractName} instance: ${error.message}`);
    }
}

// Contract error categorization
export function categorizeContractError(error) {
    const message = error.message || error.toString();

    if (message.includes('missing revert data') || message.includes('CALL_EXCEPTION')) {
        return {
            type: 'CONTRACT_INTERACTION',
            severity: 'HIGH',
            userMessage: 'Contract interaction failed. The contract may not be deployed or may have an issue.',
            shouldRetry: false
        };
    }

    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
        return {
            type: 'NETWORK',
            severity: 'MEDIUM',
            userMessage: 'Network connection issue. Please check your internet connection and try again.',
            shouldRetry: true
        };
    }

    if (message.includes('user rejected') || message.includes('denied')) {
        return {
            type: 'USER_REJECTION',
            severity: 'LOW',
            userMessage: 'Transaction was cancelled by user.',
            shouldRetry: false
        };
    }

    if (message.includes('insufficient funds') || message.includes('gas')) {
        return {
            type: 'FUNDS',
            severity: 'MEDIUM',
            userMessage: 'Insufficient funds or gas limit issue. Please check your wallet balance.',
            shouldRetry: false
        };
    }

    return {
        type: 'UNKNOWN',
        severity: 'MEDIUM',
        userMessage: 'An unexpected error occurred. Please try again.',
        shouldRetry: true
    };
}

// Enhanced error logging
export function logContractError(error, context = '') {
    const category = categorizeContractError(error);
    const timestamp = new Date().toISOString();

    console.error(`[${timestamp}] Contract Error in ${context}:`, {
        type: category.type,
        severity: category.severity,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userMessage: category.userMessage
    });

    return category;
}

// NFT Contract diagnostic utility
export async function diagnoseNFTContract(contractAddress, provider) {
    console.log(`🔧 Diagnosing NFT contract at ${contractAddress}...`);

    const diagnostics = {
        address: contractAddress,
        isDeployed: false,
        isERC721: false,
        hasBalanceOf: false,
        hasName: false,
        hasSymbol: false,
        contractInfo: {},
        errors: []
    };

    try {
        // Check deployment
        const code = await provider.getCode(contractAddress);
        diagnostics.isDeployed = code !== '0x';

        if (!diagnostics.isDeployed) {
            diagnostics.errors.push('Contract not deployed');
            return diagnostics;
        }

        console.log('✅ Contract is deployed');

        // Test basic ERC721 functions
        const tests = [
            {
                name: 'name',
                abi: ['function name() view returns (string)'],
                test: async (contract) => {
                    const name = await contract.name();
                    diagnostics.contractInfo.name = name;
                    diagnostics.hasName = true;
                    console.log(`✅ Name: ${name}`);
                }
            },
            {
                name: 'symbol',
                abi: ['function symbol() view returns (string)'],
                test: async (contract) => {
                    const symbol = await contract.symbol();
                    diagnostics.contractInfo.symbol = symbol;
                    diagnostics.hasSymbol = true;
                    console.log(`✅ Symbol: ${symbol}`);
                }
            },
            {
                name: 'totalSupply',
                abi: ['function totalSupply() view returns (uint256)'],
                test: async (contract) => {
                    const supply = await contract.totalSupply();
                    diagnostics.contractInfo.totalSupply = supply.toString();
                    console.log(`✅ Total Supply: ${supply}`);
                }
            },
            {
                name: 'balanceOf',
                abi: ['function balanceOf(address owner) view returns (uint256)'],
                test: async (contract) => {
                    // Test with zero address
                    const balance = await contract.balanceOf('0x0000000000000000000000000000000000000000');
                    diagnostics.hasBalanceOf = true;
                    console.log(`✅ BalanceOf works (zero address balance: ${balance})`);
                }
            }
        ];

        for (const test of tests) {
            try {
                const contract = new ethers.Contract(contractAddress, test.abi, provider);
                await test.test(contract);
            } catch (error) {
                const errorMsg = `${test.name}: ${error.message}`;
                diagnostics.errors.push(errorMsg);
                console.log(`❌ ${errorMsg}`);
            }
        }

        // Check if it's ERC721 compliant
        diagnostics.isERC721 = diagnostics.hasName && diagnostics.hasSymbol && diagnostics.hasBalanceOf;

    } catch (error) {
        diagnostics.errors.push(`Diagnosis failed: ${error.message}`);
        console.log(`❌ Diagnosis failed: ${error.message}`);
    }

    return diagnostics;
}

// Create a working NFT ownership check for problematic contracts
export async function createWorkingNFTCheck(contractAddress, provider) {
    const diagnostics = await diagnoseNFTContract(contractAddress, provider);

    if (!diagnostics.isDeployed) {
        return null;
    }

    // If balanceOf works, use it
    if (diagnostics.hasBalanceOf) {
        return async (userAddress) => {
            const contract = new ethers.Contract(contractAddress, ['function balanceOf(address) view returns (uint256)'], provider);
            const balance = await contract.balanceOf(userAddress);
            return Number(balance) > 0;
        };
    }

    // If it has name/symbol but balanceOf is broken, we might be able to work around it
    if (diagnostics.hasName || diagnostics.hasSymbol) {
        console.log('⚠️ Contract has basic functions but balanceOf is broken');
        console.log('💡 You might need to implement custom ownership logic');

        // Return a function that always returns false for now
        return async () => {
            console.log('🚫 Using fallback ownership check (always false)');
            return false;
        };
    }

    return null;
}

const contractUtils = {
    isValidAddress,
    checkContractDeployment,
    safeContractCall,
    getValidatedContract,
    categorizeContractError,
    logContractError,
    diagnoseNFTContract,
    createWorkingNFTCheck
};

export default contractUtils;