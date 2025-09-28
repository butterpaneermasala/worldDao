import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '@/pages/_app';
import { useAccount } from 'wagmi';
import { getProvider, getSigner, getContract, getContractRPC, getRPCProvider } from '@/lib/web3';

export default function VotingGallery() {
    const { items, setItems, pinataConfig } = useContext(AppContext);
    const { address, isConnected } = useAccount();

    // Voting state
    const [isVotingOpen, setIsVotingOpen] = useState(false);
    const [phaseInfo, setPhaseInfo] = useState({ phase: 0, endTime: 0 });
    const [timeLeft, setTimeLeft] = useState(0);
    const [voting, setVoting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Winner state
    const [winner, setWinner] = useState(null);
    const [showResults, setShowResults] = useState(false);

    // Timer effect
    useEffect(() => {
        if (phaseInfo.endTime > 0) {
            const interval = setInterval(() => {
                const now = Math.floor(Date.now() / 1000);
                const left = phaseInfo.endTime - now;
                setTimeLeft(Math.max(0, left));

                // Auto-refresh when voting ends
                if (left <= 0 && isVotingOpen) {
                    checkVotingStatus();
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [phaseInfo.endTime, isVotingOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-refresh during voting
    useEffect(() => {
        if (isVotingOpen) {
            const interval = setInterval(() => {
                loadProposals();
            }, 10000); // Refresh every 10 seconds during voting

            return () => clearInterval(interval);
        }
    }, [isVotingOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Initial load
    useEffect(() => {
        initializeVoting();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const initializeVoting = async () => {
        setLoading(true);
        try {
            await checkVotingStatus();
            await loadProposals();
        } catch (err) {
            setError(`Failed to initialize: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const checkVotingStatus = async () => {
        try {
            const votingAddress = process.env.NEXT_PUBLIC_VOTING_ADDRESS;
            if (!votingAddress || votingAddress === '0x0000000000000000000000000000000000000000') {
                console.warn('Voting contract address not configured');
                setIsVotingOpen(false);
                setError('Voting contract not configured');
                return;
            }

            const provider = getRPCProvider();
            const contract = await getContractRPC();

            // Check if contract is deployed
            const code = await provider.getCode(contract.target || contract.address);
            if (code === '0x' || code === '0x0') {
                console.warn('Voting contract not deployed at:', contract.target || contract.address);
                setIsVotingOpen(false);
                setError('Voting contract not deployed');
                return;
            }

            // Test if contract has expected functions
            try {
                const open = await contract.isVotingOpen();
                setIsVotingOpen(open);
            } catch (funcError) {
                console.error('Contract missing isVotingOpen function:', funcError);
                setIsVotingOpen(false);
                setError('Voting contract missing required functions');
                return;
            }

            // Try to get phase info (optional)
            try {
                const info = await contract.currentPhaseInfo();
                setPhaseInfo({
                    phase: Number(info.phase),
                    endTime: Number(info.endTime)
                });
            } catch (phaseError) {
                console.warn('Could not get phase info:', phaseError);
                // Set default values if phase info not available
                setPhaseInfo({ phase: 0, endTime: 0 });
            }

            // If voting ended, calculate winner
            if (!isVotingOpen && items.length > 0) {
                calculateWinner();
            }

        } catch (err) {
            console.error('Failed to check voting status:', err);
            setIsVotingOpen(false);
            setError(`Contract connection failed: ${err.message}`);
        }
    };

    const loadProposals = async () => {
        try {
            // Load from Pinata
            const res = await fetch('/api/pinata/slots');
            if (!res.ok) throw new Error(`Failed to fetch slots: ${res.status}`);

            const data = await res.json();
            let slots = Array.isArray(data.slots) ? data.slots : [];
            let proposals = slots
                .filter(s => s && s.hasContent)
                .map(s => ({
                    index: s.index,
                    url: s.url,
                    name: s.name || `NFT ${s.index + 1}`,
                    cid: s.cid,
                    tokenURI: s.tokenURI,
                    votes: 0
                }));

            // Get vote counts if contract available and properly deployed
            if ((isVotingOpen || proposals.length > 0) && !error) {
                try {
                    const provider = getRPCProvider();
                    const contract = await getContractRPC();

                    // Check if contract is deployed and has expected functions
                    const code = await provider.getCode(contract.target || contract.address);
                    if (code === '0x' || code === '0x0') {
                        console.warn('Cannot load votes: Contract not deployed');
                        // Keep proposals with 0 votes
                    } else {
                        // Test slotVotes function with first proposal
                        if (proposals.length > 0) {
                            try {
                                await contract.slotVotes(proposals[0].index);

                                // If test succeeds, load all votes
                                const votes = await Promise.all(
                                    proposals.map(async (p) => {
                                        try {
                                            return await contract.slotVotes(p.index);
                                        } catch (err) {
                                            console.warn(`Failed to get votes for proposal ${p.index}:`, err);
                                            return 0;
                                        }
                                    })
                                );

                                proposals = proposals.map((p, i) => ({
                                    ...p,
                                    votes: Number(votes[i]) || 0
                                }));
                            } catch (testError) {
                                console.warn('Contract missing slotVotes function or returning bad data:', testError);
                                // Keep proposals with 0 votes
                            }
                        }
                    }
                } catch (err) {
                    console.warn('Failed to load votes:', err);
                    // Keep proposals with 0 votes - don't fail completely
                }
            }

            setItems(proposals);

            // Calculate winner if voting ended
            if (!isVotingOpen && proposals.length > 0) {
                calculateWinner(proposals);
            }

        } catch (err) {
            setError(`Failed to load proposals: ${err.message}`);
        }
    };

    const calculateWinner = (proposals = items) => {
        if (proposals.length === 0) return;

        const sorted = [...proposals].sort((a, b) => b.votes - a.votes);
        const winnerProposal = sorted[0];

        setWinner({
            ...winnerProposal,
            isWinner: true,
            totalVotes: proposals.reduce((sum, p) => sum + p.votes, 0)
        });
        setShowResults(true);
    };

    const handleVote = async (proposalIndex) => {
        if (!isConnected) {
            alert('Please connect your wallet to vote');
            return;
        }

        if (!isVotingOpen) {
            alert('Voting is not currently open');
            return;
        }

        try {
            setVoting(true);
            const signer = await getSigner();
            const contract = await getContract(signer);

            const tx = await contract.voteIndex(proposalIndex);
            await tx.wait();

            // Refresh proposals to show updated votes
            await loadProposals();

            alert('Vote submitted successfully! 🗳️');

        } catch (err) {
            console.error('Voting failed:', err);
            alert(`Voting failed: ${err.message}`);
        } finally {
            setVoting(false);
        }
    };

    const formatTimeLeft = (seconds) => {
        if (seconds <= 0) return "Voting Ended";

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    if (loading) {
        return (
            <div className="voting-gallery loading">
                <div className="loading-spinner">🔄</div>
                <p>Loading voting gallery...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="voting-gallery error">
                <div className="error-icon">⚠️</div>
                <p>Error: {error}</p>
                <button onClick={initializeVoting} className="retry-button">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="voting-gallery">
            {/* Voting Status Header */}
            <div className="voting-header">
                <div className="voting-status">
                    <span className={`status-indicator ${isVotingOpen ? 'open' : 'closed'}`}>
                        {isVotingOpen ? '🟢 VOTING OPEN' : '🔴 VOTING CLOSED'}
                    </span>

                    {isVotingOpen && (
                        <div className="timer">
                            <span className="timer-label">Time Left:</span>
                            <span className={`timer-value ${timeLeft < 300 ? 'urgent' : ''}`}>
                                {formatTimeLeft(timeLeft)}
                            </span>
                        </div>
                    )}
                </div>

                <div className="voting-stats">
                    <span>Proposals: {items.length}</span>
                    <span>Total Votes: {items.reduce((sum, item) => sum + (item.votes || 0), 0)}</span>
                    {!isConnected && <span className="connect-prompt">Connect wallet to vote</span>}
                </div>
            </div>

            {/* Winner Announcement */}
            {showResults && winner && (
                <div className="winner-announcement">
                    <h3>🏆 Voting Results</h3>
                    <div className="winner-card">
                        <img src={winner.url} alt={winner.name} className="winner-image" />
                        <div className="winner-info">
                            <h4>{winner.name}</h4>
                            <p>Winner with {winner.votes} votes!</p>
                            <p>Total participation: {winner.totalVotes} votes</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowResults(false)}
                        className="close-results"
                    >
                        Close Results
                    </button>
                </div>
            )}

            {/* NFT Gallery Grid */}
            <div className="nft-gallery-grid">
                {items.length === 0 ? (
                    <div className="no-proposals">
                        <p>No proposals available for voting</p>
                    </div>
                ) : (
                    items.map((item, idx) => (
                        <div
                            key={`${item.index}-${idx}`}
                            className={`nft-card ${winner?.index === item.index ? 'winner' : ''}`}
                        >
                            <div className="nft-image-container">
                                <img
                                    src={item.url}
                                    alt={item.name}
                                    className="nft-image"
                                    onError={(e) => {
                                        if (item.cid) {
                                            e.currentTarget.onerror = null;
                                            const gw = pinataConfig.gatewayBase || 'https://gateway.pinata.cloud/ipfs/';
                                            e.currentTarget.src = `${gw}${item.cid}`;
                                        }
                                    }}
                                />
                                {winner?.index === item.index && (
                                    <div className="winner-badge">🏆 WINNER</div>
                                )}
                            </div>

                            <div className="nft-info">
                                <h4 className="nft-name">{item.name}</h4>
                                <div className="vote-info">
                                    <span className="vote-count">
                                        {item.votes || 0} votes
                                    </span>
                                    {item.votes > 0 && items.length > 0 && (
                                        <span className="vote-percentage">
                                            ({Math.round((item.votes / Math.max(1, items.reduce((sum, i) => sum + (i.votes || 0), 0))) * 100)}%)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {isVotingOpen && (
                                <button
                                    className={`vote-button ${voting ? 'voting' : ''}`}
                                    onClick={() => handleVote(item.index)}
                                    disabled={!isConnected || voting}
                                >
                                    {voting ? '🗳️ Voting...' : '🗳️ Vote'}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Refresh Button */}
            <div className="gallery-controls">
                <button
                    onClick={loadProposals}
                    className="refresh-button"
                    disabled={loading}
                >
                    🔄 Refresh Proposals
                </button>

                {winner && !showResults && (
                    <button
                        onClick={() => setShowResults(true)}
                        className="show-results-button"
                    >
                        🏆 Show Results
                    </button>
                )}
            </div>
        </div>
    );
}