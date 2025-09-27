import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { AppContext } from '@/pages/_app';
import { getProvider, getSigner, getContract } from '@/lib/web3';

export default function Voting() {
  const { items, setItems, pinataConfig } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votingPhase, setVotingPhase] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Check wallet connection and voting status
  useEffect(() => {
    const checkWalletAndVoting = async () => {
      try {
        const provider = getProvider();
        const accounts = await provider.listAccounts();
        setIsWalletConnected(accounts.length > 0);

        if (accounts.length > 0) {
          const contract = await getContract(provider);
          const phaseInfo = await contract.currentPhaseInfo();
          const phase = Number(phaseInfo[0]);
          const endTime = Number(phaseInfo[1]);
          const now = Math.floor(Date.now() / 1000);

          setVotingPhase(phase);
          setTimeLeft(Math.max(0, endTime - now));

          // Check if user has already voted this session
          const lastVotedSession = await contract.lastVotedSession(accounts[0]);
          const currentSession = await contract.voteSessionId();
          setHasVoted(lastVotedSession >= currentSession);
        }
      } catch (e) {
        console.error('Error checking wallet/voting status:', e);
        setIsWalletConnected(false);
      }
    };

    checkWalletAndVoting();
  }, []);

  // Load items if not already loaded
  useEffect(() => {
    if (items.length === 0) {
      loadItems();
    }
  }, [items.length, setItems, pinataConfig.groupId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const url = '/api/pinata/slots';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`failed to fetch slots: ${res.status}`);
      const data = await res.json();
      let slots = Array.isArray(data.slots) ? data.slots : [];
      let nextItems = slots
        .filter(s => s && s.hasContent)
        .map(s => ({ index: s.index, url: s.url, name: s.name || `nft-${s.index + 1}`, cid: s.cid, tokenURI: s.tokenURI }));
      setItems(nextItems);
    } catch (e) {
      console.error('loadItems failed', e);
      setError(e.message || 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  // Handle vote submission
  const handleVote = async (proposalIndex) => {
    if (!isWalletConnected) {
      setError('Please connect your wallet to vote');
      return;
    }

    if (hasVoted) {
      setError('You have already voted in this session');
      return;
    }

    try {
      setError(null);
      const signer = await getSigner();
      const contract = await getContract(signer);

      const tx = await contract.voteIndex(proposalIndex);
      await tx.wait();

      setHasVoted(true);
      alert('Vote submitted successfully!');

      // Refresh to show updated vote counts if available
      loadItems();

    } catch (e) {
      console.error('Vote failed:', e);
      setError(e.reason || 'Vote failed. See console for details.');
    }
  };

  // Format time remaining
  const formatTime = (seconds) => {
    if (seconds <= 0) return 'Voting ended';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">voting page</div>
        <Link className="close-button" href="/dashboard">close</Link>
      </div>

      <div className="voting-status">
        {!isWalletConnected && (
          <div className="wallet-warning">
            ⚠️ Please connect your wallet to participate in voting
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {isWalletConnected && votingPhase !== null && (
          <div className="phase-info">
            <div className="phase-status">
              <span className="phase-label">Current Phase:</span>
              <span className="phase-value">
                {votingPhase === 1 ? '🗳️ Voting' : votingPhase === 0 ? '📤 Uploading' : '💰 Bidding'}
              </span>
            </div>

            {votingPhase === 1 && (
              <div className="time-info">
                <span className="time-label">Time Remaining:</span>
                <span className="time-value">{formatTime(timeLeft)}</span>
              </div>
            )}

            {hasVoted && (
              <div className="vote-status">
                ✅ You have already voted in this session
              </div>
            )}
          </div>
        )}
      </div>

      <div className="nft-gallery fullscreen">
        {loading ? (
          <div className="placeholder-text">loading proposals...</div>
        ) : error ? (
          <div className="placeholder-text">Error: {error}</div>
        ) : items.length > 0 ? (
          items.map((it, idx) => (
            <div key={idx} className="nft-thumb-card">
              <div className="nft-thumb-frame">
                <img
                  src={it.url}
                  alt={it.name || `nft-${idx}`}
                  className="nft-thumb-image"
                  onError={(e) => {
                    // Fallback to direct gateway URL using CID if proxy fails
                    if (it.cid) {
                      e.currentTarget.onerror = null;
                      const gw = pinataConfig.gatewayBase || 'https://gateway.pinata.cloud/ipfs/';
                      e.currentTarget.src = `${gw}${it.cid}`;
                    }
                  }}
                />
              </div>
              <div className="vote-info">
                <div className="nft-name">{it.name}</div>
                {votingPhase === 1 && isWalletConnected && !hasVoted && (
                  <button
                    className="vote-button"
                    onClick={() => handleVote(idx)}
                  >
                    Vote for #{idx + 1}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="placeholder-text">no proposals available</div>
        )}
      </div>
    </div>
  );
}
