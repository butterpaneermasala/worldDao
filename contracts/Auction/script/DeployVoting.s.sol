// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {NFTMinter} from "../src/NFTMinter.sol";
import {Voting} from "../src/Voting.sol";
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

        // 1) Deploy NFTMinter with initialOwner set to deployer (EOA)
        NFTMinter minter = new NFTMinter(NAME, SYMBOL, deployer);

        // 2) Deploy NFTAuction with temporary operator = deployer; beneficiary = deployer (adjust if needed)
        NFTAuction auction = new NFTAuction(deployer, payable(deployer));

        // 3) Deploy Voting with the minter, auction, and 20 initial base64 strings (empty by default)
        string[20] memory emptyPngs;
        for (uint256 i = 0; i < 20; i++) {
            emptyPngs[i] = "";
        }
        Voting voting = new Voting(minter, auction, emptyPngs);

        // 4) Transfer ownership of the minter to Voting so it can mint
        minter.transferOwnership(address(voting));

        // 5) Set the auction operator to Voting so it can start auctions after finalization
        auction.setOperator(address(voting));

        vm.stopBroadcast();

        console2.log("Deployer:", deployer);
        console2.log("NFTMinter:", address(minter));
        console2.log("NFTAuction:", address(auction));
        console2.log("Voting:", address(voting));
    }
}
