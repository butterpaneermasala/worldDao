import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { Treasury, Treasury__factory } from "../typechain-types";

describe("Treasury", function () {
    let treasury: Treasury;
    let owner: Signer;
    let governor: Signer;
    let newGovernor: Signer;
    let user: Signer;
    let mockTarget: Contract;

    beforeEach(async function () {
        [owner, governor, newGovernor, user] = await ethers.getSigners();

        // Deploy Treasury contract
        const Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.deploy(await governor.getAddress());
        await treasury.waitForDeployment();

        // Deploy a mock contract for testing executeTransaction
        const MockTarget = await ethers.getContractFactory("MockTarget");
        mockTarget = await MockTarget.deploy();
        await mockTarget.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct governor", async function () {
            expect(await treasury.governor()).to.equal(await governor.getAddress());
        });

        it("Should revert if governor is zero address", async function () {
            const Treasury = await ethers.getContractFactory("Treasury");
            await expect(
                Treasury.deploy(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid governor address");
        });
    });

    describe("Receive ETH", function () {
        it("Should accept ETH deposits and emit FundsReceived event", async function () {
            const depositAmount = ethers.parseEther("1.0");

            await expect(
                user.sendTransaction({
                    to: await treasury.getAddress(),
                    value: depositAmount,
                })
            )
                .to.emit(treasury, "FundsReceived")
                .withArgs(await user.getAddress(), depositAmount);

            expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(
                depositAmount
            );
        });

        it("Should accept multiple deposits", async function () {
            const deposit1 = ethers.parseEther("0.5");
            const deposit2 = ethers.parseEther("1.5");

            await user.sendTransaction({
                to: await treasury.getAddress(),
                value: deposit1,
            });

            await owner.sendTransaction({
                to: await treasury.getAddress(),
                value: deposit2,
            });

            expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(
                deposit1 + deposit2
            );
        });
    });

    describe("Execute Transaction", function () {
        beforeEach(async function () {
            // Fund the treasury
            await user.sendTransaction({
                to: await treasury.getAddress(),
                value: ethers.parseEther("2.0"),
            });
        });

        it("Should execute transaction when called by governor", async function () {
            const transferAmount = ethers.parseEther("0.5");
            const targetAddress = await user.getAddress();

            const initialBalance = await ethers.provider.getBalance(targetAddress);

            await expect(
                treasury.connect(governor).executeTransaction(
                    targetAddress,
                    transferAmount,
                    "0x"
                )
            )
                .to.emit(treasury, "TransactionExecuted")
                .withArgs(targetAddress, transferAmount, "0x");

            const finalBalance = await ethers.provider.getBalance(targetAddress);
            expect(finalBalance - initialBalance).to.equal(transferAmount);
        });

        it("Should execute contract call with data", async function () {
            const callData = mockTarget.interface.encodeFunctionData("setValue", [42]);

            await expect(
                treasury.connect(governor).executeTransaction(
                    await mockTarget.getAddress(),
                    0,
                    callData
                )
            )
                .to.emit(treasury, "TransactionExecuted")
                .withArgs(await mockTarget.getAddress(), 0, callData);

            expect(await mockTarget.value()).to.equal(42);
        });

        it("Should revert when not called by governor", async function () {
            await expect(
                treasury.connect(user).executeTransaction(
                    await user.getAddress(),
                    ethers.parseEther("0.1"),
                    "0x"
                )
            ).to.be.revertedWith("Not authorized");
        });

        it("Should revert when transaction fails", async function () {
            // Try to send more ETH than treasury has
            const excessiveAmount = ethers.parseEther("10.0");

            await expect(
                treasury.connect(governor).executeTransaction(
                    await user.getAddress(),
                    excessiveAmount,
                    "0x"
                )
            ).to.be.revertedWith("Treasury: tx failed");
        });

        it("Should revert when contract call fails", async function () {
            // Call a non-existent function
            const invalidCallData = "0x12345678";

            await expect(
                treasury.connect(governor).executeTransaction(
                    await mockTarget.getAddress(),
                    0,
                    invalidCallData
                )
            ).to.be.revertedWith("Treasury: tx failed");
        });
    });

    describe("Set Governor", function () {
        it("Should change governor when called by current governor", async function () {
            const newGovernorAddress = await newGovernor.getAddress();

            await treasury.connect(governor).setGovernor(newGovernorAddress);

            expect(await treasury.governor()).to.equal(newGovernorAddress);
        });

        it("Should revert when not called by governor", async function () {
            await expect(
                treasury.connect(user).setGovernor(await newGovernor.getAddress())
            ).to.be.revertedWith("Not authorized");
        });

        it("Should revert when setting zero address as governor", async function () {
            await expect(
                treasury.connect(governor).setGovernor(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid governor");
        });

        it("Should allow new governor to execute transactions after migration", async function () {
            // Fund treasury
            await user.sendTransaction({
                to: await treasury.getAddress(),
                value: ethers.parseEther("1.0"),
            });

            // Change governor
            await treasury.connect(governor).setGovernor(await newGovernor.getAddress());

            // Old governor should not be able to execute
            await expect(
                treasury.connect(governor).executeTransaction(
                    await user.getAddress(),
                    ethers.parseEther("0.1"),
                    "0x"
                )
            ).to.be.revertedWith("Not authorized");

            // New governor should be able to execute
            await expect(
                treasury.connect(newGovernor).executeTransaction(
                    await user.getAddress(),
                    ethers.parseEther("0.1"),
                    "0x"
                )
            ).to.not.be.reverted;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero value transactions", async function () {
            await expect(
                treasury.connect(governor).executeTransaction(
                    await user.getAddress(),
                    0,
                    "0x"
                )
            ).to.not.be.reverted;
        });

        it("Should handle empty call data", async function () {
            await expect(
                treasury.connect(governor).executeTransaction(
                    await user.getAddress(),
                    0,
                    "0x"
                )
            ).to.not.be.reverted;
        });
    });
});