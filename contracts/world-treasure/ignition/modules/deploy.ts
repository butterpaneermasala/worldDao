import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    const networkName = network.name;

    console.log("=".repeat(50));
    console.log("🚀 TREASURY DEPLOYMENT SCRIPT");
    console.log("=".repeat(50));
    console.log(`📡 Network: ${networkName}`);
    console.log(`👤 Deployer: ${await deployer.getAddress()}`);
    console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.getAddress()))} ETH`);

    // Validate governor address
    const governorAddress = process.env.GOVERNOR_ADDRESS;

    if (!governorAddress || governorAddress === ethers.ZeroAddress) {
        console.log("⚠️  No GOVERNOR_ADDRESS provided. Using deployer as temporary governor.");
        console.log("❗ Remember to transfer governance later!");
    }

    const finalGovernorAddress = governorAddress || await deployer.getAddress();
    console.log(`🏛️  Governor: ${finalGovernorAddress}`);

    // Estimate gas
    const Treasury = await ethers.getContractFactory("Treasury");
    const deployTx = await Treasury.getDeployTransaction(finalGovernorAddress);
    const estimatedGas = await ethers.provider.estimateGas(deployTx);
    const gasPrice = await ethers.provider.getFeeData();

    console.log(`⛽ Estimated gas: ${estimatedGas.toString()}`);
    console.log(`💸 Estimated cost: ${ethers.formatEther((estimatedGas * (gasPrice.gasPrice || 0n)).toString())} ETH`);

    // Confirm deployment
    console.log("\n🔄 Deploying Treasury contract...");

    const treasury = await Treasury.deploy(finalGovernorAddress);
    await treasury.waitForDeployment();

    const treasuryAddress = await treasury.getAddress();
    const deploymentTx = treasury.deploymentTransaction();

    console.log("\n✅ DEPLOYMENT SUCCESSFUL!");
    console.log(`📍 Treasury Address: ${treasuryAddress}`);
    console.log(`🔗 Transaction Hash: ${deploymentTx?.hash}`);

    // Verify deployment
    const deployedGovernor = await treasury.governor();
    console.log(`🏛️  Verified Governor: ${deployedGovernor}`);

    // Test basic functionality
    console.log("\n🧪 Testing basic functionality...");
    const ethBalance = await treasury.getETHBalance();
    console.log(`💰 Initial ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

    // Save deployment info
    const deploymentInfo = {
        network: networkName,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        treasuryAddress: treasuryAddress,
        governorAddress: deployedGovernor,
        deployer: await deployer.getAddress(),
        blockNumber: await ethers.provider.getBlockNumber(),
        transactionHash: deploymentTx?.hash,
        timestamp: new Date().toISOString(),
        gasUsed: deploymentTx ? await ethers.provider.getTransactionReceipt(deploymentTx.hash).then(r => r?.gasUsed.toString()) : "unknown"
    };

    // Save to deployments directory
    const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `treasury-${networkName}-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n📋 DEPLOYMENT SUMMARY:");
    console.log(`Network: ${deploymentInfo.network} (${deploymentInfo.chainId})`);
    console.log(`Treasury: ${deploymentInfo.treasuryAddress}`);
    console.log(`Governor: ${deploymentInfo.governorAddress}`);
    console.log(`Block: ${deploymentInfo.blockNumber}`);
    console.log(`Gas Used: ${deploymentInfo.gasUsed}`);
    console.log(`Saved to: ${deploymentFile}`);

    // Contract verification
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("\n🔍 Verifying contract on block explorer...");
        try {
            await run("verify:verify", {
                address: treasuryAddress,
                constructorArguments: [finalGovernorAddress],
            });
            console.log("✅ Contract verified successfully!");
        } catch (error) {
            console.log("❌ Verification failed:", error);
            console.log("💡 You can verify manually later with:");
            console.log(`npx hardhat verify --network ${networkName} ${treasuryAddress} ${finalGovernorAddress}`);
        }
    }

    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(50));
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Optional: Send a small deposit to test receive function
    if (process.env.TEST_DEPOSIT === "true") {
        console.log("\nSending test deposit...");
        const depositTx = await deployer.sendTransaction({
            to: treasuryAddress,
            value: ethers.parseEther("0.001")
        });
        await depositTx.wait();
        console.log("Test deposit sent:", depositTx.hash);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });