import React, { useRef, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';

function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="landing-container">
      <div className="content">
        <h1 className="title">worldDao</h1>
        <p className="subtitle">Enter the decentralized future</p>
        <button className="dive-button" onClick={() => navigate('/dashboard')}>
          dive into worldDao
        </button>
      </div>
      <div className="background-pattern"></div>
    </div>
  );
}

function DashboardPage({ items, setItems }) {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Pinata config
  const pinataJwt = process.env.REACT_APP_PINATA_JWT || process.env.REACT_APP_PINATA_JWT_TOKEN; // Bearer JWT
  const pinataApiKey = process.env.REACT_APP_PINATA_API_KEY;
  const pinataApiSecret = process.env.REACT_APP_PINATA_API_SECRET;
  const pinataGroupId = process.env.REACT_APP_PINATA_GROUP_ID; // optional, must be from your own Pinata account
  const pinataApiVersion = (process.env.REACT_APP_PINATA_API_VERSION || '').trim(); // '1' or '3' to force
  const gatewayBase = (process.env.REACT_APP_PINATA_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs/').replace(/\/$/, '/')

  const handleProposeNFT = () => {
    // Open confirmation modal first
    setShowUploadModal(true);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const validTypes = ['image/png', 'image/svg+xml'];
    const accepted = files.filter((f) => validTypes.includes(f.type));
    if (accepted.length === 0) {
      alert('Please select PNG or SVG files.');
      e.target.value = '';
      return;
    }

    if (!pinataJwt && !(pinataApiKey && pinataApiSecret)) {
      alert('Missing Pinata credentials. Please provide REACT_APP_PINATA_JWT (or REACT_APP_PINATA_JWT_TOKEN), or REACT_APP_PINATA_API_KEY and REACT_APP_PINATA_API_SECRET in .env, then restart dev server.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = [];
      for (const file of accepted) {
        const form = new FormData();
        form.append('file', file);
        // Optional: metadata
        const metadata = JSON.stringify({ name: file.name });
        form.append('pinataMetadata', metadata);

        // Decide API version based on credentials
        let usingJwt = Boolean(pinataJwt);
        if (pinataApiVersion === '1') usingJwt = false;
        if (pinataApiVersion === '3') usingJwt = true;

        let endpoint = usingJwt
          ? 'https://api.pinata.cloud/v3/pinning/pinFileToIPFS'
          : 'https://api.pinata.cloud/pinning/pinFileToIPFS'; // v1 for API key/secret

        // Build auth headers based on available credentials
        const headers = usingJwt
          ? { Authorization: `Bearer ${pinataJwt}` }
          : {
              pinata_api_key: pinataApiKey,
              pinata_secret_api_key: pinataApiSecret,
            };

        // Append pinataOptions
        if (usingJwt) {
          const opts = pinataGroupId && pinataGroupId.trim()
            ? { cidVersion: 1, groupId: pinataGroupId.trim() }
            : { cidVersion: 1 };
          form.append('pinataOptions', JSON.stringify(opts));
        } else {
          // v1: no groupId support; keep options minimal
          form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
        }

        console.debug('Pinata upload attempt', { endpoint, usingJwt, withGroup: Boolean(pinataGroupId) });
        let res = await fetch(endpoint, { method: 'POST', headers, body: form });
        if (!res.ok) {
          // If v3 with JWT returns 404 and API key/secret exist, try v1 without group
          if (usingJwt && res.status === 404 && pinataApiKey && pinataApiSecret) {
            console.warn('v3 returned 404. Retrying with v1 endpoint and API key/secret (no group)...');
            const v1Headers = {
              // Current header names
              pinata_api_key: pinataApiKey,
              pinata_secret_api_key: pinataApiSecret,
              // Legacy/alt header names some setups expect
              'x-pinata-api-key': pinataApiKey,
              'x-pinata-secret-api-key': pinataApiSecret,
            };
            const v1Form = new FormData();
            v1Form.append('file', file);
            v1Form.append('pinataMetadata', JSON.stringify({ name: file.name }));
            v1Form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
            endpoint = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
            res = await fetch(endpoint, {
              method: 'POST',
              headers: v1Headers,
              body: v1Form,
            });
          }
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error('Pinata upload error', { endpoint, status: res.status, statusText: res.statusText, errText });
          throw new Error(`Pinata upload failed for ${file.name}: ${res.status} ${res.statusText} ${errText}`);
        }
        const data = await res.json(); // { IpfsHash, ... } for both v1 and v3
        const hash = data.IpfsHash || (data?.data?.IpfsHash);
        if (!hash) throw new Error('No IpfsHash returned');
        uploaded.push({
          url: `${gatewayBase}${hash}`,
          name: file.name,
          type: file.type,
          hash,
        });
      }
      if (uploaded.length) {
        setItems((prev) => [...prev, ...uploaded]);
        setSelectedIndex(null);
      }
    } catch (err) {
      console.error('Pinata upload failed', err);
      alert('Failed to upload to IPFS via Pinata. See console for details.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // No cleanup needed: we render IPFS gateway URLs instead of local object URLs

  return (
    <div className="dashboard-container">
      <div className="dashboard-main">
        <div className="dashboard-left panel">
          <div className="panel-content">
            {/* left content placeholder */}
          </div>
          <div className="panel-overlay">
            <button className="panel-overlay-btn" onClick={() => navigate('/left')}>
              go to biding page to explore
            </button>
          </div>
        </div>
        <div className="dashboard-right panel">
          <div className="right-header">
            <div className="right-title">proposed nfts</div>
            <button className="enlarge-button" onClick={() => setShowFullscreen(true)} title="Enlarge">
              ⤢
            </button>
          </div>
          {/* Right panel shows uploaded NFT gallery (fixed-size thumbnails) */}
          {items.length > 0 ? (
            <div className="nft-gallery">
              {items.map((it, idx) => (
                <div key={idx} className={`nft-thumb-card ${selectedIndex === idx ? 'selected' : ''}`}>
                  <div className="nft-thumb-frame" onClick={() => setSelectedIndex(idx)}>
                    <img
                      src={it.url}
                      alt={it.name || `nft-${idx}`}
                      className="nft-thumb-image"
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
          ) : (
            <div className="placeholder-text">no uploads yet</div>
          )}
          {isUploading && <div className="uploading-text">uploading to ipfs...</div>}
          {/* hidden file input */}
          <input
            type="file"
            accept=".png,.svg,image/png,image/svg+xml"
            multiple
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <div className="panel-overlay">
            <button className="panel-overlay-btn" onClick={() => navigate('/right')}>
              go to vote page to view
            </button>
          </div>
        </div>
        {showUploadModal && (
          <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">upload your nft for voting</div>
              <div className="modal-body">
                You are about to upload your NFT(s) for community voting. Please select PNG or SVG files.
              </div>
              <div className="modal-actions">
                <button className="modal-btn secondary" onClick={() => setShowUploadModal(false)}>cancel</button>
                <button
                  className="modal-btn primary"
                  onClick={() => {
                    setShowUploadModal(false);
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                >
                  upload files
                </button>
              </div>
            </div>
          </div>
        )}
        {showFullscreen && (
          <div className="fullscreen-overlay">
            <div className="fullscreen-topbar">
              <div className="right-title">proposed nfts</div>
              <button className="close-button" onClick={() => setShowFullscreen(false)}>close</button>
            </div>
            <div className="nft-gallery fullscreen">
              {items.map((it, idx) => (
                <div key={idx} className={`nft-thumb-card ${selectedIndex === idx ? 'selected' : ''}`}>
                  <div className="nft-thumb-frame" onClick={() => setSelectedIndex(idx)}>
                    <img src={it.url} alt={it.name || `nft-${idx}`} className="nft-thumb-image" />
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
        )}
      </div>
      <div className="dashboard-bottom">
        <button className="propose-button" onClick={handleProposeNFT}>
          propose your own nft
        </button>
      </div>
    </div>
  );
}

function App() {
  const [items, setItems] = useState([]); // shared across routes

  const RightPage = () => (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">proposed nfts</div>
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

  const LeftPage = () => (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">left section</div>
        <a className="close-button" href="/dashboard">close</a>
      </div>
      <div style={{ color: '#ccc' }}>Left section fullscreen placeholder</div>
    </div>
  );

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage items={items} setItems={setItems} />} />
        <Route path="/right" element={<RightPage />} />
        <Route path="/left" element={<LeftPage />} />
      </Routes>
    </div>
  );
}

export default App;