import React from 'react';

export default function NftGallery({ items, selectedIndex, onSelect, showVote }) {
  return (
    <div className="nft-gallery">
      {items.map((it, idx) => (
        <div key={idx} className={`nft-thumb-card ${selectedIndex === idx ? 'selected' : ''}`}>
          <div className="nft-thumb-frame" onClick={() => onSelect(idx)}>
            <img src={it.url} alt={it.name || `nft-${idx}`} className="nft-thumb-image" />
          </div>
          {showVote && selectedIndex === idx && (
            <button className="vote-button" onClick={() => alert(`Vote for ${it.name || 'nft ' + (idx+1)}`)}>
              vote
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
