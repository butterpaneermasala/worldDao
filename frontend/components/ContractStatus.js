import React, { useState, useEffect } from 'react';
import { getProvider } from '@/lib/web3';

export default function ContractStatus() {
    const [contracts, setContracts] = useState({});
    const [deploymentCheck, setDeploymentCheck] = useState(null);
    const [loading, setLoading] = useState(true);
    const [checkingDeployments, setCheckingDeployments] = useState(false);

    useEffect(() => {
        checkAllContracts();
    }, []);

    const checkAllContracts = async () => {
        const contractAddresses = {
            'Voting': process.env.NEXT_PUBLIC_VOTING_ADDRESS,
            'Auction': process.env.NEXT_PUBLIC_AUCTION_ADDRESS,
            'Governor': process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS,
            'Candidate': process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS,
            'World NFT': process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS,
            'Treasury': process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
        };

        const results = {};

        try {
            const provider = getProvider();
            const network = await provider.getNetwork();

            for (const [name, address] of Object.entries(contractAddresses)) {
                if (!address || address === '0x0000000000000000000000000000000000000000') {
                    results[name] = {
                        status: 'Not Configured',
                        address: 'N/A',
                        network: network.name,
                        chainId: Number(network.chainId)
                    };
                    continue;
                }

                try {
                    const code = await provider.getCode(address);
                    const codeSize = code.length;

                    if (code === '0x' || code === '0x0') {
                        results[name] = {
                            status: 'Not Deployed ❌',
                            address,
                            network: network.name,
                            chainId: Number(network.chainId),
                            codeSize: 0
                        };
                    } else {
                        // Try to get creation block/timestamp
                        let deploymentInfo = '';
                        try {
                            const balance = await provider.getBalance(address);
                            deploymentInfo = `Balance: ${parseFloat(balance.toString()) / 1e18} ETH`;
                        } catch (e) {
                            deploymentInfo = 'Balance check failed';
                        }

                        results[name] = {
                            status: 'Deployed ✅',
                            address,
                            network: network.name,
                            chainId: Number(network.chainId),
                            codeSize: Math.round(codeSize / 2), // Convert hex to bytes
                            deploymentInfo
                        };
                    }
                } catch (err) {
                    results[name] = {
                        status: 'Error ⚠️',
                        address,
                        error: err.message,
                        network: network.name,
                        chainId: Number(network.chainId)
                    };
                }
            }
        } catch (err) {
            console.error('Failed to check contracts:', err);
        }

        setContracts(results);
        setLoading(false);
    };

    const checkDeployments = async () => {
        setCheckingDeployments(true);
        try {
            const response = await fetch('/api/check-deployments');
            const data = await response.json();
            setDeploymentCheck(data);
        } catch (err) {
            console.error('Failed to check deployments:', err);
            setDeploymentCheck({ error: err.message });
        } finally {
            setCheckingDeployments(false);
        }
    };

    if (loading) {
        return <div className="contract-status loading">Checking contracts...</div>;
    }

    return (
        <div className="contract-status">
            <h3>📋 Contract Deployment Status</h3>
            <div className="contract-list">
                {Object.entries(contracts).map(([name, info]) => (
                    <div key={name} className={`contract-item ${info.status.includes('✅') ? 'deployed' : 'not-deployed'}`}>
                        <div className="contract-name">{name}</div>
                        <div className="contract-status-text">{info.status}</div>
                        <div className="contract-address">
                            📍 {info.address}
                            {info.chainId && <span className="chain-info"> (Chain: {info.chainId})</span>}
                        </div>
                        {info.codeSize && (
                            <div className="contract-details">
                                📊 Code Size: {info.codeSize} bytes | {info.deploymentInfo}
                            </div>
                        )}
                        {info.error && <div className="contract-error">❌ {info.error}</div>}
                    </div>
                ))}
            </div>

            <div className="contract-actions">
                <button onClick={checkAllContracts} className="refresh-contracts">
                    🔄 Refresh Status
                </button>
                <button onClick={checkDeployments} className="check-deployments" disabled={checkingDeployments}>
                    {checkingDeployments ? '🔍 Checking...' : '📂 Check Latest Deployments'}
                </button>
            </div>

            {deploymentCheck && (
                <div className="deployment-comparison">
                    <h4>📋 Deployment Comparison</h4>
                    {deploymentCheck.error ? (
                        <div className="deployment-error">❌ {deploymentCheck.error}</div>
                    ) : (
                        <div className="comparison-list">
                            {Object.entries(deploymentCheck.comparison || {}).map(([key, info]) => (
                                <div key={key} className={`comparison-item ${info.isUpToDate ? 'up-to-date' : 'needs-update'}`}>
                                    <div className="comparison-name">{key.toUpperCase()}</div>
                                    <div className="comparison-status">
                                        {info.isUpToDate ? '✅ Up to date' : info.needsUpdate ? '⚠️ Needs update' : '❓ No latest found'}
                                    </div>
                                    <div className="comparison-addresses">
                                        <div>Current: {info.current}</div>
                                        <div>Latest: {info.latest}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}