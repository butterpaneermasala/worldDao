// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {NFTMinter} from "../src/NFTMinter.sol";
import {Voting, ITreasury} from "../src/Voting.sol";
import {NFTAuction} from "../src/Auction.sol";

contract DeployVoting is Script {
    // Configure your collection name/symbol here
    string constant NAME = "DailyNFT";
    string constant SYMBOL = "DNFT";

    function run() external {
        // Use PRIVATE_KEY if provided; otherwise rely on --sender/--unlocked and startBroadcast() without args
        address deployer;
        try vm.envUint("PRIVATE_KEY") returns (uint256 deployerPk) {
            deployer = vm.addr(deployerPk);
            vm.startBroadcast(deployerPk);
        } catch {
            // No PRIVATE_KEY in env; use CLI --sender with unlocked account
            // Note: vm.startBroadcast() without args picks up broadcaster from the CLI context
            vm.startBroadcast();
            deployer = tx.origin;
        }

        NFTMinter minter = new NFTMinter(NAME, SYMBOL, deployer);

        // 2) Get Treasury address and validate it
        address treasuryAddress;
        try vm.envAddress("TREASURY_ADDRESS") returns (address treasury) {
            treasuryAddress = treasury;
            console2.log("Using Treasury address:", treasury);

            // Validate Treasury contract
            ITreasury treasuryContract = ITreasury(treasury);
            try treasuryContract.governor() returns (address gov) {
                console2.log("Treasury governor:", gov);
                require(gov != address(0), "Treasury not properly initialized");
            } catch {
                console2.log("WARNING: Could not validate Treasury contract");
            }
        } catch {
            revert("TREASURY_ADDRESS environment variable is required");
        }

        // 3) Deploy NFTAuction with deployer as temporary operator; Treasury as beneficiary
        NFTAuction auction = new NFTAuction(deployer, payable(treasuryAddress));

        // 4) Deploy Voting with the minter, auction, treasury, and 20 initial base64 strings
        string[20] memory emptyPngs;
        for (uint256 i = 0; i < 20; i++) {
            emptyPngs[i] = "";
        }
        Voting voting = new Voting(
            minter,
            auction,
            ITreasury(treasuryAddress),
            emptyPngs
        );

        // 3.5) Set custom durations after deployment (better for testing)
        uint256 uploadDur = vm.envUint("UPLOAD_DURATION") > 0
            ? vm.envUint("UPLOAD_DURATION")
            : 10 minutes; // 600 seconds
        uint256 votingDur = vm.envUint("VOTING_DURATION") > 0
            ? vm.envUint("VOTING_DURATION")
            : 15 minutes; // 900 seconds
        uint256 biddingDur = vm.envUint("BIDDING_DURATION") > 0
            ? vm.envUint("BIDDING_DURATION")
            : 10 minutes; // 600 seconds
        voting.setDurations(uploadDur, votingDur, biddingDur);

        // 3.6) Set operator (relayer) for off-chain finalization
        address relayer;
        try vm.envAddress("RELAYER_ADDRESS") returns (address r) {
            relayer = r;
        } catch {
            try vm.envUint("RELAYER_PRIVATE_KEY") returns (uint256 relayerPk) {
                relayer = vm.addr(relayerPk);
            } catch {
                relayer = deployer; // fallback
            }
        }
        voting.setOperator(relayer);

        // 6) Transfer ownership of the minter to Voting so it can mint
        minter.transferOwnership(address(voting));

        // 7) Set the auction operator to Voting so it can start auctions after finalization
        auction.setOperator(address(voting));

        // 8) Configure Treasury as auction beneficiary through Voting contract
        voting.configureTreasuryBeneficiary();

        // 9) Verify final configuration
        console2.log("Final verification:");
        console2.log("  Auction beneficiary:", auction.beneficiary());
        console2.log("  Expected (Treasury):", treasuryAddress);
        require(
            auction.beneficiary() == treasuryAddress,
            "Beneficiary not properly set"
        );

        vm.stopBroadcast();

        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Deployer:", deployer);
        console2.log("NFTMinter:", address(minter));
        console2.log("NFTAuction:", address(auction));
        console2.log("Treasury:", treasuryAddress);
        console2.log("Voting:", address(voting));
        console2.log("Relayer (operator):", relayer);
        console2.log("\n=== INTEGRATION STATUS ===");
        console2.log("[SUCCESS] Auction proceeds go to Treasury");
        console2.log("[SUCCESS] Voting controls auction lifecycle");
        console2.log("[SUCCESS] NFTMinter owned by Voting contract");
        console2.log("[SUCCESS] Treasury integration complete");
    }
}
