import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppContext } from '@/pages/_app';
import { useAccount } from 'wagmi';
import { getSigner, getContract } from '@/lib/web3';

export default function Voting() {
  const { items, setItems, pinataConfig } = useContext(AppContext);
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [voting, setVoting] = useState(false);

  const handleVote = async (proposalIndex) => {
    if (!isConnected) {
      alert('Please connect your wallet to vote');
      return;
    }

    try {
      setVoting(true);
      const signer = await getSigner();
      const contract = await getContract(signer);
      const tx = await contract.voteIndex(proposalIndex);
      await tx.wait();
      alert('Vote submitted successfully!');
    } catch (error) {
      console.error('Voting failed:', error);
      alert('Voting failed: ' + error.message);
    } finally {
      setVoting(false);
    }
  };

  useEffect(() => {
    if (items.length === 0) {
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
      loadItems();
    }
  }, [items.length, setItems, pinataConfig.groupId]);

  return (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">voting page</div>
        <div className="topbar-controls">
          <w3m-button />
          <Link className="close-button" href="/dashboard">close</Link>
        </div>
      </div>

      {!isConnected ? (
        <div className="connection-prompt">
          <h2>Connect Your Wallet to Vote</h2>
          <p>Please connect your wallet using Web3Modal to participate in voting</p>
          <w3m-button />
        </div>
      ) : (
        <div className="nft-gallery fullscreen">
          {loading ? (
            <div className="placeholder-text">loading proposals...</div>
          ) : error ? (
            <div className="placeholder-text">Error: {error}</div>
          ) : items.length > 0 ? (
            items.map((it, idx) => (
              <div key={idx} className="nft-thumb-card voteable">
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
                <div className="nft-info">
                  <div className="nft-name">{it.name || `NFT ${idx + 1}`}</div>
                  {it.votes !== undefined && (
                    <div className="vote-count">Votes: {it.votes}</div>
                  )}
                </div>
                <button
                  className="vote-button"
                  onClick={() => handleVote(it.index)}
                  disabled={voting}
                >
                  {voting ? 'Voting...' : 'Vote'}
                </button>
              </div>
            ))
          ) : (
            <div className="placeholder-text">no proposals available</div>
          )}
        </div>
      )}
    </div>
  );
}
