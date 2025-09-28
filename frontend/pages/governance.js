import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import GovernanceSections from '@/components/governance/GovernanceSections';
import {
    initMiniKit,
    getSigner,
    checkNFTOwnership,
    getMiniKitStatus,
    connectWallet,
    authenticateWithMiniKit
} from '@/lib/web3';
import { useAccount } from 'wagmi';
import debugUtils from '@/lib/debug';

export default function GovernancePage() {
    const router = useRouter();
    const { tab } = router.query;
    const { address, isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState('candidates');
    const [userOwnsNFT, setUserOwnsNFT] = useState(false);

    // Check user permissions with enhanced error handling
    const checkUserPermissions = useCallback(async () => {
        if (!isConnected || !address) {
            setUserOwnsNFT(false);
            return;
        }

        try {
            console.log('Checking NFT ownership for address:', address);
            const ownsNFT = await checkNFTOwnership(address);
            console.log('NFT ownership result:', ownsNFT);
            setUserOwnsNFT(ownsNFT);
        } catch (error) {
            console.warn('NFT ownership check failed - allowing development access:', error.message);
            // In development, allow access even if NFT check fails
            setUserOwnsNFT(false);
        }
    }, [isConnected, address]);

    useEffect(() => {
        const initializePage = async () => {
            // Initialize MiniKit for World App integration
            try {
                await initMiniKit();
                const status = getMiniKitStatus();

                if (status.isWorldApp) {
                    // Auto-connect if in World App
                    try {
                        const connection = await connectWallet('auto');
                        // Connection successful, no need to log in production
                    } catch (error) {
                        // Auto-connection failed, user will need to connect manually
                    }
                }
            } catch (error) {
                // MiniKit initialization failed, fallback to Web3Modal
            }
        };

        initializePage();

        // Set active tab based on URL parameter
        if (tab === 'candidates' || tab === 'proposals') {
            setActiveTab(tab);
        }

        // Initialize debug utilities in development
        if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Governance page loaded - debug utilities available');
            debugUtils.printDebugInfo();
        }
    }, [tab]);

    useEffect(() => {
        // Check user permissions when wallet connection changes
        checkUserPermissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, address]);

    return (
        <>
            <Head>
                <title>worldDao • Governance</title>
                <meta name="description" content="Participate in worldDao governance - vote on proposals and sponsor candidates" />
            </Head>
            <div className="governance-page">
                <div className="governance-page-header">
                    <div className="page-title">worldDao governance</div>
                    <div className="page-subtitle">shape the dao&apos;s future</div>
                    <div className="header-controls">
                        <w3m-button />
                        <button
                            className="back-btn"
                            onClick={() => router.push('/dashboard')}
                        >
                            ← back to dashboard
                        </button>
                    </div>
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
                {isConnected && address ? (
                    <div className="user-status-bar">
                        <span className="wallet-info">Connected: {address.slice(0, 6)}...{address.slice(-4)}</span>
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
                        <span className="wallet-info">Not connected - use Web3Modal above to connect</span>
                    </div>
                )}

                <div className="governance-page-content">
                    <GovernanceSections
                        initialTab={activeTab}
                        userOwnsNFT={userOwnsNFT}
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

                    .header-controls {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 1rem;
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