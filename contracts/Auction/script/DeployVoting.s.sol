// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {NFTMinter} from "../src/NFTMinter.sol";
import {Voting} from "../src/Voting.sol";
import {NFTAuction} from "../src/NFTAuction.sol";

contract DeployVoting is Script {
    // Configure your collection name/symbol here
    string constant NAME = "DailyNFT";
    string constant SYMBOL = "DNFT";

    // Fill your 20 Base64 PNG strings below before broadcasting.
    // Example: "iVBORw0KGgoAAAANSUhEUgAA..." (without the data-uri prefix)
    function _candidatePngs() internal pure returns (string[20] memory arr) {
        // TODO: Replace with your actual base64 PNGs
        for (uint256 i = 0; i < 20; i++) {
            arr[i] = ""; // placeholder
        }
    }

    function run() external {
        // Private key should be provided via env var: 
        // export PRIVATE_KEY=0x...
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        // 1) Deploy NFTMinter with initialOwner set to deployer (EOA)
        NFTMinter minter = new NFTMinter(NAME, SYMBOL, deployer);

        // 2) Deploy NFTAuction with temporary operator = deployer; beneficiary = deployer (adjust if needed)
        NFTAuction auction = new NFTAuction(deployer, payable(deployer));

        // 3) Deploy Voting with the minter, auction, and 20 candidate PNGs
        string[20] memory pngs = _candidatePngs();
        Voting voting = new Voting(minter, auction, pngs);

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
