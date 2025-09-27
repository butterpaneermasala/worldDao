import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    const networkName = network.name;

    console.log("=".repeat(60));
    console.log("🏛️  WORLD DAO GOVERNANCE DEPLOYMENT");
    console.log("=".repeat(60));
    console.log(`📡 Network: ${networkName}`);
    console.log(`👤 Deployer: ${await deployer.getAddress()}`);
    console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.getAddress()))} ETH`);

    // Load configuration
    const config = {
        worldNFT: process.env.WORLD_NFT_ADDRESS || "0x5BCAEf9a3059340f39e640875fE803422b5100C8",
        votingPeriod: process.env.VOTING_PERIOD_BLOCKS || "100800", // 7 days
        votingDelay: process.env.VOTING_DELAY_BLOCKS || "1",      // Immediate
        quorum: process.env.QUORUM || "10",
        sponsorThreshold: process.env.SPONSOR_THRESHOLD || "3",
        treasuryAddress: process.env.TREASURY_ADDRESS || ethers.ZeroAddress
    };

    console.log("\n📋 DEPLOYMENT CONFIGURATION:");
    console.log(`WorldNFT: ${config.worldNFT}`);
    console.log(`Voting Period: ${config.votingPeriod} blocks (~7 days)`);
    console.log(`Voting Delay: ${config.votingDelay} blocks (immediate)`);
    console.log(`Quorum: ${config.quorum} voters minimum`);
    console.log(`Sponsor Threshold: ${config.sponsorThreshold} NFT holders`);

    // Validate WorldNFT address
    if (config.worldNFT === ethers.ZeroAddress) {
        throw new Error("❌ WORLD_NFT_ADDRESS not set in environment variables");
    }

    // Create deployments directory
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentResults: any = {};

    console.log("\n🚀 STEP 1: Deploying CandidateContract...");

    // Deploy CandidateContract first (it doesn't need governor address)
    const CandidateContract = await ethers.getContractFactory("CandidateContract");

    // For now, use deployer as temporary proposal contract, will be updated later
    const candidateContract = await CandidateContract.deploy(
        await deployer.getAddress(), // temporary proposal contract
        await deployer.getAddress(), // temporary treasury
        config.worldNFT,
        config.sponsorThreshold
    );

    await candidateContract.waitForDeployment();
    const candidateAddress = await candidateContract.getAddress();

    console.log(`✅ CandidateContract: ${candidateAddress}`);
    deploymentResults.candidateContract = candidateAddress;

    console.log("\n🚀 STEP 2: Deploying WorldChainGovernor...");

    // Deploy WorldChainGovernor
    const WorldChainGovernor = await ethers.getContractFactory("WorldChainGovernor");
    const governor = await WorldChainGovernor.deploy(
        config.worldNFT,
        config.votingPeriod,
        config.votingDelay,
        config.quorum
    );

    await governor.waitForDeployment();
    const governorAddress = await governor.getAddress();

    console.log(`✅ WorldChainGovernor: ${governorAddress}`);
    deploymentResults.governor = governorAddress;

    console.log("\n🔗 STEP 3: Linking contracts...");

    // Update CandidateContract to use the real governor
    if (config.treasuryAddress !== ethers.ZeroAddress) {
        console.log("Setting treasury in governor...");
        const setTreasuryTx = await governor.setTreasury(config.treasuryAddress);
        await setTreasuryTx.wait();
        console.log(`✅ Treasury set: ${config.treasuryAddress}`);
    } else {
        console.log("⚠️  Treasury address not provided. Set it later with:");
        console.log(`governor.setTreasury(TREASURY_ADDRESS)`);
    }

    console.log("\n🧪 STEP 4: Testing basic functionality...");

    // Test WorldNFT integration
    try {
        const worldNFTContract = await ethers.getContractAt("IWorldNFT", config.worldNFT);
        const deployerBalance = await worldNFTContract.balanceOf(await deployer.getAddress());
        console.log(`👤 Deployer WorldNFT balance: ${deployerBalance.toString()}`);

        const totalSupply = await worldNFTContract.totalSupply();
        console.log(`🏆 Total WorldNFT supply: ${totalSupply.toString()}`);

        if (deployerBalance > 0) {
            console.log("✅ Deployer can create proposals");
        } else {
            console.log("⚠️  Deployer has no WorldNFTs - cannot create proposals");
        }
    } catch (error) {
        console.log("⚠️  Could not verify WorldNFT integration:", error);
    }

    // Save deployment information
    const deploymentInfo = {
        network: networkName,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: await deployer.getAddress(),
        timestamp: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber(),
        contracts: {
            candidateContract: candidateAddress,
            worldChainGovernor: governorAddress,
            worldNFT: config.worldNFT,
            treasury: config.treasuryAddress
        },
        configuration: {
            votingPeriod: config.votingPeriod,
            votingDelay: config.votingDelay,
            quorum: config.quorum,
            sponsorThreshold: config.sponsorThreshold
        },
        transactionHashes: {
            candidateContract: candidateContract.deploymentTransaction()?.hash,
            governor: governor.deploymentTransaction()?.hash
        }
    };

    const deploymentFile = path.join(deploymentsDir, `governance-${networkName}-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n📋 DEPLOYMENT SUMMARY:");
    console.log(`Network: ${deploymentInfo.network} (${deploymentInfo.chainId})`);
    console.log(`CandidateContract: ${candidateAddress}`);
    console.log(`WorldChainGovernor: ${governorAddress}`);
    console.log(`WorldNFT: ${config.worldNFT}`);
    console.log(`Block: ${deploymentInfo.blockNumber}`);
    console.log(`Saved to: ${deploymentFile}`);

    // Contract verification
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("\n🔍 Verifying contracts...");

        try {
            console.log("Verifying CandidateContract...");
            await run("verify:verify", {
                address: candidateAddress,
                constructorArguments: [
                    await deployer.getAddress(),
                    await deployer.getAddress(),
                    config.worldNFT,
                    config.sponsorThreshold
                ],
            });
            console.log("✅ CandidateContract verified!");
        } catch (error) {
            console.log("❌ CandidateContract verification failed:", error);
        }

        try {
            console.log("Verifying WorldChainGovernor...");
            await run("verify:verify", {
                address: governorAddress,
                constructorArguments: [
                    config.worldNFT,
                    config.votingPeriod,
                    config.votingDelay,
                    config.quorum
                ],
            });
            console.log("✅ WorldChainGovernor verified!");
        } catch (error) {
            console.log("❌ WorldChainGovernor verification failed:", error);
        }
    }

    console.log("\n🎉 GOVERNANCE DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));

    console.log("\n📝 NEXT STEPS:");
    console.log("1. Deploy Treasury contract with governor address:");
    console.log(`   GOVERNOR_ADDRESS=${governorAddress}`);
    console.log("2. Set treasury in governor:");
    console.log(`   governor.setTreasury(TREASURY_ADDRESS)`);
    console.log("3. Update CandidateContract proposal contract:");
    console.log(`   candidateContract.setProposalContract(${governorAddress})`);
    console.log("4. Test the complete workflow!");

    return deploymentInfo;
}

main()
    .then((deploymentInfo) => {
        console.log("\n✨ Deployment successful!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("💥 Deployment failed:", error);
        process.exit(1);
    });