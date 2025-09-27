import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import GovernanceSections from '@/components/governance/GovernanceSections';
import { initMiniKit, getSigner, checkNFTOwnership } from '@/lib/web3';

export default function GovernancePage() {
    const router = useRouter();
    const { tab } = router.query;
    const [activeTab, setActiveTab] = useState('candidates');
    const [userOwnsNFT, setUserOwnsNFT] = useState(false);
    const [userAddress, setUserAddress] = useState('');
    const [walletConnected, setWalletConnected] = useState(false);

    // Check user permissions
    const checkUserPermissions = async () => {
        try {
            const signer = await getSigner();
            const address = await signer.getAddress();
            setUserAddress(address);
            setWalletConnected(true);

            const ownsNFT = await checkNFTOwnership(address);
            setUserOwnsNFT(ownsNFT);
        } catch (error) {
            console.log('User not connected or no NFT:', error.message);
            setUserOwnsNFT(false);
            setUserAddress('');
            setWalletConnected(false);
        }
    };

    useEffect(() => {
        // Initialize MiniKit when the component mounts
        initMiniKit();

        // Set active tab based on URL parameter
        if (tab === 'candidates' || tab === 'proposals') {
            setActiveTab(tab);
        }

        // Check user permissions on load
        checkUserPermissions();
    }, [tab]);

    return (
        <>
            <Head>
                <title>worldDao • Governance</title>
                <meta name="description" content="Participate in worldDao governance - vote on proposals and sponsor candidates" />
            </Head>
            <div className="governance-page">
                <div className="governance-page-header">
                    <div className="page-title">worldDao governance</div>
                    <div className="page-subtitle">shape the dao's future</div>
                    <button
                        className="back-btn"
                        onClick={() => router.push('/dashboard')}
                    >
                        ← back to dashboard
                    </button>
                </div>

                <div className="governance-page-tabs">
                    <button
                        className={`page-tab ${activeTab === 'candidates' ? 'active' : ''}`}
                        onClick={() => setActiveTab('candidates')}
                    >
                        <span className="tab-icon">�</span>
                        candidates
                    </button>
                    <button
                        className={`page-tab ${activeTab === 'proposals' ? 'active' : ''}`}
                        onClick={() => setActiveTab('proposals')}
                    >
                        <span className="tab-icon">�️</span>
                        proposals
                    </button>
                </div>

                {/* User Status */}
                {userAddress ? (
                    <div className="user-status-bar">
                        <span className="wallet-info">Connected: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
                        {userOwnsNFT ? (
                            <span className="nft-status has-nft">✅ NFT Holder</span>
                        ) : (
                            <span className="nft-status no-nft">❌ No NFT</span>
                        )}
                        <button className="reconnect-btn" onClick={checkUserPermissions}>
                            refresh status
                        </button>
                    </div>
                ) : (
                    <div className="user-status-bar">
                        <span className="wallet-info">Not connected</span>
                        <button className="connect-btn" onClick={checkUserPermissions}>
                            connect wallet
                        </button>
                    </div>
                )}

                <div className="governance-page-content">
                    <GovernanceSections
                        initialTab={activeTab}
                        userOwnsNFT={userOwnsNFT}
                        userAddress={userAddress}
                    />
                </div>
            </div>

            <style jsx>{`
                    .governance-page {
                        min-height: 100vh;
                        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                        color: white;
                        font-family: 'Press Start 2P', cursive;
                    }

                    .governance-page-header {
                        padding: 40px 20px;
                        text-align: center;
                        background: rgba(255, 255, 255, 0.02);
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                        position: relative;
                    }

                    .page-title {
                        font-size: 2rem;
                        color: white;
                        margin-bottom: 10px;
                        text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
                    }

                    .page-subtitle {
                        font-size: 0.8rem;
                        color: rgba(255, 255, 255, 0.7);
                        margin-bottom: 20px;
                    }

                    .back-btn {
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        color: white;
                        font-family: 'Press Start 2P', cursive;
                        font-size: 0.6rem;
                        padding: 10px 15px;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .back-btn:hover {
                        background: rgba(255, 255, 255, 0.2);
                        transform: translateY(-1px);
                    }

                    .governance-page-tabs {
                        display: flex;
                        background: rgba(255, 255, 255, 0.05);
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    }

                    .page-tab {
                        flex: 1;
                        background: transparent;
                        border: none;
                        color: rgba(255, 255, 255, 0.7);
                        font-family: 'Press Start 2P', cursive;
                        font-size: 0.7rem;
                        padding: 20px;
                        cursor: pointer;
                        transition: all 0.2s;
                        border-right: 1px solid rgba(255, 255, 255, 0.1);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                    }

                    .page-tab:last-child {
                        border-right: none;
                    }

                    .page-tab:hover {
                        background: rgba(255, 255, 255, 0.1);
                        color: white;
                    }

                    .page-tab.active {
                        background: rgba(255, 255, 255, 0.15);
                        color: white;
                        border-bottom: 2px solid #666;
                    }

                    .tab-icon {
                        font-size: 16px;
                    }

                    .user-status-bar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 15px 20px;
                        background: rgba(255, 255, 255, 0.03);
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                        font-size: 0.6rem;
                    }

                    .wallet-info {
                        color: rgba(255, 255, 255, 0.8);
                    }

                    .nft-status.has-nft {
                        color: #28a745;
                    }

                    .nft-status.no-nft {
                        color: #ffc107;
                    }

                    .connect-btn, .reconnect-btn {
                        background: linear-gradient(45deg, #333, #555);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        color: white;
                        font-family: 'Press Start 2P', cursive;
                        font-size: 0.5rem;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .connect-btn:hover, .reconnect-btn:hover {
                        background: linear-gradient(45deg, #555, #777);
                        transform: translateY(-1px);
                    }

                    .governance-page-content {
                        padding: 20px;
                    }

                    @media (max-width: 768px) {
                        .page-title {
                            font-size: 1.5rem;
                        }
                        
                        .governance-page-header {
                            padding: 30px 15px;
                        }
                        
                        .page-tab {
                            padding: 15px 10px;
                            font-size: 0.6rem;
                        }
                    }
                `}</style>
        </>
    );
}