import React, { useState, useEffect } from 'react';
import {
  getProvider,
  getGovernorContract,
  getSigner,
  verifyForVoting,
  verifyForGovernance,
  getMiniKitStatus,
  authenticateWithMiniKit
} from '@/lib/web3';
import { ethers } from 'ethers';

const VOTE_CHOICES = {
  0: 'Against',
  1: 'For',
  2: 'Abstain'
};

const PROPOSAL_STATES = {
  0: 'Pending',
  1: 'Active',
  2: 'Succeeded',
  3: 'Defeated',
  4: 'Executed'
};

export default function ProposalList() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [voting, setVoting] = useState({});
  const [executing, setExecuting] = useState({});

  const loadProposals = async () => {
    try {
      setLoading(true);
      const provider = getProvider();
      const governorContract = await getGovernorContract(provider);

      const proposalCount = await governorContract.proposalCount();
      const proposalPromises = [];

      for (let i = 1; i <= proposalCount; i++) {
        proposalPromises.push(governorContract.getProposal(i));
      }

      if (proposalPromises.length === 0) {
        setProposals([]);
        return;
      }

      const proposalData = await Promise.all(proposalPromises);

      const formattedProposals = proposalData.map((proposal, index) => ({
        id: Number(proposal.id),
        proposer: proposal.proposer,
        description: proposal.description,
        startBlock: Number(proposal.startBlock),
        endBlock: Number(proposal.endBlock),
        forVotes: Number(proposal.forVotes),
        againstVotes: Number(proposal.againstVotes),
        abstainVotes: Number(proposal.abstainVotes),
        state: Number(proposal.state),
        index: index + 1
      }));

      setProposals(formattedProposals);
    } catch (error) {
      console.error('Failed to load proposals:', error);
      alert('Failed to load proposals: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const vote = async (proposalId, voteChoice) => {
    try {
      setVoting(prev => ({ ...prev, [proposalId]: true }));

      const miniKitStatus = getMiniKitStatus();

      // Enhanced MiniKit integration for voting
      if (miniKitStatus.isWorldApp && miniKitStatus.ready) {
        try {
          // Authenticate user first if in World App
          const authResult = await authenticateWithMiniKit();

          // Get World ID verification for voting
          const worldIdProof = await verifyForVoting(proposalId, voteChoice);

          // TODO: When contract supports World ID verification, use this:
          // const tx = await governorContract.voteWithWorldId(
          //   proposalId, voteChoice, worldIdProof.proof, 
          //   worldIdProof.merkleRoot, worldIdProof.nullifierHash
          // );

          // Store verification data for potential future use
          // This could be sent to backend or used for analytics

        } catch (miniKitError) {
          // MiniKit enhanced voting failed, continue with standard flow
        }
      }

      // Get signer and contract (works for both MiniKit and Web3Modal)
      const signer = await getSigner();
      const governorContract = await getGovernorContract(signer);

      // Execute the vote transaction
      const tx = await governorContract.vote(proposalId, voteChoice);
      console.log('Vote transaction submitted:', tx.hash);
      await tx.wait();

      await loadProposals();
      alert('Vote cast successfully!');
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('Failed to vote: ' + error.message);
    } finally {
      setVoting(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const executeProposal = async (proposalId) => {
    try {
      setExecuting(prev => ({ ...prev, [proposalId]: true }));
      const signer = await getSigner();
      const governorContract = await getGovernorContract(signer);

      const tx = await governorContract.execute(proposalId);
      console.log('Execute transaction submitted:', tx.hash);
      await tx.wait();

      await loadProposals();
      alert('Proposal executed successfully!');
    } catch (error) {
      console.error('Failed to execute proposal:', error);
      alert('Failed to execute proposal: ' + error.message);
    } finally {
      setExecuting(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const calculateVotePercentages = (proposal) => {
    const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
    if (total === 0) return { for: 0, against: 0, abstain: 0 };

    return {
      for: Math.round((proposal.forVotes / total) * 100),
      against: Math.round((proposal.againstVotes / total) * 100),
      abstain: Math.round((proposal.abstainVotes / total) * 100)
    };
  };

  useEffect(() => {
    loadProposals();
  }, []);

  return (
    <div className="proposal-list">
      <div className="proposal-header">
        <h2>Governance Proposals</h2>
        <p>Vote on active proposals that shape the future of the DAO</p>
        <button onClick={loadProposals} disabled={loading} className="refresh-btn">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="proposals-grid">
        {loading ? (
          <div className="loading">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <div className="no-proposals">
            No proposals yet. Candidates need to be promoted to become proposals.
          </div>
        ) : (
          proposals.map((proposal) => {
            const percentages = calculateVotePercentages(proposal);
            const isActive = proposal.state === 1;
            const isSucceeded = proposal.state === 2;
            const canExecute = isSucceeded;

            return (
              <div key={proposal.id} className={`proposal-card state-${proposal.state}`}>
                <div className="proposal-header">
                  <span className="proposal-id">Proposal #{proposal.id}</span>
                  <span className={`proposal-status status-${proposal.state}`}>
                    {PROPOSAL_STATES[proposal.state]}
                  </span>
                </div>

                <div className="proposal-content">
                  <p className="description">{proposal.description}</p>

                  <div className="proposal-meta">
                    <small>Proposer: {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}</small>
                    <small>Blocks: {proposal.startBlock} → {proposal.endBlock}</small>
                  </div>

                  <div className="voting-results">
                    <div className="vote-bar">
                      <div className="vote-section for" style={{ width: `${percentages.for}%` }}>
                        <span>{percentages.for}% For ({proposal.forVotes})</span>
                      </div>
                      <div className="vote-section against" style={{ width: `${percentages.against}%` }}>
                        <span>{percentages.against}% Against ({proposal.againstVotes})</span>
                      </div>
                      <div className="vote-section abstain" style={{ width: `${percentages.abstain}%` }}>
                        <span>{percentages.abstain}% Abstain ({proposal.abstainVotes})</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="proposal-actions">
                  {isActive && (
                    <div className="voting-buttons">
                      <button
                        onClick={() => vote(proposal.id, 1)}
                        disabled={voting[proposal.id]}
                        className="vote-btn vote-for"
                      >
                        {voting[proposal.id] ? 'Voting...' : '✓ Vote For'}
                      </button>
                      <button
                        onClick={() => vote(proposal.id, 0)}
                        disabled={voting[proposal.id]}
                        className="vote-btn vote-against"
                      >
                        {voting[proposal.id] ? 'Voting...' : '✗ Vote Against'}
                      </button>
                      <button
                        onClick={() => vote(proposal.id, 2)}
                        disabled={voting[proposal.id]}
                        className="vote-btn vote-abstain"
                      >
                        {voting[proposal.id] ? 'Voting...' : '~ Abstain'}
                      </button>
                    </div>
                  )}

                  {canExecute && (
                    <button
                      onClick={() => executeProposal(proposal.id)}
                      disabled={executing[proposal.id]}
                      className="execute-btn"
                    >
                      {executing[proposal.id] ? 'Executing...' : 'Execute Proposal'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        .proposal-list {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }

        .proposal-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .proposal-header h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .proposal-header p {
          color: #666;
          font-size: 14px;
          margin-bottom: 15px;
        }

        .refresh-btn {
          background: #0066cc;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-btn:hover:not(:disabled) {
          background: #0052a3;
        }

        .loading, .no-proposals {
          text-align: center;
          padding: 40px;
          color: #666;
          font-style: italic;
        }

        .proposal-card {
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          transition: all 0.2s;
        }

        .proposal-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .proposal-card.state-1 {
          border-color: #28a745;
          background: #f8fff9;
        }

        .proposal-card.state-2 {
          border-color: #007bff;
          background: #f0f8ff;
        }

        .proposal-card.state-3 {
          border-color: #dc3545;
          background: #fff5f5;
        }

        .proposal-card.state-4 {
          border-color: #6f42c1;
          background: #f8f5ff;
        }

        .proposal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .proposal-id {
          font-weight: 600;
          color: #333;
        }

        .proposal-status {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-0 { background: #fff3cd; color: #856404; }
        .status-1 { background: #d4edda; color: #155724; }
        .status-2 { background: #cce7ff; color: #004085; }
        .status-3 { background: #f8d7da; color: #721c24; }
        .status-4 { background: #e2d9f3; color: #4a235a; }

        .proposal-content .description {
          margin-bottom: 15px;
          line-height: 1.5;
          color: #333;
          font-size: 15px;
        }

        .proposal-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .proposal-meta small {
          color: #666;
          font-size: 12px;
        }

        .voting-results {
          margin-bottom: 20px;
        }

        .vote-bar {
          display: flex;
          height: 30px;
          border-radius: 15px;
          overflow: hidden;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
        }

        .vote-section {
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
          min-width: 0;
        }

        .vote-section.for { background: #28a745; }
        .vote-section.against { background: #dc3545; }
        .vote-section.abstain { background: #6c757d; }

        .vote-section span {
          white-space: nowrap;
          overflow: hidden;
        }

        .proposal-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .voting-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .vote-btn {
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          flex: 1;
          min-width: 100px;
        }

        .vote-for { 
          background: #28a745; 
          color: white; 
        }
        .vote-for:hover:not(:disabled) { 
          background: #218838; 
        }

        .vote-against { 
          background: #dc3545; 
          color: white; 
        }
        .vote-against:hover:not(:disabled) { 
          background: #c82333; 
        }

        .vote-abstain { 
          background: #6c757d; 
          color: white; 
        }
        .vote-abstain:hover:not(:disabled) { 
          background: #545b62; 
        }

        .execute-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
        }

        .execute-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .vote-btn:disabled, .execute-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .voting-buttons {
            flex-direction: column;
          }
          
          .vote-btn {
            min-width: auto;
          }
          
          .proposal-meta {
            flex-direction: column;
            gap: 5px;
          }
        }
      `}</style>
    </div>
  );
}