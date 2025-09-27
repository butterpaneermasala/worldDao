# Contract Deployment Verification Guide

## 🔍 How to Check if Contracts are Deployed Correctly

I've created several tools to help you verify your contract deployments:

### Method 1: Using the Visual Contract Checker

1. **Navigate to the contracts page:**
   ```
   http://localhost:3000/contracts
   ```

2. **Use the interface:**
   - Click "Validate Addresses" to check if all addresses are properly configured
   - Click "Check All Contracts" to verify deployment and functionality
   - View detailed results including contract status, functionality, and errors

### Method 2: Using Browser Console

Open your browser console (F12) and run:

```javascript
// Quick address validation
import { validateContractAddresses } from './lib/contractChecker';
validateContractAddresses();

// Full contract check
import { checkAllContracts } from './lib/contractChecker';
checkAllContracts().then(results => console.log('Results:', results));
```

### Method 3: Manual Verification

You can also check contracts manually using these steps:

#### Step 1: Verify Environment Variables
Check your `.env` file contains:
```env
NEXT_PUBLIC_VOTING_ADDRESS=0x108bf94e34afa22f9b9ac3b1cb9fea618c3efa48
NEXT_PUBLIC_WORLD_NFT_ADDRESS=0x65dc5d303ba3c97466ba1822cea33f815179d3df  
NEXT_PUBLIC_GOVERNOR_ADDRESS=0x627e9A7DF8e3860B14B95cf7Cf0D7eE120163dD8
NEXT_PUBLIC_CANDIDATE_ADDRESS=0x585d606c3F881eC66e0eD999930530EF454d08b9
NEXT_PUBLIC_AUCTION_ADDRESS=0x5BCAEf9a3059340f39e640875fE803422b5100C8
```

#### Step 2: Check on Block Explorer
Visit World Chain Sepolia explorer and search for each contract address:
- https://worldchain-sepolia.explorer.alchemy.com/

Look for:
- ✅ Contract verified
- ✅ Contract has bytecode (not empty)
- ✅ Recent transactions (if applicable)

#### Step 3: Test Contract Functions
In browser console:

```javascript
// Test voting contract
const provider = new ethers.BrowserProvider(window.ethereum);
const votingContract = new ethers.Contract(
  '0x108bf94e34afa22f9b9ac3b1cb9fea618c3efa48',
  VotingABI,
  provider
);

// Check if voting is open
votingContract.isVotingOpen().then(result => console.log('Voting open:', result));

// Check proposal count  
votingContract.proposalCount().then(count => console.log('Proposals:', count.toString()));
```

## 🔧 What Each Contract Should Do:

### Voting Contract (`0x108bf94e34afa22f9b9ac3b1cb9fea618c3efa48`)
- **Functions to test:**
  - `isVotingOpen()` - Returns boolean
  - `currentPhase()` - Returns phase number (0=upload, 1=voting, 2=ended)
  - `proposalCount()` - Returns number of proposals

### NFT Contract (`0x65dc5d303ba3c97466ba1822cea33f815179d3df`)
- **Functions to test:**
  - `name()` - Returns NFT name
  - `symbol()` - Returns NFT symbol
  - `balanceOf(address)` - Returns NFT count for address

### Governor Contract (`0x627e9A7DF8e3860B14B95cf7Cf0D7eE120163dD8`)
- **Functions to test:**
  - `name()` - Returns governor name
  - Should be a standard OpenZeppelin Governor

### Candidate Contract (`0x585d606c3F881eC66e0eD999930530EF454d08b9`)
- **Functions to test:**
  - `candidateCount()` - Returns number of candidates

## 🚨 Common Issues and Solutions:

### Issue: "Contract not deployed"
- **Cause:** Contract address is wrong or contract not deployed
- **Solution:** Check deployment logs, verify address in explorer

### Issue: "Missing revert data" / "BAD_DATA"
- **Cause:** Calling function that doesn't exist or with wrong parameters
- **Solution:** Check ABI matches deployed contract

### Issue: "Network mismatch"
- **Cause:** Connected to wrong network
- **Solution:** Switch to World Chain Sepolia (Chain ID: 4801)

### Issue: "Function not found"
- **Cause:** ABI doesn't match deployed contract
- **Solution:** Update ABI files, check contract verification

## 📊 Expected Results:

When contracts are properly deployed, you should see:

```
✅ Network: World Chain Sepolia (4801)
✅ Voting Contract: Deployed & Working
✅ NFT Contract: Deployed & Working  
✅ Governor Contract: Deployed & Working
✅ Candidate Contract: Deployed & Working
✅ Treasury Contract: Deployed & Working
✅ Auction Contract: Deployed & Working

Summary: 6/6 contracts deployed, 6/6 working
```

## 🛠️ Debugging Steps:

1. **Check network connection:** Ensure you're on World Chain Sepolia
2. **Validate addresses:** Run address validation first
3. **Check deployment:** Verify contracts on block explorer
4. **Test functions:** Use contract checker to test basic functions
5. **Check ABIs:** Ensure ABI files match deployed contracts
6. **Review logs:** Check browser console for detailed error messages

The contract checker will provide detailed information about each contract's status and help identify specific issues!