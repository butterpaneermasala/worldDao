import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppContext } from '@/pages/_app';

export default function Voting() {
  const { items, setItems, pinataConfig } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        <Link className="close-button" href="/dashboard">close</Link>
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
            </div>
          ))
        ) : (
          <div className="placeholder-text">no proposals available</div>
        )}
      </div>
    </div>
  );
}
