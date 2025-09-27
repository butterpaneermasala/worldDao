import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    const networkName = network.name;

    console.log("=".repeat(60));
    console.log("🏆 CANDIDATE CONTRACT REDEPLOYMENT");
    console.log("=".repeat(60));
    console.log(`📡 Network: ${networkName}`);
    console.log(`👤 Deployer: ${await deployer.getAddress()}`);
    console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.getAddress()))} ETH`);

    // Contract addresses from previous deployments
    const addresses = {
        worldChainGovernor: "0x627e9A7DF8e3860B14B95cf7Cf0D7eE120163dD8",
        treasury: "0x09D96fCC17b16752ec3673Ea85B9a6fea697f697",
        worldNFT: "0x5BCAEf9a3059340f39e640875fE803422b5100C8",
        oldCandidateContract: "0x83F56281aAbaa37a228B77561f0703A996AB6aD5"
    };

    // Configuration from environment
    const config = {
        sponsorThreshold: process.env.SPONSOR_THRESHOLD || "3"
    };

    console.log("\n📋 DEPLOYMENT CONFIGURATION:");
    console.log(`WorldChainGovernor: ${addresses.worldChainGovernor}`);
    console.log(`Treasury: ${addresses.treasury}`);
    console.log(`WorldNFT: ${addresses.worldNFT}`);
    console.log(`Sponsor Threshold: ${config.sponsorThreshold}`);
    console.log(`Old CandidateContract: ${addresses.oldCandidateContract} (will be replaced)`);

    // Estimate gas costs
    const CandidateContract = await ethers.getContractFactory("CandidateContract");
    const deployTx = await CandidateContract.getDeployTransaction(
        addresses.worldChainGovernor,
        addresses.treasury,
        addresses.worldNFT,
        config.sponsorThreshold
    );
    const estimatedGas = await ethers.provider.estimateGas(deployTx);
    const gasPrice = await ethers.provider.getFeeData();

    console.log(`\n⛽ Estimated gas: ${estimatedGas.toString()}`);
    console.log(`💸 Estimated cost: ${ethers.formatEther((estimatedGas * (gasPrice.gasPrice || 0n)).toString())} ETH`);

    // Deploy new CandidateContract with correct addresses
    console.log("\n🚀 Deploying new CandidateContract with correct addresses...");

    const candidateContract = await CandidateContract.deploy(
        addresses.worldChainGovernor,  // proposal contract
        addresses.treasury,           // treasury
        addresses.worldNFT,          // NFT contract
        config.sponsorThreshold      // sponsor threshold
    );

    await candidateContract.waitForDeployment();
    const candidateAddress = await candidateContract.getAddress();
    const deploymentTx = candidateContract.deploymentTransaction();

    console.log("\n✅ NEW CANDIDATE CONTRACT DEPLOYED!");
    console.log(`📍 New Address: ${candidateAddress}`);
    console.log(`🔗 Transaction Hash: ${deploymentTx?.hash}`);

    // Verify the deployment configuration
    console.log("\n🔍 Verifying deployment configuration...");
    try {
        const deployedProposalContract = await candidateContract.proposalContract();
        const deployedTreasury = await candidateContract.treasury();
        const deployedNFT = await candidateContract.nft();
        const deployedSponsorThreshold = await candidateContract.sponsorThreshold();

        console.log("📋 Deployed CandidateContract configuration:");
        console.log(`  Proposal Contract: ${deployedProposalContract}`);
        console.log(`  Treasury: ${deployedTreasury}`);
        console.log(`  NFT Contract: ${deployedNFT}`);
        console.log(`  Sponsor Threshold: ${deployedSponsorThreshold}`);

        // Verify all addresses match
        const proposalMatches = deployedProposalContract.toLowerCase() === addresses.worldChainGovernor.toLowerCase();
        const treasuryMatches = deployedTreasury.toLowerCase() === addresses.treasury.toLowerCase();
        const nftMatches = deployedNFT.toLowerCase() === addresses.worldNFT.toLowerCase();
        const thresholdMatches = deployedSponsorThreshold.toString() === config.sponsorThreshold;

        console.log("\n✅ Configuration Verification:");
        console.log(`Proposal Contract: ${proposalMatches ? '✅' : '❌'}`);
        console.log(`Treasury: ${treasuryMatches ? '✅' : '❌'}`);
        console.log(`NFT Contract: ${nftMatches ? '✅' : '❌'}`);
        console.log(`Sponsor Threshold: ${thresholdMatches ? '✅' : '❌'}`);

        if (proposalMatches && treasuryMatches && nftMatches && thresholdMatches) {
            console.log("🎉 All configurations are correct!");
        } else {
            console.log("❌ Some configurations don't match expected values!");
        }

    } catch (error) {
        console.log("❌ Configuration verification failed:", error);
    }

    // Test basic functionality
    console.log("\n🧪 Testing basic functionality...");
    try {
        const candidateCount = await candidateContract.candidateCount();
        console.log(`📊 Initial candidate count: ${candidateCount}`);

        // Test WorldNFT integration
        const worldNFT = await ethers.getContractAt("IWorldNFT", addresses.worldNFT);
        const deployerBalance = await worldNFT.balanceOf(await deployer.getAddress());
        console.log(`👤 Deployer WorldNFT balance: ${deployerBalance}`);

        if (deployerBalance > 0) {
            console.log("✅ Deployer can create and sponsor candidates");
        } else {
            console.log("⚠️  Deployer cannot interact (no WorldNFTs)");
        }

    } catch (error) {
        console.log("❌ Functionality test failed:", error);
    }

    // Save deployment information
    const deploymentInfo = {
        network: networkName,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: await deployer.getAddress(),
        timestamp: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber(),
        contracts: {
            newCandidateContract: candidateAddress,
            oldCandidateContract: addresses.oldCandidateContract,
            worldChainGovernor: addresses.worldChainGovernor,
            treasury: addresses.treasury,
            worldNFT: addresses.worldNFT
        },
        configuration: {
            sponsorThreshold: config.sponsorThreshold
        },
        transactionHash: deploymentTx?.hash,
        gasUsed: deploymentTx ? await ethers.provider.getTransactionReceipt(deploymentTx.hash).then(r => r?.gasUsed.toString()) : "unknown"
    };

    // Create deployments directory
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `candidate-redeployment-${networkName}-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n📋 DEPLOYMENT SUMMARY:");
    console.log(`Network: ${deploymentInfo.network} (${deploymentInfo.chainId})`);
    console.log(`New CandidateContract: ${candidateAddress}`);
    console.log(`Old CandidateContract: ${addresses.oldCandidateContract} (deprecated)`);
    console.log(`Block: ${deploymentInfo.blockNumber}`);
    console.log(`Gas Used: ${deploymentInfo.gasUsed}`);
    console.log(`Saved to: ${deploymentFile}`);

    // Contract verification
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("\n🔍 Verifying contract on block explorer...");
        try {
            await run("verify:verify", {
                address: candidateAddress,
                constructorArguments: [
                    addresses.worldChainGovernor,
                    addresses.treasury,
                    addresses.worldNFT,
                    config.sponsorThreshold
                ],
            });
            console.log("✅ Contract verified successfully!");
        } catch (error) {
            console.log("❌ Verification failed:", error);
            console.log("💡 You can verify manually later with:");
            console.log(`npx hardhat verify --network ${networkName} ${candidateAddress} ${addresses.worldChainGovernor} ${addresses.treasury} ${addresses.worldNFT} ${config.sponsorThreshold}`);
        }
    }

    console.log("\n🎉 CANDIDATE CONTRACT REDEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));

    console.log("\n📝 UPDATED SYSTEM ADDRESSES:");
    console.log(`WorldChainGovernor: ${addresses.worldChainGovernor}`);
    console.log(`Treasury: ${addresses.treasury}`);
    console.log(`CandidateContract: ${candidateAddress} (NEW)`);
    console.log(`WorldNFT: ${addresses.worldNFT}`);

    console.log("\n🚀 NEXT STEPS:");
    console.log("1. Update your .env files with the new CandidateContract address");
    console.log("2. Test the complete workflow:");
    console.log("   - Create a candidate (0.01 ETH fee)");
    console.log("   - Get 3 sponsors");
    console.log("   - Create governance proposal from promoted candidate");
    console.log("3. Update frontend integration with new address");
    console.log("4. The old CandidateContract can be ignored");

    return deploymentInfo;
}

main()
    .then((deploymentInfo) => {
        console.log("\n✨ CandidateContract redeployment successful!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("💥 Redeployment failed:", error);
        process.exit(1);
    });