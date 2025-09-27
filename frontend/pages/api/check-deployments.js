import { promises as fs } from 'fs';
import path from 'path';

/**
 * API endpoint to check current contract addresses against latest deployments
 * GET /api/check-deployments
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Current addresses from environment
        const currentAddresses = {
            voting: process.env.NEXT_PUBLIC_VOTING_ADDRESS,
            auction: process.env.NEXT_PUBLIC_AUCTION_ADDRESS,
            governor: process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS,
            candidate: process.env.NEXT_PUBLIC_CANDIDATE_ADDRESS,
            worldNft: process.env.NEXT_PUBLIC_WORLD_NFT_ADDRESS,
            treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
        };

        // Check latest deployment files
        const deploymentsPath = path.join(process.cwd(), '..', 'contracts');
        let latestDeployments = {};

        try {
            // Check world-governor deployments
            const governorDeploymentsPath = path.join(deploymentsPath, 'world-governor', 'deployments');
            const governorFiles = await fs.readdir(governorDeploymentsPath);
            const latestGovernorFile = governorFiles
                .filter(f => f.endsWith('.json'))
                .sort()
                .pop();

            if (latestGovernorFile) {
                const governorData = JSON.parse(
                    await fs.readFile(path.join(governorDeploymentsPath, latestGovernorFile), 'utf-8')
                );
                latestDeployments.governor = governorData.governor;
                latestDeployments.candidate = governorData.candidate;
            }
        } catch (err) {
            console.warn('Could not read governor deployments:', err.message);
        }

        try {
            // Check world-treasure deployments
            const treasuryDeploymentsPath = path.join(deploymentsPath, 'world-treasure', 'deployments');
            const treasuryFiles = await fs.readdir(treasuryDeploymentsPath);
            const latestTreasuryFile = treasuryFiles
                .filter(f => f.endsWith('.json'))
                .sort()
                .pop();

            if (latestTreasuryFile) {
                const treasuryData = JSON.parse(
                    await fs.readFile(path.join(treasuryDeploymentsPath, latestTreasuryFile), 'utf-8')
                );
                latestDeployments.treasury = treasuryData.treasury;
            }
        } catch (err) {
            console.warn('Could not read treasury deployments:', err.message);
        }

        try {
            // Check auction deployments (foundry broadcast)
            const auctionBroadcastPath = path.join(deploymentsPath, 'Auction', 'broadcast', 'DeployVoting.s.sol', '4801');
            const broadcastFiles = await fs.readdir(auctionBroadcastPath);
            const latestBroadcastFile = broadcastFiles
                .filter(f => f.startsWith('run-') && f.endsWith('.json'))
                .sort()
                .pop();

            if (latestBroadcastFile) {
                const broadcastData = JSON.parse(
                    await fs.readFile(path.join(auctionBroadcastPath, latestBroadcastFile), 'utf-8')
                );

                // Extract contract addresses from transactions
                if (broadcastData.transactions) {
                    for (const tx of broadcastData.transactions) {
                        if (tx.contractName === 'Voting') {
                            latestDeployments.voting = tx.contractAddress;
                        }
                        if (tx.contractName === 'DailyAuction' || tx.contractName === 'Auction') {
                            latestDeployments.auction = tx.contractAddress;
                        }
                        if (tx.contractName === 'NFTMinter') {
                            latestDeployments.worldNft = tx.contractAddress;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Could not read auction deployments:', err.message);
        }

        // Compare current vs latest
        const comparison = {};
        for (const [key, currentAddr] of Object.entries(currentAddresses)) {
            const latestAddr = latestDeployments[key];
            comparison[key] = {
                current: currentAddr || 'Not configured',
                latest: latestAddr || 'Not found in deployments',
                isUpToDate: currentAddr === latestAddr,
                needsUpdate: currentAddr !== latestAddr && latestAddr !== undefined
            };
        }

        return res.status(200).json({
            success: true,
            currentAddresses,
            latestDeployments,
            comparison,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Deployment check failed:', error);
        return res.status(500).json({
            error: 'Failed to check deployments',
            message: error.message
        });
    }
}