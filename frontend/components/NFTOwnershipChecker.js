import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

export default function NFTOwnershipChecker() {
    const { address, isConnected } = useAccount();
    const [nftData, setNftData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [winningProposal, setWinningProposal] = useState(null);

    // Use the correct NFT Minter contract, not the World NFT
    const NFT_CONTRACT = '0x277b3a1dd185713c32c1fb5958e7188219bfc002'; // NFT Minter
    const VOTING_CONTRACT = process.env.NEXT_PUBLIC_VOTING_ADDRESS;

    const checkNFTOwnership = useCallback(async () => {
        if (!address || !isConnected) return;

        setLoading(true);
        setError(null);

        try {
            // Setup provider with better error handling
            const provider = new ethers.JsonRpcProvider('https://worldchain-sepolia.g.alchemy.com/public');

            // Test connection first
            try {
                await provider.getBlockNumber();
            } catch (networkError) {
                throw new Error('Network connection failed. Make sure you\'re connected to World Chain Sepolia');
            }

            // Check NFT ownership with better error handling
            const nftContract = new ethers.Contract(NFT_CONTRACT, [
                "function balanceOf(address owner) view returns (uint256)",
                "function ownerOf(uint256 tokenId) view returns (address)",
                "function tokenURI(uint256 tokenId) view returns (string)",
                "function name() view returns (string)",
                "function symbol() view returns (string)"
            ], provider);

            let balance, name, symbol;

            try {
                balance = await nftContract.balanceOf(address);
                name = await nftContract.name();
                symbol = await nftContract.symbol();
            } catch (contractError) {
                console.error('Contract call failed:', contractError);
                throw new Error(`Contract call failed: ${contractError.message}. Make sure you're on World Chain Sepolia network.`);
            }

            let ownedTokens = [];

            // Check if user owns token ID 0 (the auction winner NFT)
            if (Number(balance) > 0) {
                try {
                    const owner0 = await nftContract.ownerOf(0);
                    if (owner0.toLowerCase() === address.toLowerCase()) {
                        const tokenURI = await nftContract.tokenURI(0);
                        ownedTokens.push({
                            tokenId: 0,
                            tokenURI,
                            isAuctionWinner: true
                        });
                    }
                } catch (err) {
                    console.log('Token 0 check failed:', err.message);
                }
            }

            // Get voting results to find winning proposal
            const votingContract = new ethers.Contract(VOTING_CONTRACT, [
                "function tallies(uint256) view returns (uint256)",
                "function getProposal(uint256 slot) view returns (string memory ipfsHash, string memory title, string memory description)"
            ], provider);

            let winnerSlot = 0;
            let highestVotes = 0;

            // Check vote tallies
            for (let i = 0; i < 20; i++) {
                try {
                    const tally = await votingContract.tallies(i);
                    const votes = Number(tally);
                    if (votes > highestVotes) {
                        highestVotes = votes;
                        winnerSlot = i;
                    }
                } catch (err) {
                    // Skip failed slots
                }
            }

            // Get winning proposal details
            let proposalData = null;
            if (highestVotes > 0) {
                try {
                    const proposal = await votingContract.getProposal(winnerSlot);
                    proposalData = {
                        slot: winnerSlot,
                        votes: highestVotes,
                        ipfsHash: proposal.ipfsHash,
                        title: proposal.title,
                        description: proposal.description,
                        imageUrl: proposal.ipfsHash ? `https://crimson-added-centipede-967.mypinata.cloud/ipfs/${proposal.ipfsHash}` : null
                    };
                } catch (err) {
                    console.log('Failed to get proposal details:', err.message);
                }
            }

            setNftData({
                balance: Number(balance),
                collectionName: name,
                symbol,
                ownedTokens
            });

            setWinningProposal(proposalData);

        } catch (err) {
            console.error('NFT check failed:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [address, isConnected, NFT_CONTRACT, VOTING_CONTRACT]);

    useEffect(() => {
        if (isConnected && address) {
            checkNFTOwnership();
        }
    }, [address, isConnected, checkNFTOwnership]);

    if (!isConnected) {
        return (
            <div className="nft-ownership-checker">
                <h3>🎨 NFT Ownership Status</h3>
                <p>Connect your wallet to check NFT ownership</p>
            </div>
        );
    }

    return (
        <div className="nft-ownership-checker">
            <h3>🎨 NFT Ownership Status</h3>

            {loading && <p>Checking NFT ownership...</p>}

            {error && (
                <div className="error-message">
                    <p>❌ Error: {error}</p>
                    <button onClick={checkNFTOwnership}>Retry</button>
                </div>
            )}

            {nftData && (
                <div className="nft-status">
                    <div className="collection-info">
                        <h4>📋 Collection: {nftData.collectionName} ({nftData.symbol})</h4>
                        <p>Your Balance: {nftData.balance} NFT(s)</p>
                    </div>

                    {nftData.ownedTokens.length > 0 ? (
                        <div className="owned-nfts">
                            <h4>🏆 Your NFTs:</h4>
                            {nftData.ownedTokens.map((token, idx) => (
                                <div key={idx} className="nft-card">
                                    <h5>Token #{token.tokenId}</h5>
                                    {token.isAuctionWinner && (
                                        <div className="winner-badge">🎉 Auction Winner!</div>
                                    )}

                                    {/* Display actual NFT content */}
                                    {token.tokenURI && (
                                        <div className="nft-content">
                                            {token.tokenURI.startsWith('data:image/svg+xml;base64,') ? (
                                                <div className="svg-nft">
                                                    <img
                                                        src={token.tokenURI}
                                                        alt={`NFT #${token.tokenId}`}
                                                        style={{ maxWidth: '200px', border: '2px solid #ddd' }}
                                                    />
                                                    <p>⚠️ Generic NFT (should show winning proposal)</p>
                                                </div>
                                            ) : token.tokenURI.startsWith('ipfs://') ? (
                                                <div className="ipfs-nft">
                                                    <img
                                                        src={`https://ipfs.io/ipfs/${token.tokenURI.replace('ipfs://', '')}`}
                                                        alt={`NFT #${token.tokenId}`}
                                                        style={{ maxWidth: '200px' }}
                                                    />
                                                    <p>✅ IPFS-hosted NFT</p>
                                                </div>
                                            ) : (
                                                <p>Token URI: {token.tokenURI.substring(0, 50)}...</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-nfts">
                            <p>You don&apos;t own any NFTs from this collection</p>
                        </div>
                    )}
                </div>
            )}

            {winningProposal && (
                <div className="winning-proposal">
                    <h4>🏆 Winning Proposal (Slot {winningProposal.slot})</h4>
                    <p><strong>Votes:</strong> {winningProposal.votes}</p>
                    {winningProposal.title && <p><strong>Title:</strong> {winningProposal.title}</p>}
                    {winningProposal.description && <p><strong>Description:</strong> {winningProposal.description}</p>}

                    {winningProposal.imageUrl ? (
                        <div className="winning-image">
                            <p><strong>📸 This should be your NFT image:</strong></p>
                            <img
                                src={winningProposal.imageUrl}
                                alt="Winning Proposal"
                                style={{ maxWidth: '300px', border: '2px solid #4CAF50' }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'block';
                                }}
                            />
                            <div style={{ display: 'none', color: 'red' }}>
                                Failed to load image from IPFS
                            </div>
                        </div>
                    ) : (
                        <p>⚠️ No IPFS hash found for winning proposal</p>
                    )}
                </div>
            )}

            <div className="network-info">
                <h4>🌐 Network Requirements</h4>
                <div className="network-details">
                    <p><strong>Required Network:</strong> World Chain Sepolia Testnet</p>
                    <p><strong>Chain ID:</strong> 4801</p>
                    <p><strong>RPC URL:</strong> https://worldchain-sepolia.g.alchemy.com/public</p>
                    <p><strong>Currency:</strong> ETH</p>
                </div>
                <p className="network-warning">
                    ⚠️ Make sure your wallet is connected to World Chain Sepolia network!
                </p>
            </div>

            <div className="import-instructions">
                <h4>📱 Manual Wallet Import</h4>
                <p>If NFT doesn&apos;t appear in your wallet:</p>
                <div className="import-details">
                    <p><strong>Contract:</strong> {NFT_CONTRACT}</p>
                    <p><strong>Token ID:</strong> 0</p>
                </div>
                <button onClick={checkNFTOwnership}>🔄 Refresh Check</button>
            </div>

            <style jsx>{`
        .nft-ownership-checker {
          background: white;
          padding: 20px;
          border-radius: 10px;
          margin: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .nft-card {
          background: #f9f9f9;
          padding: 15px;
          border-radius: 8px;
          margin: 10px 0;
        }
        .winner-badge {
          background: #4CAF50;
          color: white;
          padding: 5px 10px;
          border-radius: 15px;
          display: inline-block;
          margin: 5px 0;
        }
        .winning-proposal {
          background: #e8f5e8;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
        }
        .import-details, .network-details {
          background: #f0f0f0;
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
          font-family: monospace;
        }
        .network-info {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
        }
        .network-warning {
          background: #f8d7da;
          color: #721c24;
          padding: 8px;
          border-radius: 4px;
          margin: 10px 0;
        }
        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
        }
        button {
          background: #2196F3;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 5px;
          cursor: pointer;
          margin: 5px;
        }
        button:hover {
          background: #1976D2;
        }
      `}</style>
        </div>
    );
}