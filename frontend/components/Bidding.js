import React from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';

export default function Bidding() {
  const { address, isConnected } = useAccount();

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
        ) : (
          <div className="auction-content">
            <div className="auction-placeholder">
              <div className="auction-icon">🏛️</div>
              <h3>Auction House Coming Soon</h3>
              <p>Live auctions for community-selected NFTs will be available here.</p>
              <p className="small-text">Connected as: {address}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
