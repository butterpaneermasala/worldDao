import { ethers } from "ethers";

export function getProvider() {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  throw new Error("No injected web3 provider found");
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
    return await provider.getSigner();
  } catch (error) {
    console.error("Error getting signer:", error);
    throw new Error("Please connect your wallet in Metamask and try again");
  }
}

export async function getContract(provider) {
  const addr = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
  if (!addr) throw new Error("NEXT_PUBLIC_VOTING_ADDRESS not set");
  const VotingAbi = require("../abis/Voting.json");
  return new ethers.Contract(addr, VotingAbi, provider);
}

export async function checkWalletConnection() {
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
