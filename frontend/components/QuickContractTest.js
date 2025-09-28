import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function QuickContractTest() {
    const [results, setResults] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        testContracts();
    }, []);

    const testContracts = async () => {
        console.log('Testing contract deployments...');

        // Log what environment variables we're getting
        console.log('Environment variables:');
        console.log('VOTING:', process.env.NEXT_PUBLIC_VOTING_ADDRESS);
        console.log('AUCTION:', process.env.NEXT_PUBLIC_AUCTION_ADDRESS);
        console.log('MINTER:', process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS);
        console.log('TREASURY:', process.env.NEXT_PUBLIC_TREASURY_ADDRESS);

        const addresses = {
            Voting: process.env.NEXT_PUBLIC_VOTING_ADDRESS,
            Auction: process.env.NEXT_PUBLIC_AUCTION_ADDRESS,
            Minter: process.env.NEXT_PUBLIC_NFT_MINTER_ADDRESS,
            Treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
        };

        const provider = new ethers.JsonRpcProvider('https://worldchain-sepolia.g.alchemy.com/public');
        const testResults = {};

        for (const [name, address] of Object.entries(addresses)) {
            if (!address) {
                testResults[name] = { status: 'NO_ADDRESS', address: 'undefined' };
                continue;
            }

            try {
                const code = await provider.getCode(address);
                const isDeployed = code !== '0x';
                testResults[name] = {
                    status: isDeployed ? 'DEPLOYED' : 'NOT_DEPLOYED',
                    address: address,
                    codeLength: code.length
                };
            } catch (error) {
                testResults[name] = {
                    status: 'ERROR',
                    address: address,
                    error: error.message
                };
            }
        }

        console.log('Test results:', testResults);
        setResults(testResults);
        setLoading(false);
    };

    if (loading) return <div>Testing contracts...</div>;

    return (
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5', margin: '20px', borderRadius: '8px' }}>
            <h3>🧪 Contract Deployment Test</h3>
            {Object.entries(results).map(([name, result]) => (
                <div key={name} style={{ margin: '10px 0', padding: '10px', backgroundColor: 'white', borderRadius: '4px' }}>
                    <strong>{name}:</strong> {result.status} <br />
                    <small>Address: {result.address}</small> <br />
                    {result.error && <small style={{ color: 'red' }}>Error: {result.error}</small>}
                    {result.codeLength && <small>Code Length: {result.codeLength}</small>}
                </div>
            ))}
        </div>
    );
}