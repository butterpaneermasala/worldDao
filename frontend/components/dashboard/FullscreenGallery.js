import React, { useContext } from 'react';
import { AppContext } from '@/pages/_app';

export default function FullscreenGallery({ items, selectedIndex, onSelect, onClose }) {
  const { pinataConfig } = useContext(AppContext);

  return (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">proposed nfts</div>
        <button className="close-button" onClick={onClose}>close</button>
      </div>
      <div className="nft-gallery fullscreen">
        {items.map((it, idx) => (
          <div key={idx} className={`nft-thumb-card ${selectedIndex === idx ? 'selected' : ''}`}>
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
            {selectedIndex === idx && (
              <button className="vote-button" onClick={() => alert(`Vote for ${it.name || 'nft ' + (idx+1)}`)}>
                vote
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
