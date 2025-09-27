import React, { useState, useEffect } from 'react';
import { getProvider, getCandidateContract, getSigner } from '@/lib/web3';
import { ethers } from 'ethers';

export default function CandidateList() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newCandidateDescription, setNewCandidateDescription] = useState('');
    const [creating, setCreating] = useState(false);
    const [sponsoring, setSponsoring] = useState({});

    const loadCandidates = async () => {
        try {
            setLoading(true);
            const provider = getProvider();
            const candidateContract = await getCandidateContract(provider);

            const candidateCount = await candidateContract.candidateCount();
            const candidatePromises = [];

            for (let i = 1; i <= candidateCount; i++) {
                candidatePromises.push(candidateContract.candidates(i));
            }

            const candidateData = await Promise.all(candidatePromises);

            const formattedCandidates = candidateData.map((candidate, index) => ({
                id: Number(candidate.id),
                proposer: candidate.proposer,
                description: candidate.description,
                sponsorCount: Number(candidate.sponsorCount),
                promoted: candidate.promoted,
                index: index + 1
            }));

            setCandidates(formattedCandidates);
        } catch (error) {
            console.error('Failed to load candidates:', error);
            alert('Failed to load candidates: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const createCandidate = async () => {
        if (!newCandidateDescription.trim()) {
            alert('Please enter a candidate description');
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

            console.log('Transaction submitted:', tx.hash);
            await tx.wait();

            setNewCandidateDescription('');
            await loadCandidates();
            alert('Candidate created successfully!');
        } catch (error) {
            console.error('Failed to create candidate:', error);
            alert('Failed to create candidate: ' + error.message);
        } finally {
            setCreating(false);
        }
    };

    const sponsorCandidate = async (candidateId) => {
        try {
            setSponsoring(prev => ({ ...prev, [candidateId]: true }));
            const signer = await getSigner();
            const candidateContract = await getCandidateContract(signer);

            const tx = await candidateContract.sponsorCandidate(candidateId);
            console.log('Sponsor transaction submitted:', tx.hash);
            await tx.wait();

            await loadCandidates();
            alert('Candidate sponsored successfully!');
        } catch (error) {
            console.error('Failed to sponsor candidate:', error);
            alert('Failed to sponsor candidate: ' + error.message);
        } finally {
            setSponsoring(prev => ({ ...prev, [candidateId]: false }));
        }
    };

    useEffect(() => {
        loadCandidates();
    }, []);

    return (
        <div className="candidate-list">
            <div className="candidate-header">
                <h2>Proposal Candidates</h2>
                <p>Create candidates that need community sponsorship to become governance proposals</p>
            </div>

            {/* Create New Candidate */}
            <div className="create-candidate-form">
                <h3>Create New Candidate</h3>
                <div className="form-group">
                    <textarea
                        placeholder="Describe your proposal candidate..."
                        value={newCandidateDescription}
                        onChange={(e) => setNewCandidateDescription(e.target.value)}
                        rows={4}
                        maxLength={500}
                    />
                    <small>{newCandidateDescription.length}/500 characters</small>
                </div>
                <button
                    onClick={createCandidate}
                    disabled={creating || !newCandidateDescription.trim()}
                    className="create-btn"
                >
                    {creating ? 'Creating...' : 'Create Candidate (0.01 ETH)'}
                </button>
            </div>

            {/* Candidates List */}
            <div className="candidates-grid">
                <h3>All Candidates ({candidates.length})</h3>
                {loading ? (
                    <div className="loading">Loading candidates...</div>
                ) : candidates.length === 0 ? (
                    <div className="no-candidates">
                        No candidates yet. Be the first to create one!
                    </div>
                ) : (
                    candidates.map((candidate) => (
                        <div
                            key={candidate.id}
                            className={`candidate-card ${candidate.promoted ? 'promoted' : ''}`}
                        >
                            <div className="candidate-header">
                                <span className="candidate-id">#{candidate.id}</span>
                                <span className={`candidate-status ${candidate.promoted ? 'promoted' : 'pending'}`}>
                                    {candidate.promoted ? '✅ Promoted' : '⏳ Needs Sponsors'}
                                </span>
                            </div>

                            <div className="candidate-content">
                                <p className="description">{candidate.description}</p>
                                <div className="candidate-meta">
                                    <small>Proposer: {candidate.proposer.slice(0, 6)}...{candidate.proposer.slice(-4)}</small>
                                    <div className="sponsor-info">
                                        <span className="sponsor-count">
                                            {candidate.sponsorCount} sponsors
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {!candidate.promoted && (
                                <div className="candidate-actions">
                                    <button
                                        onClick={() => sponsorCandidate(candidate.id)}
                                        disabled={sponsoring[candidate.id]}
                                        className="sponsor-btn"
                                    >
                                        {sponsoring[candidate.id] ? 'Sponsoring...' : 'Sponsor Candidate'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <style jsx>{`
        .candidate-list {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .candidate-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .candidate-header h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .candidate-header p {
          color: #666;
          font-size: 14px;
        }

        .create-candidate-form {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
          border: 2px solid #e9ecef;
        }

        .create-candidate-form h3 {
          margin-bottom: 15px;
          color: #333;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          min-height: 100px;
        }

        .form-group textarea:focus {
          outline: none;
          border-color: #0066cc;
        }

        .form-group small {
          color: #666;
          font-size: 12px;
        }

        .create-btn {
          background: #0066cc;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
        }

        .create-btn:hover:not(:disabled) {
          background: #0052a3;
        }

        .create-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .candidates-grid h3 {
          margin-bottom: 20px;
          color: #333;
        }

        .loading, .no-candidates {
          text-align: center;
          padding: 40px;
          color: #666;
          font-style: italic;
        }

        .candidate-card {
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
          transition: all 0.2s;
        }

        .candidate-card:hover {
          border-color: #dee2e6;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .candidate-card.promoted {
          border-color: #28a745;
          background: #f8fff9;
        }

        .candidate-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .candidate-id {
          font-weight: 600;
          color: #666;
        }

        .candidate-status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .candidate-status.promoted {
          background: #d4edda;
          color: #155724;
        }

        .candidate-status.pending {
          background: #fff3cd;
          color: #856404;
        }

        .candidate-content .description {
          margin-bottom: 15px;
          line-height: 1.5;
          color: #333;
        }

        .candidate-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .candidate-meta small {
          color: #666;
        }

        .sponsor-count {
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .candidate-actions {
          text-align: right;
        }

        .sponsor-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .sponsor-btn:hover:not(:disabled) {
          background: #218838;
        }

        .sponsor-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
        </div>
    );
}