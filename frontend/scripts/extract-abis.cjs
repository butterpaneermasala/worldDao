#!/usr/bin/env node

/**
 * Script to extract ABIs from compiled contract artifacts
 * and place them in the frontend/abis directory
 */

const fs = require('fs');
const path = require('path');

const CONTRACT_DIRS = {
  'Auction': '../contracts/Auction/out',
  'Governor': '../contracts/world-governor/artifacts/contracts',
  'Treasury': '../contracts/world-treasure/artifacts/contracts'
};

const ABI_OUTPUT_DIR = './abis';

// Ensure ABI output directory exists
if (!fs.existsSync(ABI_OUTPUT_DIR)) {
  fs.mkdirSync(ABI_OUTPUT_DIR, { recursive: true });
}

function extractABI(contractPath, contractName, outputName = null) {
  try {
    const artifact = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const outputFileName = outputName || contractName;
    const outputPath = path.join(ABI_OUTPUT_DIR, `${outputFileName}.json`);
    
    fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`✓ Extracted ${contractName} ABI to ${outputFileName}.json`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to extract ${contractName}: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('Extracting ABIs from compiled contracts...\n');
  
  let successCount = 0;
  let totalCount = 0;

  // Extract Foundry contracts (Auction directory)
  const auctionContracts = [
    ['Voting.sol/Voting.json', 'Voting'],
    ['Auction.sol/NFTAuction.json', 'NFTAuction'],
    ['NFTMinter.sol/NFTMinter.json', 'NFTMinter'],
    ['Auction.sol/DailyAuction.json', 'DailyAuction']
  ];

  auctionContracts.forEach(([filePath, contractName]) => {
    const fullPath = path.join(CONTRACT_DIRS.Auction, filePath);
    totalCount++;
    if (extractABI(fullPath, contractName)) {
      successCount++;
    }
  });

  // Extract Hardhat contracts (Governor directory)
  const governorContracts = [
    ['CandidateContract.sol/CandidateContract.json', 'CandidateContract'],
    ['WorldChainGovernor.sol/WorldChainGovernor.json', 'WorldChainGovernor']
  ];

  governorContracts.forEach(([filePath, contractName]) => {
    const fullPath = path.join(CONTRACT_DIRS.Governor, filePath);
    totalCount++;
    if (extractABI(fullPath, contractName)) {
      successCount++;
    }
  });

  // Extract Treasury contracts
  const treasuryContracts = [
    ['Treasury.sol/Treasury.json', 'Treasury']
  ];

  treasuryContracts.forEach(([filePath, contractName]) => {
    const fullPath = path.join(CONTRACT_DIRS.Treasury, filePath);
    totalCount++;
    if (extractABI(fullPath, contractName)) {
      successCount++;
    }
  });

  console.log(`\nCompleted: ${successCount}/${totalCount} ABIs extracted successfully`);
  
  if (successCount === totalCount) {
    console.log('🎉 All ABIs extracted successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Some ABIs failed to extract. Please check contract compilation.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractABI, main };