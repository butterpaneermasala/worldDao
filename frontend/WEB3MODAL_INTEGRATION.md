# Web3Modal Integration Guide

## Overview

The WorldDAO frontend now uses Web3Modal v5 with wagmi for wallet connections, providing a better user experience and support for multiple wallets.

## Setup Instructions

1. **Get a WalletConnect Project ID**
   - Go to https://cloud.walletconnect.com/
   - Sign up/login and create a new project
   - Copy your Project ID
   - Add it to your `.env` file as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

2. **Environment Variables**
   ```env
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id-here
   ```

## Features

### Dashboard Integration
- Web3Modal button in the top-right corner
- Connection status indicator
- Supports multiple wallet providers
- Automatic network switching to World Chain

### Sections Include:
1. **Auction Section** - Placeholder for future NFT auctions
2. **NFT Gallery** - View and vote on proposed NFTs
3. **Propose NFT** - Upload your own NFT proposals
4. **Governance Hub** - Access governance features

### Wallet Integration
- Uses wagmi hooks (`useAccount`, `useConnect`, etc.)
- Fallback to legacy MetaMask integration
- World App (MiniKit) support maintained
- Automatic World Chain network detection

### Pages Updated:
- **Dashboard** (`/dashboard`) - Main hub with all sections
- **Voting** (`/voting`) - Full-screen voting interface
- **Governance** (`/governance`) - DAO governance interface  
- **Bidding** (`/bidding`) - Auction house (coming soon)

## Component Structure

```
components/
├── Dashboard.js          # Main dashboard with all sections
├── Voting.js            # Voting page with Web3Modal
├── Bidding.js           # Auction page with Web3Modal
└── governance/
    ├── GovernanceSections.js  # Updated for wagmi
    └── ...

lib/
├── web3modal.js         # Web3Modal configuration
└── web3.js             # Updated web3 utilities

pages/
├── dashboard.js         # Dashboard page
├── voting.js           # Voting page
├── governance.js       # Governance page with Web3Modal
└── bidding.js          # Auction page
```

## Usage

### For Users:
1. Visit the dashboard
2. Click the Web3Modal button to connect wallet
3. Choose from supported wallets (MetaMask, WalletConnect, Coinbase, etc.)
4. Automatically switches to World Chain network
5. Interact with features based on connection status

### For Developers:
```javascript
import { useAccount } from 'wagmi';

function Component() {
  const { address, isConnected } = useAccount();
  
  return (
    <div>
      <w3m-button />
      {isConnected && <p>Connected: {address}</p>}
    </div>
  );
}
```

## Network Configuration

Supports both World Chain networks:
- **World Chain Sepolia (4801)** - Testnet
- **World Chain Mainnet (480)** - Production

## Troubleshooting

1. **Web3Modal not appearing**: Check that `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
2. **Connection issues**: Ensure wallet is on World Chain network
3. **Voting fails**: Verify wallet is connected and has sufficient funds for gas
4. **NFT ownership not detected**: Check that NFT contract address is correct in environment

## Migration from MetaMask

The integration maintains backward compatibility:
- Existing MetaMask detection still works
- Web3Modal enhances the experience
- No breaking changes to existing functionality
- Users can choose their preferred connection method