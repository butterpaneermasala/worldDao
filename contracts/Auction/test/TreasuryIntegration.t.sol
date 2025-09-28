// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {NFTMinter} from "../src/NFTMinter.sol";
import {Voting, ITreasury} from "../src/Voting.sol";
import {NFTAuction} from "../src/Auction.sol";
import {MockTreasury} from "./mocks/MockTreasury.sol";
contract TreasuryIntegrationTest is Test {
    NFTMinter public minter;
    NFTAuction public auction;
    Voting public voting;
    MockTreasury public treasury;

    address public admin = makeAddr("admin");
    address public bidder1 = makeAddr("bidder1");
    address public bidder2 = makeAddr("bidder2");
    address public operator = makeAddr("operator");

    function setUp() public {
        vm.startPrank(admin);

        // Deploy mock treasury
        treasury = new MockTreasury(admin);

        // Deploy contracts
        minter = new NFTMinter("Test NFT", "TNFT", admin);
        auction = new NFTAuction(admin, payable(address(treasury)));

        string[20] memory emptySlots;
        voting = new Voting(
            minter,
            auction,
            ITreasury(address(treasury)),
            emptySlots
        );

        // Configure contracts
        minter.transferOwnership(address(voting));
        auction.setOperator(address(voting));
        voting.setOperator(operator);
        voting.configureTreasuryBeneficiary();

        vm.stopPrank();

        // Fund bidders
        vm.deal(bidder1, 10 ether);
        vm.deal(bidder2, 10 ether);
    }

    function testTreasuryIntegration() public {
        // Verify initial setup
        assertEq(auction.beneficiary(), address(treasury));
        assertEq(auction.operator(), address(voting));

        // Simulate voting phase completion and NFT auction
        vm.startPrank(operator);

        // Fast forward to end of voting
        vm.warp(block.timestamp + 15 minutes + 1);

        // Finalize with winner (this should mint NFT and start auction)
        voting.finalizeWithWinner(
            "ipfs://test",
            "dGVzdA==", // base64 "test"
            0 // winner slot
        );

        vm.stopPrank();

        // Verify NFT was minted and transferred to auction
        assertEq(minter.ownerOf(0), address(auction));
        assertTrue(auction.auctionActive());

        // Test auction bidding
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        vm.prank(bidder2);
        auction.bid{value: 2 ether}();

        // Fast forward to auction end
        vm.warp(auction.auctionEndTime() + 1);

        uint256 treasuryBalanceBefore = address(treasury).balance;

        // Trigger auction end (Chainlink automation would normally do this)
        auction.performUpkeep("");

        // Verify auction completed correctly
        assertFalse(auction.auctionActive());
        assertEq(minter.ownerOf(0), bidder2); // Highest bidder should own NFT
        assertEq(address(treasury).balance, treasuryBalanceBefore + 2 ether); // Treasury should receive proceeds

        console2.log("SUCCESS: Treasury Integration Test Passed!");
        console2.log("  - NFT minted and auctioned successfully");
        console2.log("  - Auction proceeds sent to Treasury");
        console2.log("  - Winner received NFT");
    }

    function testTreasuryValidation() public {
        // Test that invalid treasury addresses are rejected
        vm.expectRevert("Invalid treasury");
        string[20] memory emptySlots;
        new Voting(minter, auction, ITreasury(address(0)), emptySlots);
    }
}
