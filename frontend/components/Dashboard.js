import React, { useContext, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import NftGallery from '@/components/dashboard/NftGallery';
import VotingGallery from '@/components/dashboard/VotingGallery';
import AuctionResults from '@/components/dashboard/AuctionResults';
import ContractStatus from '@/components/ContractStatus';
import UploadModal from '@/components/dashboard/UploadModal';
import FullscreenGallery from '@/components/dashboard/FullscreenGallery';
import { useEffect } from 'react';
import { getProvider, getSigner, getContract } from '@/lib/web3';
import { useAccount } from 'wagmi';

export default function Dashboard() {
  const router = useRouter();
  const { items, setItems, pinataConfig } = useContext(AppContext);
  const { address, isConnected } = useAccount();
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef(null);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      // First load from Pinata
      await refreshProposals(null);

      // Then try to enhance with contract data using RPC
      try {
        const { getContractRPC, getRPCProvider } = await import('@/lib/web3');
        const contract = await getContractRPC();
        const provider = getRPCProvider();

        // Check if contract is deployed
        const code = await provider.getCode(contract.target || contract.address);
        if (code === '0x') {
          console.log('Voting contract not deployed');
          setIsVotingOpen(false);
          return;
        }

        const open = await contract.isVotingOpen();
        setIsVotingOpen(open);

        if (open) {
          await refreshProposals(contract);
        }
      } catch (e) {
        // RPC provider failed
        console.log('Contract check failed:', e.message);
        setIsVotingOpen(false);
      }
    } catch (e) {
      console.error('Refresh failed:', e);
      alert('Failed to refresh proposals. See console for details.');
    } finally {
      setRefreshing(false);
    }
  };

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

  // fetch proposals from Pinata API and optionally enrich with on-chain votes
  const refreshProposals = useCallback(async (contract) => {
    try {
      setLoadingProposals(true);
      const res = await fetch('/api/pinata/slots');
      if (!res.ok) throw new Error(`failed to fetch slots: ${res.status}`);
      const data = await res.json();
      let slots = Array.isArray(data.slots) ? data.slots : [];
      let nextItems = slots
        .filter(s => s && s.hasContent)
        .map(s => ({ index: s.index, url: s.url, name: s.name || `nft-${s.index + 1}`, cid: s.cid, tokenURI: s.tokenURI }));

      if (contract) {
        try {
          const votes = await Promise.all(nextItems.map(it => contract.slotVotes(it.index)));
          nextItems = nextItems.map((it, i) => ({ ...it, votes: Number(votes[i]) || 0 }));
        } catch (e) {
          console.warn('failed to read votes from contract', e);
        }
      }

      setItems(nextItems);
    } catch (e) {
      console.error('refreshProposals failed', e);
      setItems([]);
    } finally {
      setLoadingProposals(false);
    }
  }, [setItems, setLoadingProposals]);

  // handle local file selection -> uploads to Pinata via server API
  const handleFileChange = async (e) => {
    try {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setIsUploading(true);

      for (const file of files) {
        try {
          // Only allow SVG or PNG
          const mime = file.type || '';
          const isSvg = mime === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
          const isPng = mime === 'image/png' || file.name.toLowerCase().endsWith('.png');
          if (!isSvg && !isPng) {
            console.warn('Skipping unsupported file type:', file.name, mime);
            continue;
          }

          const base64 = await fileToBase64(file);
          const resp = await fetch('/api/pinata/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, base64, groupId }),
          });
          const data = await resp.json();
          if (!resp.ok) {
            console.error('Upload error for', file.name, data);
            alert(`Upload failed for ${file.name}: ${data.error || resp.statusText}`);
          }
        } catch (inner) {
          console.error('Upload inner error for file', file?.name, inner);
        }
      }

      // After uploads, refresh list
      const { getContractRPC } = await import('@/lib/web3');
      const readContract = await getContractRPC();
      await refreshProposals(readContract);
    } catch (err) {
      console.error('upload failed', err);
      alert('Upload failed. See console for details.');
    } finally {
      setIsUploading(false);
      // clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVote = async (proposalIndex) => {
    try {
      const signer = await getSigner();
      const contract = await getContract(signer);
      const tx = await contract.voteIndex(proposalIndex);
      await tx.wait();
      alert('Vote submitted');
      // Optional: refresh proposals to reflect updated votes if needed
      const { getContractRPC } = await import('@/lib/web3');
      const readContract = await getContractRPC();
      await refreshProposals(readContract);
    } catch (e) {
      console.error('vote failed', e);
      alert('Vote failed. See console for details.');
    }
  };

  // Load voting status and check if we need to load from blockchain or Pinata
  useEffect(() => {
    const init = async () => {
      // First, always load NFTs from Pinata
      try {
        await refreshProposals(null);
      } catch (e) {
        console.error('Failed to load proposals from Pinata:', e);
      }

      // Then, check contract status using RPC provider (no wallet needed)
      try {
        const { getContractRPC, getRPCProvider } = await import('@/lib/web3');
        const contract = await getContractRPC();
        const provider = getRPCProvider();

        // Check if contract is deployed and has the method
        const code = await provider.getCode(contract.target || contract.address);
        if (code === '0x') {
          console.log('Contract not deployed at address:', contract.target || contract.address);
          setIsVotingOpen(false);
          return;
        }

        const open = await contract.isVotingOpen();
        setIsVotingOpen(open);

        // Refresh with contract context to get vote counts if voting is open
        if (open) {
          await refreshProposals(contract);
        }
      } catch (e) {
        // Wallet not connected or contract interaction failed - that's okay
        console.log('Wallet not connected or contract unavailable:', e.message);
        setIsVotingOpen(false);
      }
    };

    init();
  }, [setItems, refreshProposals]);

  return (
    <div className="dashboard-container">
      {/* Wallet Connection Status */}
      <div className="wallet-status">
        <w3m-button />
        {isConnected && <span className="connected-indicator">✓ Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>}
      </div>

      {/* Contract Status */}
      <ContractStatus />

      <div className="dashboard-main">
        {/* Auction Section */}
        <div className="dashboard-section auction-section panel">
          <div className="section-header">
            <div className="section-title">🎯 auction house</div>
            <div className="section-subtitle">bid on exclusive nfts</div>
          </div>
          <AuctionResults />
          <div className="panel-overlay">
            <button className="panel-overlay-btn" onClick={() => router.push('/bidding')}>
              go to auction page
            </button>
          </div>
        </div>

        {/* NFT Gallery Section with Enhanced Voting */}
        <div className="dashboard-section dashboard-right panel">
          <div className="right-header">
            <div className="right-title">nft voting gallery</div>
            <div className="header-buttons">
              <button className="enlarge-button" onClick={() => setShowFullscreen(true)} title="Enlarge">⤢</button>
            </div>
          </div>

          <VotingGallery />

          {isUploading && <div className="uploading-text">uploading to ipfs...</div>}
          <input
            type="file"
            accept=".svg,image/svg+xml,.png,image/png"
            multiple
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <div className="panel-overlay">
            <button className="panel-overlay-btn" onClick={() => router.push('/voting')}>
              go to full voting page
            </button>
          </div>
        </div>
      </div>

      {/* Propose Your Own NFT Section */}
      <div className="dashboard-section propose-section">
        <button className="propose-button" onClick={() => setShowUploadModal(true)}>
          <span className="propose-icon">✨</span>
          propose your own nft
          <span className="propose-subtitle">upload your creation to the community</span>
        </button>
      </div>

      {/* Governance Section */}
      <div className="dashboard-section governance-section">
        <div className="governance-section-content">
          <div className="governance-title">🏛️ governance hub</div>
          <div className="governance-subtitle">shape the dao's future</div>
          <div className="governance-options">
            <div
              className="governance-option candidate-option"
              onClick={() => router.push('/governance?tab=candidates')}
            >
              <div className="option-icon">💡</div>
              <div className="option-content">
                <div className="option-title">suggest ideas</div>
                <div className="option-desc">anyone can create candidates</div>
              </div>
            </div>
            <div
              className="governance-option proposal-option"
              onClick={() => router.push('/governance?tab=proposals')}
            >
              <div className="option-icon">🗳️</div>
              <div className="option-content">
                <div className="option-title">vote & propose</div>
                <div className="option-desc">nft holders participate</div>
              </div>
            </div>
          </div>
          <div className="panel-overlay">
            <button className="panel-overlay-btn" onClick={() => router.push('/governance')}>
              go to governance page
            </button>
          </div>
        </div>
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
