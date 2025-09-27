import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { AppContext } from '@/pages/_app';
import { getProvider, getSigner, getContract } from '@/lib/web3';

export default function Bidding() {
  const { pinataConfig } = useContext(AppContext);
  const [auctionData, setAuctionData] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentBid, setCurrentBid] = useState('0');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // Load auction data
  const loadAuctionData = async () => {
    try {
      const provider = getProvider();
      const contract = await getContract(provider);

      // Get current auction info
      const isActive = await contract.isAuctionActive();
      const highestBid = await contract._highestBid();
      const highestBidder = await contract._highestBidder();
      const auctionEndTime = await contract._auctionEndTime();
      const timeRemaining = await contract.timeLeft();

      setAuctionData({
        isActive,
        highestBid: highestBid.toString(),
        highestBidder,
        auctionEndTime: auctionEndTime.toString()
      });
      setCurrentBid(highestBid.toString());
      setTimeLeft(Number(timeRemaining));

    } catch (e) {
      console.error('Failed to load auction data:', e);
      setError('Failed to load auction data');
    }
  };

  // Check wallet connection
  useEffect(() => {
    const checkWallet = async () => {
      try {
        const provider = getProvider();
        const accounts = await provider.listAccounts();
        setIsWalletConnected(accounts.length > 0);
      } catch (e) {
        setIsWalletConnected(false);
      }
    };

    checkWallet();
    loadAuctionData();

    // Set up polling for auction updates
    const interval = setInterval(() => {
      loadAuctionData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Format time remaining
  const formatTime = (seconds) => {
    if (seconds <= 0) return 'Auction ended';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  // Handle bid submission
  const handleBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const signer = await getSigner();
      const contract = await getContract(signer);

      // Convert bid amount to wei (assuming ETH)
      const bidValue = ethers.parseEther(bidAmount);

      const tx = await contract.bid({ value: bidValue });
      await tx.wait();

      // Refresh auction data after successful bid
      await loadAuctionData();
      setBidAmount('');

    } catch (e) {
      console.error('Bid failed:', e);
      setError(e.reason || 'Bid failed. See console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">live auction</div>
        <Link className="close-button" href="/dashboard">close</Link>
      </div>

      <div className="auction-container">
        {!isWalletConnected && (
          <div className="wallet-warning">
            ⚠️ Please connect your wallet to participate in bidding
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {auctionData && (
          <div className="auction-info">
            <div className="auction-status">
              <h2>Current Auction</h2>
              <div className="status-indicator">
                <span className={`status-dot ${auctionData.isActive ? 'active' : 'ended'}`}></span>
                {auctionData.isActive ? 'Active' : 'Ended'}
              </div>
            </div>

            <div className="auction-details">
              <div className="bid-info">
                <div className="current-bid">
                  <span className="label">Current Highest Bid:</span>
                  <span className="value">{ethers.formatEther(currentBid)} ETH</span>
                </div>

                {auctionData.highestBidder !== '0x0000000000000000000000000000000000000000' && (
                  <div className="highest-bidder">
                    <span className="label">Highest Bidder:</span>
                    <span className="value">{auctionData.highestBidder.slice(0, 6)}...{auctionData.highestBidder.slice(-4)}</span>
                  </div>
                )}
              </div>

              <div className="time-info">
                <div className="time-remaining">
                  <span className="label">Time Remaining:</span>
                  <span className="value">{formatTime(timeLeft)}</span>
                </div>
              </div>
            </div>

            {auctionData.isActive && isWalletConnected && (
              <div className="bidding-section">
                <h3>Place Your Bid</h3>
                <div className="bid-form">
                  <input
                    type="number"
                    step="0.01"
                    min={currentBid > 0 ? (parseFloat(ethers.formatEther(currentBid)) + 0.01).toString() : "0.01"}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={`Minimum bid: ${currentBid > 0 ? (parseFloat(ethers.formatEther(currentBid)) + 0.01).toFixed(2) : "0.01"} ETH`}
                    className="bid-input"
                  />
                  <button
                    onClick={handleBid}
                    disabled={isLoading || !bidAmount}
                    className="bid-button"
                  >
                    {isLoading ? 'Placing Bid...' : 'Place Bid'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
