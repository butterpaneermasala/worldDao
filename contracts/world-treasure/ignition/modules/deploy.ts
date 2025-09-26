import { ethers } from "hardhat";
import { Treasury__factory } from "../typechain-types";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying Treasury contract with account:", await deployer.getAddress());
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.getAddress())), "ETH");

    // Replace with your actual governor contract address
    // For testing, you can use deployer address or deploy a mock governor
    const governorAddress = process.env.GOVERNOR_ADDRESS || await deployer.getAddress();

    if (!governorAddress || governorAddress === ethers.ZeroAddress) {
        throw new Error("Invalid governor address. Set GOVERNOR_ADDRESS environment variable.");
    }

    console.log("Governor address:", governorAddress);

    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(governorAddress);

    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();

    console.log("Treasury deployed to:", treasuryAddress);

    // Verify deployment
    const deployedGovernor = await treasury.governor();
    console.log("Deployed treasury governor:", deployedGovernor);

    // Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        treasuryAddress: treasuryAddress,
        governorAddress: deployedGovernor,
        deployer: await deployer.getAddress(),
        blockNumber: await ethers.provider.getBlockNumber(),
        timestamp: new Date().toISOString()
    };

    console.log("\nDeployment Summary:");
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