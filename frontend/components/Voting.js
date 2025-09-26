import React, { useContext } from 'react';
import Link from 'next/link';
import { AppContext } from '@/pages/_app';

export default function Voting() {
  const { items } = useContext(AppContext);
  return (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">voting page</div>
        <Link className="close-button" href="/dashboard">close</Link>
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
