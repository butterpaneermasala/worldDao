import React, { useEffect, useRef, useState } from 'react';
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

function DashboardPage() {
  const [items, setItems] = useState([]); // { url, name, type }
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const fileInputRef = useRef(null);

  const handleProposeNFT = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const validTypes = ['image/png', 'image/svg+xml'];
    const newItems = [];
    for (const file of files) {
      if (!validTypes.includes(file.type)) continue;
      const url = URL.createObjectURL(file);
      newItems.push({ url, name: file.name, type: file.type });
    }
    if (newItems.length === 0) {
      alert('Please select PNG or SVG files.');
      e.target.value = '';
      return;
    }
    setItems((prev) => [...prev, ...newItems]);
    // reset selected so user can click a specific one
    setSelectedIndex(null);
    // allow re-selecting the same file set
    e.target.value = '';
  };

  // Cleanup object URLs for previous items on change/unmount
  useEffect(() => {
    return () => {
      items.forEach((it) => {
        try { URL.revokeObjectURL(it.url); } catch (_) {}
      });
    };
  }, [items]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-main">
        <div className="dashboard-left">
          {/* 70% width section - empty for now */}
        </div>
        <div className="dashboard-right">
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
          ) : null}
          {/* hidden file input */}
          <input
            type="file"
            accept=".png,.svg,image/png,image/svg+xml"
            multiple
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
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
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </div>
  );
}

export default App;