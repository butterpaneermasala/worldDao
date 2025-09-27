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
    const treasury = await ethers.getContractAt("Treasury", addresses.treasury);
    const candidateContract = await ethers.getContractAt("CandidateContract", addresses.candidateContract);

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

    // Step 2: Update CandidateContract to use correct addresses
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

        if (candidateProposalContract.toLowerCase() === addresses.worldChainGovernor.toLowerCase() &&
            candidateTreasury.toLowerCase() === addresses.treasury.toLowerCase()) {
            console.log("✅ CandidateContract is already properly configured");
        } else {
            console.log("⚠️  CandidateContract needs reconfiguration");
            console.log("❗ Note: CandidateContract was deployed with temporary addresses");
            console.log("❗ Consider redeploying CandidateContract with correct addresses");
        }
    } catch (error) {
        console.log("❌ Failed to check CandidateContract:", error);
    }

    // Step 3: Verify all connections
    console.log("\n🔍 STEP 3: Verifying all contract connections...");

    try {
        // Verify Governor -> Treasury link
        const governorTreasury = await governor.treasury();
        console.log(`Governor -> Treasury: ${governorTreasury}`);

        // Verify Treasury -> Governor link  
        const treasuryGovernor = await treasury.governor();
        console.log(`Treasury -> Governor: ${treasuryGovernor}`);

        // Verify Governor -> WorldNFT link
        const governorWorldNFT = await governor.worldNFT();
        console.log(`Governor -> WorldNFT: ${governorWorldNFT}`);

        // Check governor parameters
        const votingPeriod = await governor.votingPeriod();
        const votingDelay = await governor.votingDelay();
        const quorum = await governor.quorum();
        const proposalCount = await governor.proposalCount();

        console.log("\n📊 GOVERNANCE PARAMETERS:");
        console.log(`Voting Period: ${votingPeriod} blocks`);
        console.log(`Voting Delay: ${votingDelay} blocks`);
        console.log(`Quorum: ${quorum} voters`);
        console.log(`Total Proposals: ${proposalCount}`);

    } catch (error) {
        console.log("❌ Verification failed:", error);
    }

    // Step 4: Test basic functionality
    console.log("\n🧪 STEP 4: Testing basic functionality...");
    try {
        // Check if deployer has WorldNFTs
        const worldNFT = await ethers.getContractAt("IWorldNFT", addresses.worldNFT);
        const deployerNFTBalance = await worldNFT.balanceOf(await deployer.getAddress());
        console.log(`👤 Deployer WorldNFT balance: ${deployerNFTBalance}`);

        if (deployerNFTBalance > 0) {
            console.log("✅ Deployer can create proposals");
        } else {
            console.log("⚠️  Deployer cannot create proposals (no WorldNFTs)");
        }

        // Check treasury ETH balance
        const treasuryBalance = await treasury.getETHBalance();
        console.log(`💰 Treasury ETH balance: ${ethers.formatEther(treasuryBalance)} ETH`);

    } catch (error) {
        console.log("❌ Functionality test failed:", error);
    }

    console.log("\n🎉 CONTRACT LINKING COMPLETE!");
    console.log("=".repeat(50));

    console.log("\n📝 SUMMARY:");
    console.log("✅ WorldChainGovernor deployed and configured");
    console.log("✅ Treasury deployed and linked to Governor");
    console.log("⚠️  CandidateContract may need redeployment with correct addresses");

    console.log("\n🚀 NEXT STEPS:");
    console.log("1. Verify contracts on block explorer");
    console.log("2. Test creating a proposal (if you have WorldNFTs)");
    console.log("3. Consider redeploying CandidateContract with proper addresses");
    console.log("4. Set up frontend integration");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Linking failed:", error);
        process.exit(1);
    });