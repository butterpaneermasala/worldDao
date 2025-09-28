import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import { getProvider, getSigner, getRPCProvider } from '@/lib/web3';
import { ethers } from 'ethers';

// Import the correct NFTAuction ABI
const AUCTION_ABI = require('../abis/NFTAuction.json');

export default function Bidding() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { winner, name } = router.query; // Get winner info from URL params

  // Auction state
  const [auctionActive, setAuctionActive] = useState(false);
  const [currentBid, setCurrentBid] = useState('0');
  const [highestBidder, setHighestBidder] = useState('');
  const [auctionEndTime, setAuctionEndTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [myBidAmount, setMyBidAmount] = useState('0');

  // UI state
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const loadAuctionData = useCallback(async () => {
    try {
      const auctionAddress = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
      if (!auctionAddress) {
        setError('Auction contract not configured');
        return;
      }

      const provider = getRPCProvider();
      const contract = new ethers.Contract(auctionAddress, AUCTION_ABI, provider);

      // Check if contract is deployed
      const code = await provider.getCode(auctionAddress);
      if (code === '0x') {
        setError('Auction contract not deployed');
        return;
      }

      // Use correct function names from NFTAuction contract
      const active = await contract.auctionActive();
      setAuctionActive(active);

      if (active) {
        const bid = await contract.highestBid();
        const bidder = await contract.highestBidder();
        const endTime = await contract.auctionEndTime();

        setCurrentBid(ethers.formatEther(bid));
        setHighestBidder(bidder);
        setAuctionEndTime(Number(endTime));

        // Get user's current bid amount if connected
        if (isConnected && address) {
          try {
            const userBid = await contract.bidAmounts(address);
            setMyBidAmount(ethers.formatEther(userBid));
          } catch (err) {
            console.warn('Failed to get user bid amount:', err);
          }
        }
      }

    } catch (err) {
      console.error('Failed to load auction data:', err);
      setError(`Failed to load auction: ${err.message}`);
    }
  }, [isConnected, address]);

  // Auto-refresh auction data (reduced frequency to prevent rate limiting)
  useEffect(() => {
    loadAuctionData();

    if (auctionActive) {
      const interval = setInterval(loadAuctionData, 60000); // Every 60 seconds (reduced from 10s)
      return () => clearInterval(interval);
    }
  }, [auctionActive, address, loadAuctionData]);

  const placeBid = async () => {
    if (!isConnected || !bidAmount) {
      setError('Please connect wallet and enter bid amount');
      return;
    }

    try {
      setBidding(true);
      setError('');
      setSuccess('');

      const signer = await getSigner();
      const auctionAddress = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
      const contract = new ethers.Contract(auctionAddress, AUCTION_ABI, signer);

      // Validate bid amount
      const bidValue = ethers.parseEther(bidAmount);
      const currentBidValue = ethers.parseEther(currentBid);

      if (bidValue <= currentBidValue) {
        throw new Error('Bid must be higher than current highest bid');
      }

      // Place bid
      const tx = await contract.bid({ value: bidValue });
      await tx.wait();

      setSuccess('Bid placed successfully! 🎉');
      setBidAmount('');

      // Refresh auction data
      await loadAuctionData();

    } catch (err) {
      console.error('Bidding failed:', err);
      setError(`Bidding failed: ${err.message}`);
    } finally {
      setBidding(false);
    }
  };

  const withdrawBid = async () => {
    if (!isConnected || myBidAmount === '0') return;

    try {
      setLoading(true);
      setError('');

      const signer = await getSigner();
      const auctionAddress = process.env.NEXT_PUBLIC_AUCTION_ADDRESS;
      const contract = new ethers.Contract(auctionAddress, AUCTION_ABI, signer);

      const tx = await contract.withdraw();
      await tx.wait();

      setSuccess('Bid withdrawn successfully!');
      await loadAuctionData();

    } catch (err) {
      console.error('Withdrawal failed:', err);
      setError(`Withdrawal failed: ${err.message}`);
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

  return (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">auction house</div>
        <div className="topbar-controls">
          <w3m-button />
          <Link className="close-button" href="/dashboard">close</Link>
        </div>
      </div>

      <div className="auction-page-content">
        {!isConnected ? (
          <div className="connection-prompt">
            <h2>Connect Your Wallet to Participate</h2>
            <p>Please connect your wallet using Web3Modal to participate in auctions</p>
            <w3m-button />
          </div>
        ) : !auctionActive ? (
          <div className="no-auction">
            <div className="auction-icon">🏛️</div>
            <h3>No Active Auction</h3>
            <p>No auction is currently running.</p>
            {winner && name && (
              <div className="winner-info">
                <p>Winning NFT: <strong>{decodeURIComponent(name)}</strong></p>
                <p>Ready to start auction for this item</p>
              </div>
            )}
            <Link href="/dashboard" className="back-link">
              ← Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="auction-active">
            {/* Auction Header */}
            <div className="auction-header">
              <div className="auction-title">
                <h2>🔴 Live Auction</h2>
                {name && <p className="auction-item">Item: {decodeURIComponent(name)}</p>}
              </div>

              <div className="auction-timer">
                <span className="timer-label">Auction Ends:</span>
                <span className={`timer-value ${timeLeft < 300 ? 'urgent' : ''}`}>
                  {formatTimeLeft(timeLeft)}
                </span>
              </div>
            </div>

            {/* Current Bid Info */}
            <div className="bid-info-section">
              <div className="current-bid">
                <h3>Current Highest Bid</h3>
                <div className="bid-amount">{currentBid} ETH</div>
                {highestBidder && highestBidder !== '0x0000000000000000000000000000000000000000' && (
                  <div className="highest-bidder">
                    Leading: {highestBidder.slice(0, 6)}...{highestBidder.slice(-4)}
                    {highestBidder.toLowerCase() === address?.toLowerCase() && (
                      <span className="you-label">(You)</span>
                    )}
                  </div>
                )}
              </div>

              {myBidAmount !== '0' && (
                <div className="my-bid">
                  <h4>Your Bid</h4>
                  <div className="my-bid-amount">{myBidAmount} ETH</div>
                  <button
                    onClick={withdrawBid}
                    disabled={loading || highestBidder.toLowerCase() === address?.toLowerCase()}
                    className="withdraw-btn"
                  >
                    {loading ? 'Withdrawing...' : 'Withdraw Bid'}
                  </button>
                </div>
              )}
            </div>

            {/* Bidding Section */}
            <div className="bidding-section">
              <h3>Place Your Bid</h3>

              <div className="bid-input-section">
                <div className="bid-input-group">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Enter bid amount"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="bid-input"
                    disabled={bidding || timeLeft <= 0}
                  />
                  <span className="input-suffix">ETH</span>
                </div>

                <button
                  onClick={placeBid}
                  disabled={bidding || !bidAmount || timeLeft <= 0}
                  className="place-bid-btn"
                >
                  {bidding ? '🔄 Placing Bid...' : '🔨 Place Bid'}
                </button>
              </div>

              <div className="bid-helper-text">
                <p>Minimum bid: {(parseFloat(currentBid) + 0.001).toFixed(3)} ETH</p>
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="message error-message">
                <span className="message-icon">⚠️</span>
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="message success-message">
                <span className="message-icon">✅</span>
                <p>{success}</p>
              </div>
            )}

            {/* Auction Rules */}
            <div className="auction-rules">
              <h4>🛡️ Auction Rules</h4>
              <ul>
                <li>Bids must be higher than the current highest bid</li>
                <li>You can withdraw your bid if you&apos;re not the highest bidder</li>
                <li>The auction ends automatically at the specified time</li>
                <li>Winner receives the NFT, seller receives the payment</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
