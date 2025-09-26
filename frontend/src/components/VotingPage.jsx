import React from 'react';

function VotingPage({ items }) {
  return (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">voting page</div>
        <a className="close-button" href="/dashboard">close</a>
      </div>
      <div className="nft-gallery fullscreen">
        {items.map((it, idx) => (
          <div key={idx} className="nft-thumb-card">
            <div className="nft-thumb-frame">
              <img src={it.url} alt={it.name || `nft-${idx}`} className="nft-thumb-image" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VotingPage;
