import React, { useContext } from 'react';
import { AppContext } from '@/pages/_app';

export default function NftGallery({ items, selectedIndex, onSelect, showVote, onVote }) {
  const { pinataConfig } = useContext(AppContext);

  return (
    <div className="nft-gallery">
      {items.map((it, idx) => (
        <div key={idx} className={`nft-thumb-card ${it.status || 'submitted'} ${selectedIndex === idx ? 'selected' : ''}`}>
          <div className="status-indicator"></div>
          <div className="nft-thumb-frame" onClick={() => onSelect(idx)}>
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
          {showVote && selectedIndex === idx && (
            <button className="vote-button" onClick={() => onVote && onVote(idx)}>
              vote
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
