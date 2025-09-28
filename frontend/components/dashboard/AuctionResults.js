import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import { useAccount } from 'wagmi';
import { getProvider, getSigner, getContract, getRPCProvider } from '@/lib/web3';
import { ethers } from 'ethers';

// Import the correct NFTAuction ABI
const AUCTION_ABI = require('../../abis/NFTAuction.json');

export default function AuctionResults() {
    const router = useRouter();
    const { items } = useContext(AppContext);
    const { address, isConnected } = useAccount();

    // Voting state
    const [votingWinner, setVotingWinner] = useState(null);
    const [isVotingOpen, setIsVotingOpen] = useState(false);

    // Auction state  
    const [auctionActive, setAuctionActive] = useState(false);
    const [currentBid, setCurrentBid] = useState('0');
    const [highestBidder, setHighestBidder] = useState('');
    const [auctionEndTime, setAuctionEndTime] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Timer for auction countdown
    useEffect(() => {
        if (auctionEndTime > 0) {
            const interval = setInterval(() => {
                const now = Math.floor(Date.now() / 1000);
                const left = auctionEndTime - now;
                setTimeLeft(Math.max(0, left));
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [auctionEndTime]);

    // Auto-refresh auction data
    useEffect(() => {
        if (auctionActive) {
            const interval = setInterval(loadAuctionData, 120000); // Every 2 minutes (reduced from 15s)
            return () => clearInterval(interval);
        }
    }, [auctionActive]);

    // Initial load
    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadVotingResults(),
                loadAuctionData()
            ]);
        } catch (err) {
            setError(`Failed to load data: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadVotingResults = async () => {
        try {
            // Check voting status
            const provider = getProvider();
            const votingContract = await getContract(provider);

            const code = await provider.getCode(votingContract.target || votingContract.address);
            if (code === '0x') {
                setIsVotingOpen(false);
                return;
            }

            const open = await votingContract.isVotingOpen();
            setIsVotingOpen(open);

            // If voting ended and we have items, calculate winner
            if (!open && items.length > 0) {
                // Get vote counts for all items
                const itemsWithVotes = await Promise.all(
                    items.map(async (item) => {
                        try {
                            const votes = await votingContract.slotVotes(item.index);
                            return { ...item, votes: Number(votes) };
                        } catch (err) {
                            return { ...item, votes: 0 };
                        }
                    })
                );

                // Find winner (highest votes)
                const winner = itemsWithVotes.reduce((prev, current) =>
                    (current.votes > prev.votes) ? current : prev, itemsWithVotes[0]
                );

                if (winner && winner.votes > 0) {
                    setVotingWinner(winner);
                }
            }

        } catch (err) {
            console.warn('Failed to load voting results:', err);
        }
    };

    const loadAuctionData = async () => {
        try {
            const auctionAddress = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
            if (!auctionAddress || auctionAddress === '0x0000000000000000000000000000000000000000') {
                console.warn('Auction contract address not configured');
                setAuctionActive(false);
                return;
            }

            const provider = getRPCProvider();

            // Check if contract is deployed
            const code = await provider.getCode(auctionAddress);
            if (code === '0x' || code === '0x0') {
                console.warn('Auction contract not deployed at:', auctionAddress);
                setAuctionActive(false);
                return;
            }

            const contract = new ethers.Contract(auctionAddress, AUCTION_ABI, provider);

            // Test if contract has expected functions using correct function names
            try {
                const active = await contract.auctionActive();
                setAuctionActive(active);

                if (active) {
                    const bid = await contract.highestBid();
                    const bidder = await contract.highestBidder();
                    const endTime = await contract.auctionEndTime();

                    setCurrentBid(ethers.formatEther(bid));
                    setHighestBidder(bidder);
                    setAuctionEndTime(Number(endTime));
                }
            } catch (funcError) {
                console.warn('Auction contract missing expected functions:', funcError);
                setAuctionActive(false);
            }

        } catch (err) {
            console.warn('Failed to load auction data:', err);
            setAuctionActive(false);
        }
    };

    const createAuctionFromWinner = async () => {
        if (!votingWinner || !isConnected) return;

        try {
            setLoading(true);
            // This would trigger the auction creation
            // For now, we'll navigate to the auction page
            router.push(`/bidding?winner=${votingWinner.index}&name=${encodeURIComponent(votingWinner.name)}`);
        } catch (err) {
            setError(`Failed to create auction: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeLeft = (seconds) => {
        if (seconds <= 0) return "Auction Ended";

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    if (loading && !votingWinner && !auctionActive) {
        return (
            <div className="auction-results loading">
                <div className="loading-spinner">🔄</div>
                <p>Loading auction data...</p>
            </div>
        );
    }

    return (
        <div className="auction-results">
            {/* Voting Results & Winner */}
            {votingWinner && !isVotingOpen ? (
                <div className="voting-winner-section">
                    <div className="winner-header">
                        <h3>🏆 Voting Winner</h3>
                        <span className="winner-votes">{votingWinner.votes} votes</span>
                    </div>

                    <div className="winner-display">
                        <img
                            src={votingWinner.url}
                            alt={votingWinner.name}
                            className="winner-image"
                        />
                        <div className="winner-info">
                            <h4>{votingWinner.name}</h4>
                            <p>Ready for auction</p>
                        </div>
                    </div>

                    {!auctionActive ? (
                        <button
                            className="start-auction-btn"
                            onClick={createAuctionFromWinner}
                            disabled={!isConnected || loading}
                        >
                            🚀 Start Auction
                        </button>
                    ) : (
                        <div className="auction-status">
                            <span className="status-badge active">🔴 Live Auction</span>
                            <p>Auction is currently running</p>
                        </div>
                    )}
                </div>
            ) : isVotingOpen ? (
                <div className="voting-active-section">
                    <div className="status-message">
                        <span className="status-icon">🗳️</span>
                        <div>
                            <h3>Voting in Progress</h3>
                            <p>Auction will start when voting ends</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="no-winner-section">
                    <div className="status-message">
                        <span className="status-icon">⏳</span>
                        <div>
                            <h3>Waiting for Proposals</h3>
                            <p>No voting winner yet</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Current Auction Status */}
            {auctionActive && (
                <div className="current-auction-section">
                    <div className="auction-header">
                        <h3>🔴 Live Auction</h3>
                        <div className="auction-timer">
                            <span className="timer-label">Ends in:</span>
                            <span className={`timer-value ${timeLeft < 300 ? 'urgent' : ''}`}>
                                {formatTimeLeft(timeLeft)}
                            </span>
                        </div>
                    </div>

                    <div className="auction-stats">
                        <div className="stat-item">
                            <span className="stat-label">Current Bid</span>
                            <span className="stat-value">{currentBid} ETH</span>
                        </div>

                        {highestBidder && highestBidder !== '0x0000000000000000000000000000000000000000' && (
                            <div className="stat-item">
                                <span className="stat-label">Leading Bidder</span>
                                <span className="stat-value">
                                    {highestBidder.slice(0, 6)}...{highestBidder.slice(-4)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="auction-actions">
                        <button
                            className="view-auction-btn"
                            onClick={() => router.push('/bidding')}
                        >
                            🏛️ View Full Auction
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    <p>{error}</p>
                </div>
            )}
        </div>
    );
}