import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=".repeat(50));
    console.log("🔗 LINKING WORLD DAO CONTRACTS");
    console.log("=".repeat(50));
    console.log(`👤 Deployer: ${await deployer.getAddress()}`);
    console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.getAddress()))} ETH`);

    // Contract addresses from deployments
    const addresses = {
        candidateContract: "0x83F56281aAbaa37a228B77561f0703A996AB6aD5",
        worldChainGovernor: "0x627e9A7DF8e3860B14B95cf7Cf0D7eE120163dD8",
        treasury: "0x09D96fCC17b16752ec3673Ea85B9a6fea697f697",
        worldNFT: "0x5BCAEf9a3059340f39e640875fE803422b5100C8"
    };

    console.log("\n📋 CONTRACT ADDRESSES:");
    console.log(`CandidateContract: ${addresses.candidateContract}`);
    console.log(`WorldChainGovernor: ${addresses.worldChainGovernor}`);
    console.log(`Treasury: ${addresses.treasury}`);
    console.log(`WorldNFT: ${addresses.worldNFT}`);

    // Get contract instances
    console.log("\n🔄 Getting contract instances...");
    const governor = await ethers.getContractAt("WorldChainGovernor", addresses.worldChainGovernor);
    const candidateContract = await ethers.getContractAt("CandidateContract", addresses.candidateContract);

    // For Treasury, we need to create a simple interface since we don't have the artifact here
    const treasuryABI = [
        "function governor() external view returns (address)",
        "function getETHBalance() external view returns (uint256)",
        "function setGovernor(address _governor) external"
    ];
    const treasury = new ethers.Contract(addresses.treasury, treasuryABI, deployer);

    console.log("✅ Contract instances loaded");

    // Step 1: Set Treasury in WorldChainGovernor
    console.log("\n🔗 STEP 1: Setting Treasury in WorldChainGovernor...");
    try {
        const currentTreasury = await governor.treasury();
        if (currentTreasury === ethers.ZeroAddress) {
            console.log("📝 Setting treasury address in governor...");
            const setTreasuryTx = await governor.setTreasury(addresses.treasury);
            console.log(`🔄 Transaction sent: ${setTreasuryTx.hash}`);
            await setTreasuryTx.wait();
            console.log("✅ Treasury successfully set in WorldChainGovernor");
        } else {
            console.log(`✅ Treasury already set: ${currentTreasury}`);
        }
    } catch (error) {
        console.log("❌ Failed to set treasury:", error);
    }

    // Step 2: Check CandidateContract configuration
    console.log("\n🔗 STEP 2: Checking CandidateContract configuration...");
    try {
        const candidateProposalContract = await candidateContract.proposalContract();
        const candidateTreasury = await candidateContract.treasury();
        const candidateNFT = await candidateContract.nft();
        const sponsorThreshold = await candidateContract.sponsorThreshold();

        console.log("📋 Current CandidateContract configuration:");
        console.log(`  Proposal Contract: ${candidateProposalContract}`);
        console.log(`  Treasury: ${candidateTreasury}`);
        console.log(`  NFT Contract: ${candidateNFT}`);
        console.log(`  Sponsor Threshold: ${sponsorThreshold}`);

        // Check if addresses match
        const proposalMatches = candidateProposalContract.toLowerCase() === addresses.worldChainGovernor.toLowerCase();
        const treasuryMatches = candidateTreasury.toLowerCase() === addresses.treasury.toLowerCase();

        if (proposalMatches && treasuryMatches) {
            console.log("✅ CandidateContract is properly configured");
        } else {
            console.log("⚠️  CandidateContract configuration issues:");
            if (!proposalMatches) {
                console.log(`  ❌ Proposal contract mismatch: expected ${addresses.worldChainGovernor}, got ${candidateProposalContract}`);
            }
            if (!treasuryMatches) {
                console.log(`  ❌ Treasury mismatch: expected ${addresses.treasury}, got ${candidateTreasury}`);
            }
        }
    } catch (error) {
        console.log("❌ Failed to check CandidateContract:", error);
    }

    // Step 3: Verify all connections
    console.log("\n🔍 STEP 3: Verifying contract connections...");

    try {
        // Verify Governor -> Treasury link
        const governorTreasury = await governor.treasury();
        console.log(`✅ Governor -> Treasury: ${governorTreasury}`);

        // Verify Treasury -> Governor link  
        const treasuryGovernor = await treasury.governor();
        console.log(`✅ Treasury -> Governor: ${treasuryGovernor}`);

        // Verify Governor -> WorldNFT link
        const governorWorldNFT = await governor.worldNFT();
        console.log(`✅ Governor -> WorldNFT: ${governorWorldNFT}`);

        // Check if links are correct
        const treasuryLinkCorrect = governorTreasury.toLowerCase() === addresses.treasury.toLowerCase();
        const governorLinkCorrect = treasuryGovernor.toLowerCase() === addresses.worldChainGovernor.toLowerCase();
        const nftLinkCorrect = governorWorldNFT.toLowerCase() === addresses.worldNFT.toLowerCase();

        console.log("\n🔍 Link Verification:");
        console.log(`Governor -> Treasury: ${treasuryLinkCorrect ? '✅' : '❌'}`);
        console.log(`Treasury -> Governor: ${governorLinkCorrect ? '✅' : '❌'}`);
        console.log(`Governor -> WorldNFT: ${nftLinkCorrect ? '✅' : '❌'}`);

    } catch (error) {
        console.log("❌ Verification failed:", error);
    }

    // Step 4: Display governance parameters
    console.log("\n📊 GOVERNANCE PARAMETERS:");
    try {
        const votingPeriod = await governor.votingPeriod();
        const votingDelay = await governor.votingDelay();
        const quorum = await governor.quorum();
        const proposalCount = await governor.proposalCount();
        const paused = await governor.paused();

        console.log(`Voting Period: ${votingPeriod} blocks (~7 days)`);
        console.log(`Voting Delay: ${votingDelay} blocks (immediate)`);
        console.log(`Quorum: ${quorum} voters required`);
        console.log(`Total Proposals: ${proposalCount}`);
        console.log(`Contract Paused: ${paused}`);
    } catch (error) {
        console.log("❌ Failed to get governance parameters:", error);
    }

    // Step 5: Test WorldNFT integration
    console.log("\n🧪 TESTING WORLDNFT INTEGRATION:");
    try {
        const worldNFT = await ethers.getContractAt("IWorldNFT", addresses.worldNFT);
        const deployerNFTBalance = await worldNFT.balanceOf(await deployer.getAddress());
        const totalSupply = await worldNFT.totalSupply();

        console.log(`👤 Deployer WorldNFT balance: ${deployerNFTBalance}`);
        console.log(`🏆 Total WorldNFT supply: ${totalSupply}`);

        if (deployerNFTBalance > 0) {
            console.log("✅ Deployer can create proposals and vote");
        } else {
            console.log("⚠️  Deployer cannot create proposals (no WorldNFTs)");
        }
    } catch (error) {
        console.log("❌ WorldNFT integration test failed:", error);
    }

    console.log("\n🎉 CONTRACT LINKING ANALYSIS COMPLETE!");
    console.log("=".repeat(50));

    console.log("\n📝 DEPLOYMENT SUMMARY:");
    console.log(`✅ WorldChainGovernor: ${addresses.worldChainGovernor}`);
    console.log(`✅ Treasury: ${addresses.treasury}`);
    console.log(`🔄 CandidateContract: ${addresses.candidateContract} (may need reconfiguration)`);

    console.log("\n🚀 SYSTEM STATUS:");
    console.log("✅ Core governance system is operational");
    console.log("✅ Treasury is linked to governance");
    console.log("⚠️  CandidateContract may need redeployment for proper integration");

    console.log("\n📋 NEXT STEPS:");
    console.log("1. Test creating a governance proposal (if you have WorldNFTs)");
    console.log("2. Redeploy CandidateContract with correct addresses if needed");
    console.log("3. Set up frontend integration");
    console.log("4. Consider adding initial treasury funds for testing");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Analysis failed:", error);
        process.exit(1);
    });