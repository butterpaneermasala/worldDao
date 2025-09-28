// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {NFTAuction} from "../src/Auction.sol";

/// @title UpdateAuctionBeneficiary
/// @notice Script to update existing NFTAuction contract to use Treasury as beneficiary
contract UpdateAuctionBeneficiary is Script {
    function run() external {
        // Get addresses from environment
        address auctionAddress = vm.envAddress("AUCTION_ADDRESS");
        address treasuryAddress = vm.envAddress("TREASURY_ADDRESS");
        address votingAddress = vm.envAddress("VOTING_ADDRESS");

        console2.log("=== UPDATING AUCTION BENEFICIARY ===");
        console2.log("Auction Address:", auctionAddress);
        console2.log("Treasury Address:", treasuryAddress);
        console2.log("Voting Address:", votingAddress);

        // Start broadcast
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Get the auction contract
        NFTAuction auction = NFTAuction(auctionAddress);

        // Check current beneficiary
        address currentBeneficiary = auction.beneficiary();
        console2.log("Current beneficiary:", currentBeneficiary);

        if (currentBeneficiary != treasuryAddress) {
            console2.log("Updating beneficiary to Treasury...");

            // Update beneficiary to Treasury
            auction.setBeneficiary(payable(treasuryAddress));

            // Verify the update
            address newBeneficiary = auction.beneficiary();
            console2.log("New beneficiary:", newBeneficiary);

            require(
                newBeneficiary == treasuryAddress,
                "Failed to update beneficiary"
            );
            console2.log(
                "[SUCCESS] Successfully updated auction beneficiary to Treasury"
            );
        } else {
            console2.log(
                "[SUCCESS] Auction beneficiary already set to Treasury"
            );
        }

        // Also verify operator is set correctly to Voting
        address currentOperator = auction.operator();
        console2.log("Current operator:", currentOperator);

        if (currentOperator != votingAddress) {
            console2.log("Updating operator to Voting...");
            auction.setOperator(votingAddress);

            address newOperator = auction.operator();
            console2.log("New operator:", newOperator);
            require(newOperator == votingAddress, "Failed to update operator");
            console2.log(
                "[SUCCESS] Successfully updated auction operator to Voting"
            );
        } else {
            console2.log("[SUCCESS] Auction operator already set to Voting");
        }

        vm.stopBroadcast();

        console2.log("\n=== FINAL CONFIGURATION ===");
        console2.log("Auction beneficiary:", auction.beneficiary());
        console2.log("Auction operator:", auction.operator());
        console2.log("[SUCCESS] Treasury integration complete!");
    }
}
