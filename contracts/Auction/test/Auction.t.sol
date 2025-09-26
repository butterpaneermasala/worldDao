// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {DailyAuction} from "../src/Auction.sol";

contract AuctionTest is Test {
    DailyAuction auction;

    address auctioneer = address(0xA11CE);
    address bidder1 = address(0xB1);
    address bidder2 = address(0xB2);
    address bidder3 = address(0xB3);

    // Mirror the immutable from the contract for expectations
    uint256 constant AUCTION_DURATION = 23 hours; // 82800

    function setUp() public {
        // Deploy the contract from auctioneer
        vm.prank(auctioneer);
        auction = new DailyAuction();

        // Fund bidders
        deal(bidder1, 100 ether);
        deal(bidder2, 100 ether);
        deal(bidder3, 100 ether);
    }

    function testConstructorInitializesState() public {
        // Auctioneer should be deployer
        assertEq(auction._auctioneer(), payable(auctioneer));
        // End time should be now + duration
        uint256 endTime = auction._auctionEndTime();
        assertApproxEqAbs(endTime, block.timestamp + AUCTION_DURATION, 2);
    }

    function testBidSingleBidderIncreasesHighestBidAndEmits() public {
        vm.prank(bidder1);
        vm.expectEmit(true, false, false, true);
        emit DailyAuction.HighestBidIncreased(bidder1, 1 ether);
        auction.bid{value: 1 ether}();

        assertEq(auction._highestBidder(), bidder1);
        assertEq(auction._highestBid(), 1 ether);
        assertEq(auction._bidAmounts(bidder1), 1 ether);
    }

    function testBidCumulativeMustExceedHighest() public {
        // bidder1 bids 1 ether
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        // bidder1 cannot bid 0 (no increase)
        vm.prank(bidder1);
        vm.expectRevert(
            bytes("Your total bid must be higher than the current highest bid")
        );
        auction.bid{value: 0}();

        // bidder2 cannot bid <= 1 ether
        vm.prank(bidder2);
        vm.expectRevert(
            bytes("Your total bid must be higher than the current highest bid")
        );
        auction.bid{value: 1 ether}();

        // bidder2 can outbid with 2 ether
        vm.prank(bidder2);
        auction.bid{value: 2 ether}();
        assertEq(auction._highestBidder(), bidder2);
        assertEq(auction._highestBid(), 2 ether);

        // bidder1 can cumulatively outbid by adding more
        vm.prank(bidder1);
        auction.bid{value: 2 ether}(); // total 3 ether
        assertEq(auction._highestBidder(), bidder1);
        assertEq(auction._highestBid(), 3 ether);
        assertEq(auction._bidAmounts(bidder1), 3 ether);
    }

    function testBidRevertsAfterEndTime() public {
        // move past end time
        vm.warp(auction._auctionEndTime() + 1);
        vm.prank(bidder1);
        vm.expectRevert(bytes("Bidding is not open at this time"));
        auction.bid{value: 1 ether}();
    }

    function testWithdrawRevertsForHighestBidderAndZeroAmount() public {
        // Place a bid so bidder1 is highest
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        // Highest bidder cannot withdraw
        vm.prank(bidder1);
        vm.expectRevert(bytes("Highest bidder cannot withdraw funds"));
        auction.withdraw();

        // Non-bidder cannot withdraw
        vm.prank(bidder3);
        vm.expectRevert(bytes("No pending funds to withdraw"));
        auction.withdraw();
    }

    function testWithdrawSucceedsForOutbidBidder() public {
        // bidder1 bids 1 ether
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        // bidder2 outbids with 2 ether
        vm.prank(bidder2);
        auction.bid{value: 2 ether}();

        // bidder1 can withdraw 1 ether
        uint256 balBefore = bidder1.balance;
        vm.prank(bidder1);
        vm.expectEmit(true, true, false, true);
        emit DailyAuction.BidWithdrawn(bidder1, 1 ether);
        auction.withdraw();
        assertEq(bidder1.balance, balBefore + 1 ether);
        assertEq(auction._bidAmounts(bidder1), 0);
    }

    function testCheckUpkeepLogic() public {
        // Before end time => false
        (bool needed, ) = auction.checkUpkeep("");
        assertFalse(needed);

        // Advance to end => true
        vm.warp(auction._auctionEndTime());
        (needed, ) = auction.checkUpkeep("");
        assertTrue(needed);

        // After end => true
        vm.warp(auction._auctionEndTime() + 1);
        (needed, ) = auction.checkUpkeep("");
        assertTrue(needed);
    }

    function testPerformUpkeepTransfersToAuctioneerAndResets() public {
        // Setup: multiple bids
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();
        vm.prank(bidder2);
        auction.bid{value: 3 ether}();
        // bidder1 currently has 1 ether; needs to exceed current highest (3 ether)
        // A 2 ether bid would only tie (total 3) and revert. Bid 3 ether to total 4 and become highest.
        vm.prank(bidder1);
        auction.bid{value: 3 ether}(); // total 4 ether => highest

        // Move time past end
        vm.warp(auction._auctionEndTime() + 1);

        // Expect end event
        vm.expectEmit(false, false, false, true);
        emit DailyAuction.AuctionEnded(bidder1, 4 ether);

        uint256 auctioneerBalBefore = auctioneer.balance;

        // Perform upkeep
        auction.performUpkeep("");

        // Highest bid transferred
        assertEq(auctioneer.balance, auctioneerBalBefore + 4 ether);

        // State reset
        assertEq(auction._highestBid(), 0);
        assertEq(auction._highestBidder(), address(0));
        // New end time set roughly now + duration
        assertApproxEqAbs(
            auction._auctionEndTime(),
            block.timestamp + AUCTION_DURATION,
            2
        );
    }

    function testOutbidBidderCanWithdrawEvenAfterPerformUpkeep() public {
        // bidder1 bids 1 ether, bidder2 outbids with 2 ether, bidder3 outbids with 3 ether
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();
        vm.prank(bidder2);
        auction.bid{value: 2 ether}();
        vm.prank(bidder3);
        auction.bid{value: 3 ether}();

        // End the auction
        vm.warp(auction._auctionEndTime() + 1);
        auction.performUpkeep("");

        // bidder1 withdraws their 1 ether (mapping was not reset for non-highest)
        uint256 before1 = bidder1.balance;
        vm.prank(bidder1);
        auction.withdraw();
        assertEq(bidder1.balance, before1 + 1 ether);

        // bidder2 withdraws their 2 ether
        uint256 before2 = bidder2.balance;
        vm.prank(bidder2);
        auction.withdraw();
        assertEq(bidder2.balance, before2 + 2 ether);
    }

    function testCannotPerformUpkeepBeforeEnd() public {
        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        vm.expectRevert(bytes("Upkeep not needed"));
        auction.performUpkeep("");
    }

    function testNewAuctionAcceptsBidsAfterReset() public {
        // Finish first auction
        vm.prank(bidder1);
        auction.bid{value: 2 ether}();
        vm.warp(auction._auctionEndTime() + 1);
        auction.performUpkeep("");

        // New auction should accept bids and reset state
        vm.prank(bidder2);
        auction.bid{value: 1 ether}();
        assertEq(auction._highestBidder(), bidder2);
        assertEq(auction._highestBid(), 1 ether);
    }
}
