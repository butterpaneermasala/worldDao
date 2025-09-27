import { ethers } from "ethers";
import { MiniKit } from '@worldcoin/minikit-js';

// Initialize MiniKit for World App integration
export const initMiniKit = () => {
  if (typeof window !== 'undefined') {
    try {
      MiniKit.install({
        app_id: process.env.NEXT_PUBLIC_WORLD_APP_ID || 'app_staging_b2df5e3b4e95cd84d0f4830d93ac4440',
      });
      console.log('MiniKit initialized successfully');
    } catch (error) {
      console.warn('MiniKit initialization failed:', error);
    }
  }
};

export function getProvider() {
  if (typeof window !== "undefined") {
    // Prioritize World App (MiniKit) if available
    if (window.ethereum?.isMiniKit) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    // Fallback to regular wallet providers
    if (window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
  }
  throw new Error("No web3 provider found. Please use World App or connect a wallet.");
}

export async function getSigner() {
  try {
    const provider = getProvider();

    // Check if already connected first
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
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
    throw new Error("Please connect your wallet and switch to World Chain");
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

// Governance contract helpers
export async function getGovernorContract(signerOrProvider) {
  const address = process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_GOVERNOR_ADDRESS not configured");

  const abi = require("../abis/WorldChainGovernor.json");
  return new ethers.Contract(address, abi, signerOrProvider);
}

export async function getCandidateContract(signerOrProvider) {
  const address = process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_CANDIDATE_ADDRESS not configured");

  const abi = require("../abis/CandidateContract.json");
  return new ethers.Contract(address, abi, signerOrProvider);
}

// NFT contract helper
export async function getWorldNFTContract(signerOrProvider) {
  const address = process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_WORLD_NFT_ADDRESS not configured");

  // Simple ERC721 ABI for balance checking
  const abi = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function totalSupply() external view returns (uint256)"
  ];
  return new ethers.Contract(address, abi, signerOrProvider);
}

// Check if user owns NFT
export async function checkNFTOwnership(userAddress) {
  try {
    const provider = getProvider();
    const nftContract = await getWorldNFTContract(provider);
    const balance = await nftContract.balanceOf(userAddress);
    return Number(balance) > 0;
  } catch (error) {
    console.error("Failed to check NFT ownership:", error);
    return false;
  }
}

// World ID verification helper
export async function verifyWithWorldId(action, signal) {
  if (!MiniKit.isInstalled()) {
    throw new Error("World App required for World ID verification");
  }

  try {
    const { proof, merkle_root, nullifier_hash } = await MiniKit.worldId({
      action: action,
      signal: signal || "",
    });

    return {
      proof,
      merkleRoot: merkle_root,
      nullifierHash: nullifier_hash
    };
  } catch (error) {
    console.error("World ID verification failed:", error);
    throw error;
  }
} export async function checkWalletConnection() {
  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const accounts = await provider.listAccounts();
    return {
      connected: accounts.length > 0,
      chainId: Number(network.chainId),
      accounts: accounts.length
    };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}
