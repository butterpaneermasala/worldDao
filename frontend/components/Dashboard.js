import React, { useContext, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import NftGallery from '@/components/dashboard/NftGallery';
import UploadModal from '@/components/dashboard/UploadModal';
import FullscreenGallery from '@/components/dashboard/FullscreenGallery';
import { useEffect } from 'react';
import { getProvider, getSigner, getContract } from '@/lib/web3';

export default function Dashboard() {
  const router = useRouter();
  const { items, setItems, pinataConfig } = useContext(AppContext);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const fileInputRef = useRef(null);

  const { jwt, apiKey, apiSecret, groupId, apiVersion, gatewayBase } = pinataConfig;

  // helper: convert File to base64 (raw, without data: prefix)
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const str = String(result);
      const comma = str.indexOf(',');
      resolve(comma >= 0 ? str.slice(comma + 1) : str);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleVote = async (proposalIndex) => {
    try {
      const signer = await getSigner();
      const contract = getContract(signer);
      const tx = await contract.vote(proposalIndex);
      await tx.wait();
      alert('Vote submitted');
      // Optional: refresh proposals to reflect updated votes if needed
      const provider = getProvider();
      await refreshProposals(getContract(provider));
    } catch (e) {
      console.error('vote failed', e);
      alert('Vote failed. See console for details.');
    }
  };

  // Load voting status and proposals when voting opens
  useEffect(() => {
    let unsub;
    const init = async () => {
      try {
        const provider = getProvider();
        const contract = getContract(provider);
        const open = await contract.isVotingOpen();
        setIsVotingOpen(open);
        if (open) {
          await refreshProposals(contract);
        }
        // Listen for VotingOpened and Finalized
        contract.on('VotingOpened', async () => {
          setIsVotingOpen(true);
          await refreshProposals(contract);
        });
        contract.on('Finalized', async (dayIndex, winningId, winningVotes, tokenId, winningTokenURI) => {
          // Trigger cleanup of non-winning CIDs in the group
          try {
            const allTokenURIs = items.map((it) => it.url);
            await fetch('/api/pinata/cleanup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                groupId: groupId || '',
                winningTokenURI: String(winningTokenURI),
                allTokenURIs,
              }),
            });
          } catch (e) {
            console.warn('Cleanup failed', e);
          }
          // After finalize, gallery will close automatically until next VotingOpened
          setIsVotingOpen(false);
          setItems([]);
        });
        unsub = () => {
          contract.removeAllListeners('VotingOpened');
          contract.removeAllListeners('Finalized');
        };
      } catch (e) {
        console.warn('web3 init failed', e);
      }
    };
    init();
    return () => { if (unsub) try { unsub(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProposals = async (contract) => {
    try {
      setLoadingProposals(true);
      const count = Number(await contract.proposalsCount());
      const next = [];
      for (let i = 0; i < count; i++) {
        const p = await contract.proposals(i);
        // use tokenURI as display src; fallback to gateway if ipfs://
        const url = p.tokenURI && p.tokenURI.startsWith('ipfs://')
          ? `${gatewayBase}${p.tokenURI.slice('ipfs://'.length)}`
          : (p.tokenURI || '');
        next.push({ url, name: `proposal-${i}`, type: 'image/svg+xml', hash: null });
      }
      setItems(next);
      setSelectedIndex(null);
    } finally {
      setLoadingProposals(false);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const validTypes = ['image/svg+xml'];
    const accepted = files.filter((f) => validTypes.includes(f.type));
    if (accepted.length === 0) {
      alert('Please select SVG files only.');
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
      const uploadedTokenURIs = [];
      for (const file of accepted) {
        const form = new FormData();
        form.append('file', file);
        form.append('pinataMetadata', JSON.stringify({ name: file.name }));

        let usingJwt = Boolean(jwt);
        if (apiVersion === '1') usingJwt = false;
        if (apiVersion === '3') usingJwt = true;

        let endpoint = usingJwt
          ? 'https://api.pinata.cloud/pinning/pinFileToIPFS'
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

        // Step 1: Upload to Pinata
        let tokenURI = '';
        try {
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
            throw new Error(`Pinata upload failed for ${file.name}: ${res.status} ${res.statusText}`);
          }
          const data = await res.json();
          const hash = data.IpfsHash || (data?.data?.IpfsHash);
          if (!hash) throw new Error('No IpfsHash returned from Pinata');
          tokenURI = `ipfs://${hash}`;
        } catch (uploadErr) {
          // If upload fails, stop processing this file and surface a clear error
          console.error('Upload to Pinata failed', uploadErr);
          throw uploadErr;
        }

        // Step 2: Prepare raw svg base64 and submit on-chain proposal
        try {
          const svgBase64 = await fileToBase64(file);
          const signer = await getSigner();
          const contract = getContract(signer);
          const tx = await contract.propose(tokenURI, svgBase64);
          await tx.wait();
        } catch (chainErr) {
          console.error('On-chain proposal failed', chainErr);
          // Provide a clear message for UI and logs
          throw new Error(`On-chain proposal failed for ${file.name}: ${chainErr?.message || chainErr}`);
        }

        uploadedTokenURIs.push(tokenURI);
      }
      // Do not show in gallery yet; proposals will be visible only when voting opens.
      alert('Proposal(s) submitted on-chain. They will appear when voting opens.');
    } catch (err) {
      console.error('Upload/Proposal failed', err);
      alert((err && err.message) ? err.message : 'Failed to process file(s). See console for details.');
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
          {!isVotingOpen ? (
            <div className="placeholder-text">
              waiting for voting to start... you can propose SVGs now.
            </div>
          ) : loadingProposals ? (
            <div className="placeholder-text">loading proposals...</div>
          ) : items.length > 0 ? (
            <NftGallery
              items={items}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              showVote
              onVote={handleVote}
            />
          ) : (
            <div className="placeholder-text">no uploads yet</div>
          )}
          {isUploading && <div className="uploading-text">uploading to ipfs...</div>}
          <input
            type="file"
            accept=".svg,image/svg+xml"
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
