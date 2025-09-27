import React, { useState } from 'react';
import { checkAllContracts, validateContractAddresses } from '@/lib/contractChecker';

export default function ContractChecker() {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleCheck = async () => {
        setLoading(true);
        setError(null);

        try {
            const results = await checkAllContracts();
            setResults(results);
        } catch (err) {
            setError(err.message);
            console.error('Contract check failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const validateAddresses = () => {
        validateContractAddresses();
    };

    const getStatusColor = (contract) => {
        if (!contract.deployed) return '#ff4757';
        if (contract.functionality && contract.functionality.includes('Working ✅')) return '#2ed573';
        return '#ffa502';
    };

    const getStatusIcon = (contract) => {
        if (!contract.deployed) return '❌';
        if (contract.functionality && contract.functionality.includes('Working ✅')) return '✅';
        return '⚠️';
    };

    return (
        <div style={{
            padding: '20px',
            fontFamily: '"Press Start 2P", monospace',
            background: '#1a1a1a',
            color: 'white',
            borderRadius: '8px',
            margin: '20px'
        }}>
            <h2 style={{ marginBottom: '20px', fontSize: '1rem' }}>🔍 Contract Deployment Checker</h2>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={validateAddresses}
                    style={{
                        padding: '10px 15px',
                        marginRight: '10px',
                        fontSize: '0.7rem',
                        background: '#3742fa',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Validate Addresses
                </button>

                <button
                    onClick={handleCheck}
                    disabled={loading}
                    style={{
                        padding: '10px 15px',
                        fontSize: '0.7rem',
                        background: loading ? '#666' : '#2ed573',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'Checking...' : 'Check All Contracts'}
                </button>
            </div>

            {error && (
                <div style={{
                    background: '#ff4757',
                    padding: '10px',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    fontSize: '0.7rem'
                }}>
                    Error: {error}
                </div>
            )}

            {results && (
                <div>
                    <div style={{ marginBottom: '20px', fontSize: '0.8rem' }}>
                        <h3>📊 Network Info:</h3>
                        <p>Chain ID: {results.network.chainId}</p>
                        <p>Network: {results.network.name}</p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '0.9rem' }}>📋 Contract Status:</h3>

                        {results.contracts.map((contract, index) => (
                            <div
                                key={index}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    padding: '10px',
                                    margin: '10px 0',
                                    borderRadius: '4px',
                                    borderLeft: `4px solid ${getStatusColor(contract)}`
                                }}
                            >
                                <div style={{ fontSize: '0.7rem', marginBottom: '5px' }}>
                                    {getStatusIcon(contract)} <strong>{contract.name}</strong>
                                </div>

                                <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                                    Address: {contract.address}
                                </div>

                                <div style={{ fontSize: '0.6rem', margin: '5px 0' }}>
                                    Status: {contract.deployed ? 'Deployed' : 'Not Deployed'}
                                </div>

                                {contract.functionality && (
                                    <div style={{ fontSize: '0.6rem', margin: '5px 0' }}>
                                        Functionality: {contract.functionality}
                                    </div>
                                )}

                                {contract.details && (
                                    <div style={{ fontSize: '0.6rem', marginTop: '5px' }}>
                                        <details>
                                            <summary>Details</summary>
                                            <pre style={{ fontSize: '0.5rem', overflow: 'auto' }}>
                                                {JSON.stringify(contract.details, null, 2)}
                                            </pre>
                                        </details>
                                    </div>
                                )}

                                {contract.error && (
                                    <div style={{ fontSize: '0.6rem', color: '#ff4757', marginTop: '5px' }}>
                                        Error: {contract.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{
                        background: 'rgba(46, 213, 115, 0.1)',
                        padding: '10px',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                    }}>
                        <h4>📈 Summary:</h4>
                        <p>Deployed: {results.summary.deployed}/{results.summary.total} contracts</p>
                        <p>Working: {results.summary.working}/{results.summary.deployed} deployed contracts</p>
                    </div>
                </div>
            )}
        </div>
    );
}