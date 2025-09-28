# Treasury Integration Deployment Guide

## Overview
This guide will help you deploy the updated contracts with proper Treasury integration.

## Prerequisites
- Treasury contract already deployed: `0x09D96fCC17b16752ec3673Ea85B9a6fea697f697`
- Environment variables configured

## Environment Variables Required

Create a `.env` file in the `contracts/Auction` directory:

```bash
# Network Configuration
RPC_URL=https://worldchain-sepolia.g.alchemy.com/public
CHAIN_ID=4801

# Deployment Keys
PRIVATE_KEY=your_private_key_here
RELAYER_PRIVATE_KEY=your_relayer_key_here

# Treasury Integration (REQUIRED)
TREASURY_ADDRESS=0x09D96fCC17b16752ec3673Ea85B9a6fea697f697

# Existing Contracts (for updates)
AUCTION_ADDRESS=0x30B0ebC3D5415D1075582cb006B5d60E7B718DDD
VOTING_ADDRESS=0xe4BF521D4fb3cc77B75c90f05414ea076ca71FbA

# Phase Durations
UPLOAD_DURATION=600    # 10 minutes
VOTING_DURATION=900    # 15 minutes  
BIDDING_DURATION=600   # 10 minutes
```

## Deployment Options

### Option 1: Deploy New Contracts (Recommended)
Deploy completely new contracts with Treasury integration:

```bash
cd contracts/Auction
forge script script/DeployVoting.s.sol --rpc-url $RPC_URL --broadcast --verify
```

### Option 2: Update Existing Contracts
Update your existing NFTAuction to use Treasury as beneficiary:

```bash
cd contracts/Auction
forge script script/UpdateAuctionBeneficiary.s.sol --rpc-url $RPC_URL --broadcast
```

## Verification

Run the integration test to verify everything works:

```bash
cd contracts/Auction
forge test --match-test testTreasuryIntegration -vv
```

## Updated Flow

After deployment, the flow will be:

1. **Voting Phase**: Users vote on proposals
2. **Finalization**: Operator finalizes with winning proposal
3. **NFT Minting**: NFT is minted with winning design
4. **Auction Start**: NFT is transferred to auction contract
5. **Bidding**: Users bid on the NFT
6. **Auction End**: Winner gets NFT, **proceeds go to Treasury**
7. **DAO Control**: Treasury funds are controlled by Governor contract

## Key Changes Made

### Voting Contract Updates:
- ✅ Added Treasury interface and validation
- ✅ Constructor now requires Treasury address
- ✅ Added `configureTreasuryBeneficiary()` function
- ✅ Added Treasury configuration validation in finalization

### NFTAuction Updates:
- ✅ Added `setBeneficiary()` function for updating beneficiary
- ✅ Added `BeneficiaryUpdated` event

### Deployment Script Updates:
- ✅ Treasury address validation
- ✅ Automatic beneficiary configuration
- ✅ Comprehensive verification checks

## Treasury Integration Benefits

1. **DAO Control**: All auction proceeds go to Treasury controlled by governance
2. **Transparency**: All funds flow through auditable Treasury contract
3. **Flexibility**: Governor can decide how to use accumulated funds
4. **Security**: Treasury uses OpenZeppelin's battle-tested patterns

## Next Steps

1. Run deployment with new contracts
2. Update frontend `.env` with new contract addresses
3. Test the complete flow end-to-end
4. Monitor Treasury balance accumulation

## Troubleshooting

### Common Issues:

**"Treasury not configured as beneficiary"**
- Run the `UpdateAuctionBeneficiary` script
- Verify `TREASURY_ADDRESS` environment variable is set

**"Invalid treasury"** 
- Ensure Treasury contract is deployed and responding
- Check Treasury has a valid governor address

**"Not operator"**
- Ensure Voting contract is set as auction operator
- Verify relayer address is set as Voting operator