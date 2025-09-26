import React, { useContext, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import NftGallery from '@/components/dashboard/NftGallery';
import UploadModal from '@/components/dashboard/UploadModal';
import FullscreenGallery from '@/components/dashboard/FullscreenGallery';

export default function Dashboard() {
  const router = useRouter();
  const { items, setItems, pinataConfig } = useContext(AppContext);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { jwt, apiKey, apiSecret, groupId, apiVersion, gatewayBase } = pinataConfig;

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

    if (!jwt && !(apiKey && apiSecret)) {
      alert('Missing Pinata credentials. Provide JWT (recommended) or API key/secret in .env');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = [];
      for (const file of accepted) {
        const form = new FormData();
        form.append('file', file);
        form.append('pinataMetadata', JSON.stringify({ name: file.name }));

        let usingJwt = Boolean(jwt);
        if (apiVersion === '1') usingJwt = false;
        if (apiVersion === '3') usingJwt = true;

        let endpoint = usingJwt
          ? 'https://api.pinata.cloud/v3/pinning/pinFileToIPFS'
          : 'https://api.pinata.cloud/pinning/pinFileToIPFS';

        const headers = usingJwt
          ? { Authorization: `Bearer ${jwt}` }
          : {
              pinata_api_key: apiKey,
              pinata_secret_api_key: apiSecret,
            };

        if (usingJwt) {
          const opts = groupId && groupId.trim()
            ? { cidVersion: 1, groupId: groupId.trim() }
            : { cidVersion: 1 };
          form.append('pinataOptions', JSON.stringify(opts));
        } else {
          form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
        }

        let res = await fetch(endpoint, { method: 'POST', headers, body: form });
        if (!res.ok) {
          if (usingJwt && res.status === 404 && apiKey && apiSecret) {
            const v1Headers = {
              pinata_api_key: apiKey,
              pinata_secret_api_key: apiSecret,
              'x-pinata-api-key': apiKey,
              'x-pinata-secret-api-key': apiSecret,
            };
            const v1Form = new FormData();
            v1Form.append('file', file);
            v1Form.append('pinataMetadata', JSON.stringify({ name: file.name }));
            v1Form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
            endpoint = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
            res = await fetch(endpoint, { method: 'POST', headers: v1Headers, body: v1Form });
          }
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error('Pinata upload error', { endpoint, status: res.status, statusText: res.statusText, errText });
          throw new Error(`Pinata upload failed for ${file.name}: ${res.status} ${res.statusText} ${errText}`);
        }
        const data = await res.json();
        const hash = data.IpfsHash || (data?.data?.IpfsHash);
        if (!hash) throw new Error('No IpfsHash returned');
        uploaded.push({ url: `${gatewayBase}${hash}`, name: file.name, type: file.type, hash });
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

  return (
    <div className="dashboard-container">
      <div className="dashboard-main">
        <div className="dashboard-left panel">
          <div className="panel-content">{/* left content placeholder */}</div>
          <div className="panel-overlay">
            <button className="panel-overlay-btn" onClick={() => router.push('/bidding')}>
              go to bidding page to explore
            </button>
          </div>
        </div>
        <div className="dashboard-right panel">
          <div className="right-header">
            <div className="right-title">proposed nfts</div>
            <button className="enlarge-button" onClick={() => setShowFullscreen(true)} title="Enlarge">⤢</button>
          </div>
          {items.length > 0 ? (
            <NftGallery
              items={items}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              showVote
            />
          ) : (
            <div className="placeholder-text">no uploads yet</div>
          )}
          {isUploading && <div className="uploading-text">uploading to ipfs...</div>}
          <input
            type="file"
            accept=".png,.svg,image/png,image/svg+xml"
            multiple
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <div className="panel-overlay">
            <button className="panel-overlay-btn" onClick={() => router.push('/voting')}>
              go to voting page to view
            </button>
          </div>
        </div>
      </div>
      <div className="dashboard-bottom">
        <button className="propose-button" onClick={() => setShowUploadModal(true)}>
          propose your own nft
        </button>
      </div>

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUploadClick={() => { setShowUploadModal(false); fileInputRef.current && fileInputRef.current.click(); }}
        />
      )}

      {showFullscreen && (
        <FullscreenGallery
          items={items}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onClose={() => setShowFullscreen(false)}
        />
      )}
    </div>
  );
}
