import { ethers } from "ethers";
import { MiniKit } from '@worldcoin/minikit-js';
import { getAccount, getWalletClient } from '@wagmi/core';
import { config } from './web3modal';

// MiniKit Integration State
let miniKitInitialized = false;
let miniKitProvider = null;
const miniKitCache = new Map();

// Development Configuration
const DEVELOPMENT_CONFIG = {
  // Set to true to bypass NFT ownership checks in development
  BYPASS_NFT_CHECK: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV_MODE === 'true',

  // Whitelist of addresses that should have NFT access in development
  DEV_NFT_WHITELIST: [
    '0xe5eeD1EE1535a0DF01E0fE744C6156324D7De975', // Current user
    // Add more development addresses here
  ],

  // Enable detailed logging
  DEBUG_NFT_CHECKS: true
};

// Comprehensive connection status checker with MiniKit integration
export async function checkWalletConnection() {
  try {
    const status = {
      connected: false,
      provider: null,
      method: null,
      address: null,
      chainId: null,
      accounts: 0,
      miniKit: {
        available: isMiniKitReady(),
        isWorldApp: typeof window !== 'undefined' && !!window.ethereum?.isMiniKit
      }
    };

    // Check MiniKit connection first
    if (status.miniKit.available && status.miniKit.isWorldApp) {
      try {
        const connection = await connectWithMiniKit();
        if (connection.success) {
          return {
            ...status,
            connected: true,
            provider: 'minikit',
            method: 'world_app',
            address: connection.address,
            chainId: connection.network.chainId,
            accounts: 1,
            authData: connection.authData
          };
        }
      } catch (miniKitError) {
        console.log('MiniKit connection check failed:', miniKitError.message);
      }
    }

    // Check Web3Modal/Legacy providers
    const provider = getProvider();
    const network = await provider.getNetwork();
    const accounts = await provider.listAccounts();

    let method = 'unknown';
    if (window.ethereum?.isMetaMask) method = 'metamask';
    else if (window.ethereum?.isCoinbaseWallet) method = 'coinbase';
    else if (getAccount(config).isConnected) method = 'web3modal';

    return {
      ...status,
      connected: accounts.length > 0,
      provider: 'ethereum',
      method,
      address: accounts[0]?.address || null,
      chainId: Number(network.chainId),
      accounts: accounts.length
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      miniKit: {
        available: isMiniKitReady(),
        isWorldApp: typeof window !== 'undefined' && !!window.ethereum?.isMiniKit
      }
    };
  }
}

// MiniKit-specific utilities
export const getMiniKitStatus = () => {
  return {
    initialized: miniKitInitialized,
    installed: typeof window !== 'undefined' && MiniKit.isInstalled(),
    isWorldApp: typeof window !== 'undefined' && !!window.ethereum?.isMiniKit,
    ready: isMiniKitReady()
  };
};

export const clearMiniKitCache = () => {
  miniKitCache.clear();
};

// Enhanced connection function that tries MiniKit first
export const connectWallet = async (preferredMethod = 'auto') => {

  switch (preferredMethod) {
    case 'minikit':
    case 'world_app':
      if (isMiniKitReady()) {
        return await connectWithMiniKit();
      }
      throw new Error('MiniKit not available. Please open in World App.');

    case 'web3modal':
      // Web3Modal connection handled by the modal component
      throw new Error('Use Web3Modal button to connect with Web3Modal');

    case 'auto':
    default:
      // Auto-detect and prioritize MiniKit
      if (isMiniKitReady() && window.ethereum?.isMiniKit) {
        try {
          return await connectWithMiniKit();
        } catch (error) {
          // MiniKit connection failed, continue with fallback
        }
      }

      // Fallback to requesting accounts
      if (window.ethereum) {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const signer = await getSigner();
        const address = await signer.getAddress();

        return {
          success: true,
          address,
          signer,
          method: 'ethereum_fallback'
        };
      }

      throw new Error('No wallet connection method available');
  }
};

// Initialize MiniKit for World App integration with full feature detection
export const initMiniKit = async () => {
  if (typeof window !== 'undefined' && !miniKitInitialized) {
    try {
      await MiniKit.install({
        app_id: process.env.NEXT_PUBLIC_WORLD_APP_ID || 'app_staging_b2df5e3b4e95cd84d0f4830d93ac4440',
      });

      miniKitInitialized = true;
      console.log('🌍 MiniKit initialized successfully');

      // Test available features
      const features = {
        worldId: typeof MiniKit.worldId === 'function',
        walletAuth: typeof MiniKit.walletAuth === 'function',
        verify: typeof MiniKit.verify === 'function',
        pay: typeof MiniKit.pay === 'function',
        signMessage: typeof MiniKit.signMessage === 'function'
      };

      console.log('🔧 MiniKit features available:', features);
      return features;
    } catch (error) {
      console.warn('❌ MiniKit initialization failed:', error);
      miniKitInitialized = false;
      return null;
    }
  }
  return miniKitInitialized;
};

// Check if MiniKit is ready for use
export const isMiniKitReady = () => {
  return miniKitInitialized && MiniKit.isInstalled();
};

// MiniKit Wallet Authentication
export const authenticateWithMiniKit = async () => {
  if (!isMiniKitReady()) {
    throw new Error('MiniKit not ready. Please ensure World App is installed and initialized.');
  }

  try {
    console.log('🔐 Authenticating with MiniKit...');

    // Try walletAuth if available
    if (typeof MiniKit.walletAuth === 'function') {
      const authResult = await MiniKit.walletAuth({
        requestId: `auth-${Date.now()}`,
        message: 'Authenticate with WorldDAO'
      });

      console.log('✅ MiniKit authentication successful:', authResult);
      return {
        success: true,
        address: authResult.address,
        signature: authResult.signature,
        method: 'walletAuth'
      };
    }

    // Fallback: try to get address from provider
    if (window.ethereum?.isMiniKit) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        return {
          success: true,
          address: accounts[0],
          method: 'ethereum_provider'
        };
      }
    }

    throw new Error('No authentication method available');
  } catch (error) {
    console.error('❌ MiniKit authentication failed:', error);
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

// MiniKit Message Signing
export const signMessageWithMiniKit = async (message) => {
  if (!isMiniKitReady()) {
    throw new Error('MiniKit not ready');
  }

  try {
    console.log('✍️ Signing message with MiniKit:', message);

    // Try MiniKit signMessage if available
    if (typeof MiniKit.signMessage === 'function') {
      const signature = await MiniKit.signMessage({
        message: message,
        requestId: `sign-${Date.now()}`
      });

      return {
        success: true,
        signature,
        method: 'minikit_sign'
      };
    }

    // Fallback to ethereum provider
    if (window.ethereum?.isMiniKit) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, accounts[0]]
        });

        return {
          success: true,
          signature,
          method: 'ethereum_sign'
        };
      }
    }

    throw new Error('No signing method available');
  } catch (error) {
    console.error('❌ Message signing failed:', error);
    throw error;
  }
};

// MiniKit Connection with full integration
export const connectWithMiniKit = async () => {
  if (!isMiniKitReady()) {
    throw new Error('MiniKit not ready. Please open this app in World App.');
  }

  try {
    console.log('🔗 Connecting with MiniKit...');

    // First try authentication
    const authResult = await authenticateWithMiniKit();

    if (authResult.success) {
      // Create or get provider
      if (window.ethereum?.isMiniKit) {
        miniKitProvider = new ethers.BrowserProvider(window.ethereum);

        // Verify connection
        const network = await miniKitProvider.getNetwork();
        const signer = await miniKitProvider.getSigner();
        const address = await signer.getAddress();

        // Connection successful

        return {
          success: true,
          provider: miniKitProvider,
          signer,
          address,
          network: {
            chainId: Number(network.chainId),
            name: network.name
          },
          authData: authResult
        };
      }
    }

    throw new Error('Connection failed');
  } catch (error) {
    console.error('❌ MiniKit connection failed:', error);
    throw error;
  }
};

// Cached provider instance and rate limiting
let cachedProvider = null;
let currentRpcIndex = 0;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests
const requestCache = new Map();
const CACHE_DURATION = 5000; // 5 seconds cache

// RPC provider with fallback options and rate limiting
export function getRPCProvider() {
  // Return cached provider if available
  if (cachedProvider) {
    return cachedProvider;
  }

  // Multiple RPC endpoints with automatic failover (ordered by reliability)
  const rpcUrls = [
    'https://worldchain-sepolia.g.alchemy.com/v2/demo', // Alchemy demo endpoint (most reliable)
    'https://worldchain-sepolia.g.alchemy.com/public',   // Alchemy public (good fallback)
    'https://worldchain-sepolia.gateway.tenderly.co', // Tenderly gateway (working but rate limited)
    'https://worldchain-sepolia.rpc.thirdweb.com'    // Thirdweb RPC (has issues)
  ];

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || rpcUrls[currentRpcIndex];

  // Create provider with custom request handling
  cachedProvider = new ethers.JsonRpcProvider(rpcUrl, {
    chainId: 4801,
    name: 'World Chain Sepolia'
  });

  // Wrap the send method to add rate limiting and caching
  const originalSend = cachedProvider.send.bind(cachedProvider);
  cachedProvider.send = async function (method, params) {
    // Implement rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    // Check cache for read-only methods
    const cacheKey = `${method}:${JSON.stringify(params)}`;
    if (['eth_blockNumber', 'eth_getBalance', 'eth_call'].includes(method)) {
      const cached = requestCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.result;
      }
    }

    try {
      const result = await originalSend(method, params);

      // Cache successful results
      if (['eth_blockNumber', 'eth_getBalance', 'eth_call'].includes(method)) {
        requestCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      // Handle rate limiting (429) and other errors
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.warn(`Rate limit hit on RPC ${rpcUrl}, switching to next provider`);
        await switchToNextRPC();
        throw error;
      }
      throw error;
    }
  };

  // Add error handling
  cachedProvider.on('error', (error) => {
    console.warn('RPC Provider error:', error.message);
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      switchToNextRPC();
    }
  });

  console.log('Created new RPC provider using:', rpcUrl);
  return cachedProvider;
}

// Switch to next RPC provider on rate limit
async function switchToNextRPC() {
  const rpcUrls = [
    'https://worldchain-sepolia.g.alchemy.com/v2/demo',
    'https://worldchain-sepolia.g.alchemy.com/public',
    'https://worldchain-sepolia.gateway.tenderly.co',
    'https://worldchain-sepolia.rpc.thirdweb.com'
  ];

  currentRpcIndex = (currentRpcIndex + 1) % rpcUrls.length;
  console.log(`Switching to RPC provider ${currentRpcIndex + 1}: ${rpcUrls[currentRpcIndex]}`);

  // Clear cached provider to force recreation
  cachedProvider = null;

  // Wait a bit before retrying
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Force refresh provider (clear cache)
export function refreshRPCProvider() {
  cachedProvider = null;
  requestCache.clear();
  return getRPCProvider();
}

export function getProvider() {
  if (typeof window !== "undefined") {
    // Prioritize MiniKit provider if connected
    if (miniKitProvider && isMiniKitReady()) {
      console.log('🌍 Using MiniKit provider');
      return miniKitProvider;
    }

    // Check if Web3Modal is connected
    try {
      const account = getAccount(config);
      if (account.isConnected && window.ethereum) {
        console.log('🔌 Using Web3Modal provider');
        return new ethers.BrowserProvider(window.ethereum);
      }
    } catch (error) {
      // Fall through to legacy provider detection
    }

    // Prioritize World App (MiniKit) if available but not connected
    if (window.ethereum?.isMiniKit) {
      console.log('🌍 Using World App (MiniKit) provider');
      return new ethers.BrowserProvider(window.ethereum);
    }

    // Fallback to regular wallet providers
    if (window.ethereum) {
      console.log('💼 Using legacy wallet provider');
      return new ethers.BrowserProvider(window.ethereum);
    }
  }
  throw new Error("No web3 provider found. Please connect using MiniKit (World App), Web3Modal, or install a wallet.");
}

export async function getSigner() {
  try {
    // Try MiniKit connection first
    if (isMiniKitReady() && window.ethereum?.isMiniKit) {
      try {
        console.log('🌍 Attempting MiniKit signer...');
        const connection = await connectWithMiniKit();
        if (connection.success) {
          return connection.signer;
        }
      } catch (miniKitError) {
        console.log('⚠️ MiniKit signer failed, trying alternatives:', miniKitError.message);
      }
    }

    // Try Web3Modal next
    try {
      const account = getAccount(config);
      if (account.isConnected) {
        const walletClient = await getWalletClient(config);
        if (walletClient) {
          console.log('🔌 Using Web3Modal signer');
          const provider = getProvider();
          return await provider.getSigner();
        }
      }
    } catch (error) {
      console.log('Web3Modal not connected, falling back to legacy provider');
    }

    // Legacy provider fallback
    const provider = getProvider();

    // Check if already connected first
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      // For MiniKit, show specific message
      if (window.ethereum?.isMiniKit) {
        throw new Error('Please connect your World App wallet to continue');
      }
      // Request connection if not connected
      await window.ethereum.request({ method: "eth_requestAccounts" });
    }

    // Ensure we're on World Chain (480) or World Chain Sepolia (4801)
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId !== 480 && chainId !== 4801) {
      await switchToWorldChain();
    }

    return await provider.getSigner();
  } catch (error) {
    console.error("Error getting signer:", error);

    // Provide specific error messages based on context
    if (window.ethereum?.isMiniKit) {
      throw new Error("Please ensure World App is connected and authorized");
    }
    throw new Error("Please connect your wallet using MiniKit (World App) or Web3Modal and switch to World Chain");
  }
}

export async function switchToWorldChain() {
  try {
    // Try World Chain Sepolia first (testnet)
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x12C1' }], // 4801 in hex
    });
  } catch (switchError) {
    // Add World Chain Sepolia if not present
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x12C1',
          chainName: 'World Chain Sepolia',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://worldchain-sepolia.g.alchemy.com/public'],
          blockExplorerUrls: ['https://worldchain-sepolia.explorer.alchemy.com']
        }]
      });
    }
  }
}

export async function getContract(provider) {
  const addr = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
  if (!addr) throw new Error("NEXT_PUBLIC_VOTING_ADDRESS not set");
  const VotingAbi = require("../abis/Voting.json");
  return new ethers.Contract(addr, VotingAbi, provider);
}

// Get contract using RPC provider (for reading without wallet)
export async function getContractRPC() {
  const provider = getRPCProvider();
  return getContract(provider);
}

// Get auction contract using RPC provider
export async function getAuctionContractRPC() {
  const addr = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
  if (!addr) throw new Error("NEXT_PUBLIC_AUCTION_ADDRESS not set");
  const AuctionAbi = require("../abis/NFTAuction.json");
  const provider = getRPCProvider();
  return new ethers.Contract(addr, AuctionAbi, provider);
}

// Governance contract helpers
export async function getGovernorContract(signerOrProvider) {
  const address = process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_GOVERNOR_ADDRESS not configured");

  try {
    const abi = require("../abis/WorldChainGovernor.json");
    const { getValidatedContract } = await import('./contractUtils');
    return await getValidatedContract(address, abi, signerOrProvider, 'WorldChainGovernor');
  } catch (error) {
    console.error('Failed to get WorldChainGovernor:', error.message);
    throw error;
  }
}

export async function getCandidateContract(signerOrProvider) {
  const address = process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_CANDIDATE_ADDRESS not configured");

  try {
    const abi = require("../abis/CandidateContract.json");
    const { getValidatedContract } = await import('./contractUtils');
    return await getValidatedContract(address, abi, signerOrProvider, 'CandidateContract');
  } catch (error) {
    console.error('Failed to get CandidateContract:', error.message);
    throw error;
  }
}

// NFT contract helper with enhanced error handling
export async function getWorldNFTContract(signerOrProvider) {
  const address = process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_WORLD_NFT_ADDRESS not configured");

  try {
    // Enhanced ERC721 ABI for balance checking with better error handling
    const abi = [
      "function balanceOf(address owner) external view returns (uint256)",
      "function ownerOf(uint256 tokenId) external view returns (address)",
      "function totalSupply() external view returns (uint256)",
      "function name() external view returns (string)",
      "function symbol() external view returns (string)"
    ];

    const { getValidatedContract } = await import('./contractUtils');
    return await getValidatedContract(address, abi, signerOrProvider, 'WorldNFT');
  } catch (error) {
    console.error('Failed to get WorldNFT contract:', error.message);
    throw error;
  }
}

// Check if contract is deployed and responsive
export async function isContractDeployed(address, provider) {
  try {
    if (!address || !ethers.isAddress(address)) {
      return false;
    }

    const code = await provider.getCode(address);
    return code !== '0x';
  } catch (error) {
    console.warn(`Failed to check contract deployment at ${address}:`, error.message);
    return false;
  }
}

// Enhanced NFT ownership check with comprehensive fallback strategies
export async function checkNFTOwnership(userAddress) {
  // Check for development bypass first
  if (typeof window !== 'undefined' && window.__nftBypassEnabled === true) {
    console.log('🚀 Development bypass enabled - granting NFT ownership');
    return true;
  }

  // Input validation
  if (!userAddress || !ethers.isAddress(userAddress)) {
    console.log("Invalid user address provided for NFT ownership check");
    return false;
  }

  const nftAddress = process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS;
  if (!nftAddress) {
    console.log("NFT contract address not configured - skipping ownership check");
    return false;
  }

  if (!ethers.isAddress(nftAddress)) {
    console.error("Invalid NFT contract address:", nftAddress);
    return false;
  }

  console.log(`🔍 Checking NFT ownership for ${userAddress} at contract ${nftAddress}`);

  // Check if this is a known problematic contract
  const knownProblematicContracts = [
    '0x5BCAEf9a3059340f39e640875fE803422b5100C8' // Current contract with balanceOf issues
  ];

  if (knownProblematicContracts.includes(nftAddress.toLowerCase())) {
    console.log('⚠️ Known problematic NFT contract detected');
    console.log('🔧 This contract has implementation issues with the balanceOf function');
    console.log('🎯 For development: allowing access without NFT requirement');

    // In development, we'll allow access for this problematic contract
    // In production, you should either fix the contract or use a different NFT contract
    const isDevelopment = process.env.NODE_ENV === 'development' ||
      process.env.NEXT_PUBLIC_ENVIRONMENT === 'development';

    if (isDevelopment) {
      console.log('🚀 Development mode: granting access despite NFT contract issues');
      return true; // Grant access in development
    } else {
      console.log('🚫 Production mode: denying access due to NFT contract issues');
      return false;
    }
  }

  // Get available providers
  const providers = [];

  try {
    const walletProvider = getProvider();
    if (walletProvider) {
      providers.push({ provider: walletProvider, name: 'wallet' });
    }
  } catch (error) {
    console.warn('Wallet provider unavailable:', error.message);
  }

  try {
    const rpcProvider = getRPCProvider();
    if (rpcProvider) {
      providers.push({ provider: rpcProvider, name: 'rpc' });
    }
  } catch (error) {
    console.warn('RPC provider unavailable:', error.message);
  }

  if (providers.length === 0) {
    console.warn('No providers available for NFT ownership check');
    return false;
  }

  // Multiple ABI strategies to handle different contract implementations
  const abiStrategies = [
    {
      name: 'Standard ERC721',
      abi: ['function balanceOf(address owner) external view returns (uint256)']
    },
    {
      name: 'Simple ERC721',
      abi: ['function balanceOf(address owner) view returns (uint256)']
    },
    {
      name: 'Custom Implementation',
      abi: ['function balanceOf(address) returns (uint256)']
    }
  ];

  // Try each provider with each ABI strategy
  for (const { provider, name } of providers) {
    console.log(`🔄 Attempting NFT check with ${name} provider...`);

    // First verify contract deployment
    try {
      const code = await provider.getCode(nftAddress);
      if (code === '0x') {
        console.log(`❌ Contract not deployed at ${nftAddress}`);
        continue;
      }
      console.log(`✅ Contract exists (${code.length} bytes)`);
    } catch (error) {
      console.warn(`❌ Cannot verify contract with ${name}:`, error.message);
      continue;
    }

    // Try different ABI approaches
    for (const strategy of abiStrategies) {
      try {
        console.log(`  🧪 Testing ${strategy.name}...`);
        const contract = new ethers.Contract(nftAddress, strategy.abi, provider);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Call timeout')), 5000)
        );

        const balancePromise = contract.balanceOf(userAddress);
        const balance = await Promise.race([balancePromise, timeoutPromise]);

        const ownsNFT = Number(balance) > 0;
        console.log(`✅ SUCCESS: ${strategy.name} - Balance: ${balance}, Owns NFT: ${ownsNFT}`);
        return ownsNFT;

      } catch (error) {
        console.log(`  ❌ ${strategy.name} failed:`, error.code || error.message);

        if (error.message.includes('missing revert data') ||
          error.message.includes('CALL_EXCEPTION')) {
          console.log(`  🚫 Contract implementation issue detected with ${strategy.name}`);
        }
        continue;
      }
    }
  }

  // Final attempt: Try to detect what kind of contract this is
  console.log('🔍 Final attempt: Contract introspection...');
  for (const { provider, name } of providers) {
    try {
      const introspectionAbi = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function totalSupply() view returns (uint256)'
      ];

      const contract = new ethers.Contract(nftAddress, introspectionAbi, provider);

      const name = await contract.name();
      const symbol = await contract.symbol();
      console.log(`📊 Contract: ${name} (${symbol})`);

      // Contract responds to basic calls but balanceOf is broken
      console.log('⚠️ Contract exists but balanceOf function is not working correctly');
      break;

    } catch (introspectionError) {
      console.log(`📊 Introspection failed: ${introspectionError.message}`);
    }
  }

  console.warn('🚫 All NFT ownership check strategies failed');
  console.log('💡 Consider using a different NFT contract or implementing a custom ownership check');
  return false;
}

// Enhanced World ID verification with multiple methods and caching
export async function verifyWithWorldId(action, signal, options = {}) {
  if (!isMiniKitReady()) {
    throw new Error("World App required for World ID verification. Please open in World App.");
  }

  const cacheKey = `worldid:${action}:${signal}`;

  // Check cache if enabled (default: disabled for security)
  if (options.useCache && miniKitCache.has(cacheKey)) {
    const cached = miniKitCache.get(cacheKey);
    if (Date.now() - cached.timestamp < (options.cacheTime || 300000)) { // 5 min default
      console.log('💾 Using cached World ID proof');
      return cached.data;
    }
  }

  try {
    console.log(`🌍 Generating World ID proof for action: ${action}`);

    const verificationParams = {
      action: action,
      signal: signal || "",
      ...(options.appId && { app_id: options.appId })
    };

    let result;

    // Try MiniKit.worldId first
    if (typeof MiniKit.worldId === 'function') {
      const { proof, merkle_root, nullifier_hash } = await MiniKit.worldId(verificationParams);

      result = {
        proof,
        merkleRoot: merkle_root,
        nullifierHash: nullifier_hash,
        method: 'worldId',
        timestamp: Date.now()
      };
    }
    // Try generic verify as fallback
    else if (typeof MiniKit.verify === 'function') {
      const verifyResult = await MiniKit.verify({
        ...verificationParams,
        type: 'world_id'
      });

      result = {
        proof: verifyResult.proof,
        merkleRoot: verifyResult.merkle_root || verifyResult.merkleRoot,
        nullifierHash: verifyResult.nullifier_hash || verifyResult.nullifierHash,
        method: 'verify',
        timestamp: Date.now()
      };
    }
    else {
      throw new Error('No World ID verification method available');
    }

    console.log('✅ World ID verification successful:', {
      action,
      method: result.method,
      nullifierHash: result.nullifierHash?.substring(0, 10) + '...'
    });

    // Cache if enabled
    if (options.useCache) {
      miniKitCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    return result;
  } catch (error) {
    console.error('❌ World ID verification failed:', error);
    throw new Error(`World ID verification failed: ${error.message}`);
  }
}

// Specific verification functions for different use cases
export const verifyForVoting = async (proposalId, voteChoice) => {
  return await verifyWithWorldId(
    `vote_${proposalId}`,
    `${proposalId}_${voteChoice}`,
    { useCache: false } // Never cache voting proofs
  );
};

export const verifyForProposal = async (proposalData) => {
  const signal = typeof proposalData === 'string' ? proposalData : JSON.stringify(proposalData);
  return await verifyWithWorldId(
    'create_proposal',
    signal,
    { useCache: false }
  );
};

export const verifyForGovernance = async (action, data = '') => {
  return await verifyWithWorldId(
    `governance_${action}`,
    data,
    { useCache: false }
  );
};
