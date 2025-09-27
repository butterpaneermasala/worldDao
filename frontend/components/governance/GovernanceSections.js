import React, { useState, useEffect } from 'react';
import { getProvider, getCandidateContract, getGovernorContract, getSigner, initMiniKit } from '@/lib/web3';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

const PROPOSAL_STATES = {
    0: 'Pending',
    1: 'Active',
    2: 'Succeeded',
    3: 'Defeated',
    4: 'Executed'
};

export default function GovernanceSections({ userOwnsNFT = false, initialTab = 'candidates' }) {
    const { address, isConnected } = useAccount();
    const [activeSection, setActiveSection] = useState(initialTab);
    const [candidates, setCandidates] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newCandidateDescription, setNewCandidateDescription] = useState('');
    const [creating, setCreating] = useState(false);
    const [actionLoading, setActionLoading] = useState({});
    const [isDemoMode, setIsDemoMode] = useState(false);

    // Demo data for when contracts aren't available
    const demoData = {
        candidates: [
            {
                id: 1,
                proposer: '0x1234...5678',
                description: 'Implement decentralized art curation system for better community involvement',
                sponsorCount: 3,
                promoted: false
            },
            {
                id: 2,
                proposer: '0xabcd...efgh',
                description: 'Create treasury funding mechanism for community art projects',
                sponsorCount: 5,
                promoted: true
            }
        ],
        proposals: [
            {
                id: 1,
                proposer: '0xabcd...efgh',
                description: 'Create treasury funding mechanism for community art projects',
                startBlock: 12345,
                endBlock: 12445,
                forVotes: 150,
                againstVotes: 30,
                abstainVotes: 20,
                state: 1
            }
        ]
    };

    // Initialize MiniKit on component mount
    useEffect(() => {
        initMiniKit();
    }, []);

    const loadCandidates = async () => {
        try {
            setLoading(true);

            // Check if contracts are configured
            if (!process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS) {
                console.warn('Candidate contract address not configured - using demo data');
                setIsDemoMode(true);
                setCandidates(demoData.candidates);
                return;
            }

            const provider = getProvider();

            // Check network
            const network = await provider.getNetwork();
            console.log('Connected to network:', Number(network.chainId));

            const candidateContract = await getCandidateContract(provider);

            // Check if contract exists by trying to get the code
            const code = await provider.getCode(process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS);
            if (code === '0x') {
                console.warn('Candidate contract not deployed - using demo data');
                setIsDemoMode(true);
                setCandidates(demoData.candidates);
                return;
            }

            const candidateCount = await candidateContract.candidateCount();
            console.log('Candidate count:', Number(candidateCount));

            if (Number(candidateCount) === 0) {
                setCandidates([]);
                return;
            }

            const candidatePromises = [];
            for (let i = 1; i <= Number(candidateCount); i++) {
                candidatePromises.push(candidateContract.candidates(i));
            }

            const candidateData = await Promise.all(candidatePromises);
            const formattedCandidates = candidateData.map((candidate) => ({
                id: Number(candidate.id),
                proposer: candidate.proposer,
                description: candidate.description,
                sponsorCount: Number(candidate.sponsorCount),
                promoted: candidate.promoted,
            }));
            setCandidates(formattedCandidates);
        } catch (error) {
            console.error('Failed to load candidates:', error);
            setCandidates([]);
        } finally {
            setLoading(false);
        }
    };

    const loadProposals = async () => {
        try {
            setLoading(true);

            // Check if contracts are configured
            if (!process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS) {
                console.warn('Governor contract address not configured - using demo data');
                setIsDemoMode(true);
                setProposals(demoData.proposals);
                return;
            }

            const provider = getProvider();

            // Check network
            const network = await provider.getNetwork();
            console.log('Connected to network:', Number(network.chainId));

            const governorContract = await getGovernorContract(provider);

            // Check if contract exists
            const code = await provider.getCode(process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS);
            if (code === '0x') {
                console.warn('Governor contract not deployed - using demo data');
                setIsDemoMode(true);
                setProposals(demoData.proposals);
                return;
            }

            const proposalCount = await governorContract.proposalCount();
            console.log('Proposal count:', Number(proposalCount));

            if (Number(proposalCount) === 0) {
                setProposals([]);
                return;
            }

            const proposalPromises = [];
            for (let i = 1; i <= Number(proposalCount); i++) {
                proposalPromises.push(governorContract.getProposal(i));
            }

            const proposalData = await Promise.all(proposalPromises);
            const formattedProposals = proposalData.map((proposal) => ({
                id: Number(proposal.id),
                proposer: proposal.proposer,
                description: proposal.description,
                startBlock: Number(proposal.startBlock),
                endBlock: Number(proposal.endBlock),
                forVotes: Number(proposal.forVotes),
                againstVotes: Number(proposal.againstVotes),
                abstainVotes: Number(proposal.abstainVotes),
                state: Number(proposal.state),
            }));
            setProposals(formattedProposals);
        } catch (error) {
            console.error('Failed to load proposals:', error);
            setProposals([]);
        } finally {
            setLoading(false);
        }
    };

    const createCandidate = async () => {
        if (!newCandidateDescription.trim()) return;

        if (isDemoMode) {
            console.log('Demo mode: Would create candidate with description:', newCandidateDescription);
            alert('Demo mode: Candidate creation simulated! In live mode, this would cost 0.01 ETH.');
            setNewCandidateDescription('');
            return;
        }

        try {
            setCreating(true);
            const signer = await getSigner();
            const candidateContract = await getCandidateContract(signer);

            const proposalFee = await candidateContract.PROPOSAL_FEE();
            const tx = await candidateContract.createCandidate(
                newCandidateDescription,
                { value: proposalFee }
            );

            await tx.wait();
            setNewCandidateDescription('');
            await loadCandidates();
        } catch (error) {
            console.error('Failed to create candidate:', error);
            alert('Failed to create candidate: ' + error.message);
        } finally {
            setCreating(false);
        }
    };

    const sponsorCandidate = async (candidateId) => {
        if (isDemoMode) {
            console.log('Demo mode: Would sponsor candidate', candidateId);
            alert('Demo mode: Candidate sponsorship simulated!');
            return;
        }

        try {
            setActionLoading(prev => ({ ...prev, [`sponsor-${candidateId}`]: true }));
            const signer = await getSigner();
            const candidateContract = await getCandidateContract(signer);

            const tx = await candidateContract.sponsorCandidate(candidateId);
            await tx.wait();
            await loadCandidates();
        } catch (error) {
            console.error('Failed to sponsor candidate:', error);
            alert('Failed to sponsor candidate: ' + error.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [`sponsor-${candidateId}`]: false }));
        }
    };

    const vote = async (proposalId, voteChoice) => {
        if (isDemoMode) {
            const voteNames = ['Against', 'For', 'Abstain'];
            console.log('Demo mode: Would vote', voteNames[voteChoice], 'on proposal', proposalId);
            alert(`Demo mode: Voted ${voteNames[voteChoice]} on proposal #${proposalId}!`);
            return;
        }

        try {
            setActionLoading(prev => ({ ...prev, [`vote-${proposalId}`]: true }));
            const signer = await getSigner();
            const governorContract = await getGovernorContract(signer);

            const tx = await governorContract.vote(proposalId, voteChoice);
            await tx.wait();
            await loadProposals();
        } catch (error) {
            console.error('Failed to vote:', error);
            alert('Failed to vote: ' + error.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [`vote-${proposalId}`]: false }));
        }
    };

    useEffect(() => {
        if (activeSection === 'candidates') {
            loadCandidates();
        } else {
            loadProposals();
        }
    }, [activeSection]);

    // Initialize on mount
    useEffect(() => {
        initMiniKit();
        loadCandidates(); // Load initial data
    }, []);

    // Update active section when initialTab prop changes
    useEffect(() => {
        if (initialTab && initialTab !== activeSection) {
            setActiveSection(initialTab);
        }
    }, [initialTab]);

    return (
        <div className="governance-sections">
            {/* Demo Mode Banner */}
            {isDemoMode && (
                <div className="demo-banner">
                    ⚠️ demo mode - contracts not deployed. deploy governance contracts to enable live functionality
                </div>
            )}

            {/* Section Tabs */}
            <div className="governance-tabs">
                <button
                    className={`governance-tab ${activeSection === 'candidates' ? 'active' : ''}`}
                    onClick={() => setActiveSection('candidates')}
                >
                    💡 candidates
                </button>
                <button
                    className={`governance-tab ${activeSection === 'proposals' ? 'active' : ''}`}
                    onClick={() => setActiveSection('proposals')}
                >
                    �️ proposals
                </button>
            </div>

            {/* Content Area */}
            <div className="governance-content">
                {/* Permission Banner */}
                {!address && (
                    <div className="permission-banner warning">
                        ⚠️ Connect your wallet to interact with governance
                    </div>
                )}
                {address && !userOwnsNFT && activeSection === 'candidates' && (
                    <div className="permission-banner info">
                        💡 Anyone can create candidates! NFT holders can sponsor and create proposals.
                    </div>
                )}
                {address && userOwnsNFT && (
                    <div className="permission-banner success">
                        ✅ NFT Holder: You can create candidates, sponsor them, and create proposals!
                    </div>
                )}

                {activeSection === 'candidates' ? (
                    <div className="candidates-section">
                        {/* Create Candidate Form */}
                        <div className="create-form">
                            <div className="form-title">create new candidate</div>
                            <textarea
                                className="candidate-input"
                                placeholder="describe your proposal idea..."
                                value={newCandidateDescription}
                                onChange={(e) => setNewCandidateDescription(e.target.value)}
                                maxLength={200}
                            />
                            <div className="form-footer">
                                <span className="char-count">{newCandidateDescription.length}/200</span>
                                <button
                                    className="create-btn"
                                    onClick={createCandidate}
                                    disabled={creating || !newCandidateDescription.trim() || !address}
                                >
                                    {!address ? 'connect wallet first' : (creating ? 'creating...' : 'create (0.01 eth)')}
                                </button>
                            </div>
                        </div>

                        {/* Candidates List */}
                        <div className="items-grid">
                            {loading ? (
                                <div className="loading-text">loading candidates...</div>
                            ) : candidates.length === 0 ? (
                                <div className="empty-text">no candidates yet. create the first one!</div>
                            ) : (
                                candidates.map((candidate) => (
                                    <div key={candidate.id} className={`governance-item ${candidate.promoted ? 'promoted' : ''}`}>
                                        <div className="item-header">
                                            <span className="item-id">#{candidate.id}</span>
                                            <span className={`item-status ${candidate.promoted ? 'promoted' : 'pending'}`}>
                                                {candidate.promoted ? '✅' : '⏳'}
                                            </span>
                                        </div>
                                        <div className="item-content">
                                            <p>{candidate.description}</p>
                                            <div className="item-meta">
                                                <span>by {candidate.proposer.slice(0, 6)}...{candidate.proposer.slice(-4)}</span>
                                                <span>{candidate.sponsorCount} sponsors</span>
                                            </div>
                                        </div>
                                        {!candidate.promoted && (
                                            <button
                                                className="action-btn sponsor-btn"
                                                onClick={() => sponsorCandidate(candidate.id)}
                                                disabled={actionLoading[`sponsor-${candidate.id}`]}
                                            >
                                                {actionLoading[`sponsor-${candidate.id}`] ? 'sponsoring...' : 'sponsor'}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="proposals-section">
                        <div className="items-grid">
                            {loading ? (
                                <div className="loading-text">loading proposals...</div>
                            ) : proposals.length === 0 ? (
                                <div className="empty-text">no proposals yet. promote candidates first!</div>
                            ) : (
                                proposals.map((proposal) => {
                                    const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
                                    const isActive = proposal.state === 1;

                                    return (
                                        <div key={proposal.id} className={`governance-item proposal-${proposal.state}`}>
                                            <div className="item-header">
                                                <span className="item-id">proposal #{proposal.id}</span>
                                                <span className={`item-status status-${proposal.state}`}>
                                                    {PROPOSAL_STATES[proposal.state]}
                                                </span>
                                            </div>
                                            <div className="item-content">
                                                <p>{proposal.description}</p>
                                                <div className="vote-bar">
                                                    <div
                                                        className="vote-segment for"
                                                        style={{ width: total > 0 ? `${(proposal.forVotes / total) * 100}%` : '33.33%' }}
                                                    >
                                                        {proposal.forVotes}
                                                    </div>
                                                    <div
                                                        className="vote-segment against"
                                                        style={{ width: total > 0 ? `${(proposal.againstVotes / total) * 100}%` : '33.33%' }}
                                                    >
                                                        {proposal.againstVotes}
                                                    </div>
                                                    <div
                                                        className="vote-segment abstain"
                                                        style={{ width: total > 0 ? `${(proposal.abstainVotes / total) * 100}%` : '33.33%' }}
                                                    >
                                                        {proposal.abstainVotes}
                                                    </div>
                                                </div>
                                            </div>
                                            {isActive && (
                                                <div className="vote-buttons">
                                                    <button
                                                        className="action-btn vote-for"
                                                        onClick={() => vote(proposal.id, 1)}
                                                        disabled={actionLoading[`vote-${proposal.id}`]}
                                                    >
                                                        for
                                                    </button>
                                                    <button
                                                        className="action-btn vote-against"
                                                        onClick={() => vote(proposal.id, 0)}
                                                        disabled={actionLoading[`vote-${proposal.id}`]}
                                                    >
                                                        against
                                                    </button>
                                                    <button
                                                        className="action-btn vote-abstain"
                                                        onClick={() => vote(proposal.id, 2)}
                                                        disabled={actionLoading[`vote-${proposal.id}`]}
                                                    >
                                                        abstain
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
        .governance-sections {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.1);
          margin: 20px;
          border-radius: 8px;
          overflow: hidden;
        }

        .demo-banner {
          background: rgba(255, 193, 7, 0.2);
          border-bottom: 1px solid rgba(255, 193, 7, 0.5);
          color: #ffc107;
          font-family: 'Press Start 2P', cursive;
          font-size: 0.6rem;
          padding: 10px 15px;
          text-align: center;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }

        .governance-tabs {
          display: flex;
          background: rgba(255,255,255,0.05);
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .governance-tab {
          flex: 1;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.7);
          font-family: 'Press Start 2P', cursive;
          font-size: 0.7rem;
          padding: 15px;
          cursor: pointer;
          transition: all 0.2s;
          border-right: 1px solid rgba(255,255,255,0.1);
        }

        .governance-tab:last-child {
          border-right: none;
        }

        .governance-tab:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }

        .governance-tab.active {
          background: rgba(255,255,255,0.15);
          color: white;
          border-bottom: 2px solid #666;
        }

        .governance-content {
            padding: 20px;
        }

        .permission-banner {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 20px;
            font-family: 'Press Start 2P', cursive;
            font-size: 0.6rem;
            text-align: center;
        }

        .permission-banner.warning {
            background: rgba(220, 53, 69, 0.1);
            border-color: rgba(220, 53, 69, 0.3);
            color: #dc3545;
        }

        .permission-banner.info {
            background: rgba(0, 123, 255, 0.1);
            border-color: rgba(0, 123, 255, 0.3);
            color: #007bff;
        }

        .permission-banner.success {
            background: rgba(40, 167, 69, 0.1);
            border-color: rgba(40, 167, 69, 0.3);
            color: #28a745;
        }        .create-form {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 20px;
        }

        .form-title {
          font-family: 'Press Start 2P', cursive;
          font-size: 0.7rem;
          color: #ccc;
          margin-bottom: 10px;
        }

        .candidate-input {
          width: 100%;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          color: white;
          font-family: 'Press Start 2P', cursive;
          font-size: 0.6rem;
          padding: 10px;
          resize: vertical;
          min-height: 60px;
          margin-bottom: 10px;
        }

        .candidate-input:focus {
          outline: none;
          border-color: rgba(255,255,255,0.4);
        }

        .candidate-input::placeholder {
          color: rgba(255,255,255,0.4);
        }

        .form-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .char-count {
          font-family: 'Press Start 2P', cursive;
          font-size: 0.5rem;
          color: rgba(255,255,255,0.5);
        }

        .create-btn {
          background: linear-gradient(45deg,#333,#555);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          font-family: 'Press Start 2P', cursive;
          font-size: 0.6rem;
          padding: 8px 15px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .create-btn:hover:not(:disabled) {
          background: linear-gradient(45deg,#555,#777);
          transform: translateY(-1px);
        }

        .create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .items-grid {
          display: grid;
          gap: 15px;
        }

        .governance-item {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 15px;
          transition: all 0.2s;
        }

        .governance-item:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.2);
        }

        .governance-item.promoted {
          border-color: rgba(40, 167, 69, 0.5);
          background: rgba(40, 167, 69, 0.05);
        }

        .governance-item.proposal-1 {
          border-color: rgba(40, 167, 69, 0.5);
          background: rgba(40, 167, 69, 0.05);
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .item-id {
          font-family: 'Press Start 2P', cursive;
          font-size: 0.6rem;
          color: #ccc;
        }

        .item-status {
          font-family: 'Press Start 2P', cursive;
          font-size: 0.5rem;
          padding: 2px 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.1);
        }

        .item-status.promoted,
        .item-status.status-1 {
          background: rgba(40, 167, 69, 0.2);
          color: #28a745;
        }

        .item-status.status-2 {
          background: rgba(0, 123, 255, 0.2);
          color: #007bff;
        }

        .item-content p {
          font-family: 'Press Start 2P', cursive;
          font-size: 0.6rem;
          color: white;
          line-height: 1.4;
          margin-bottom: 10px;
        }

        .item-meta {
          display: flex;
          justify-content: space-between;
          font-family: 'Press Start 2P', cursive;
          font-size: 0.5rem;
          color: rgba(255,255,255,0.6);
        }

        .vote-bar {
          display: flex;
          height: 20px;
          border-radius: 10px;
          overflow: hidden;
          background: rgba(0,0,0,0.3);
          margin: 10px 0;
        }

        .vote-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Press Start 2P', cursive;
          font-size: 0.5rem;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        .vote-segment.for { background: #28a745; }
        .vote-segment.against { background: #dc3545; }
        .vote-segment.abstain { background: #6c757d; }

        .action-btn {
          background: linear-gradient(45deg,#444,#666);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          font-family: 'Press Start 2P', cursive;
          font-size: 0.5rem;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          margin: 2px;
        }

        .action-btn:hover:not(:disabled) {
          background: linear-gradient(45deg,#666,#888);
          transform: translateY(-1px);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sponsor-btn {
          background: linear-gradient(45deg,#28a745,#20c997);
        }

        .sponsor-btn:hover:not(:disabled) {
          background: linear-gradient(45deg,#20c997,#17a2b8);
        }

        .vote-buttons {
          display: flex;
          gap: 5px;
          justify-content: center;
          margin-top: 10px;
        }

        .vote-for {
          background: linear-gradient(45deg,#28a745,#20c997);
        }

        .vote-against {
          background: linear-gradient(45deg,#dc3545,#e74c3c);
        }

        .vote-abstain {
          background: linear-gradient(45deg,#6c757d,#868e96);
        }

        .loading-text, .empty-text {
          text-align: center;
          font-family: 'Press Start 2P', cursive;
          font-size: 0.6rem;
          color: rgba(255,255,255,0.6);
          padding: 40px;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .governance-sections {
            margin: 10px;
          }

          .governance-content {
            padding: 15px;
          }

          .vote-buttons {
            flex-direction: column;
          }

          .form-footer {
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
          }
        }
      `}</style>
        </div>
    );
}