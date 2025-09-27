// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {NFTMinter} from "../src/NFTMinter.sol";
import {NFTAuction} from "../src/Auction.sol";

contract NFTAuctionFuzzTest is Test {
    address deployer = address(0xD3B10);
    address beneficiary = address(0xB33F);
    address operator = address(0x0B0B);
    address bidderA = address(0xA11);
    address bidderB = address(0xA22);

    NFTMinter minter;
    NFTAuction auction;

    function setUp() public {
        vm.deal(bidderA, 1_000 ether);
        vm.deal(bidderB, 1_000 ether);
        vm.deal(beneficiary, 0);

        vm.startPrank(deployer);
        minter = new NFTMinter("DailyNFT", "DNFT", deployer);
        auction = new NFTAuction(operator, payable(beneficiary));
        // mint tokenId 0 to deployer and transfer to auction
        uint256 tokenId = minter.mintWithSVG(deployer, "AA==");
        IERC721(address(minter)).safeTransferFrom(deployer, address(auction), tokenId);
        vm.stopPrank();

        // set operator to deployer for tests by impersonating operator
        vm.prank(operator);
        auction.setOperator(deployer);

        // start auction
        vm.prank(deployer);
        auction.startAuction(address(minter), 0, block.timestamp + 1 days);
    }

    // Fuzz: bids must strictly increase over highestBid, cumulative
    function testFuzz_BidsMustIncrease(uint128 a1, uint128 b1) public {
        // constrain values to reasonable range to avoid overflow of balances
        vm.assume(a1 > 0 && a1 < 100 ether);
        vm.assume(b1 > 0 && b1 < 100 ether);

        vm.prank(bidderA);
        auction.bid{value: a1}();
        assertEq(auction.highestBidder(), bidderA);
        assertEq(auction.highestBid(), a1);

        // bidderB must exceed a1 to succeed
        if (b1 <= a1) {
            vm.prank(bidderB);
            vm.expectRevert(bytes("Bid too low"));
            auction.bid{value: b1}();
        } else {
            vm.prank(bidderB);
            auction.bid{value: b1}();
            assertEq(auction.highestBidder(), bidderB);
            assertEq(auction.highestBid(), b1);
        }
    }

    // Unit: withdraw returns exact previous contribution for outbid bidder
    function testWithdrawForOutbidUnit() public {
        address who = address(0xC33);
        vm.deal(who, 10 ether);

        // who bids first 1 ether
        vm.prank(who);
        auction.bid{value: 1 ether}();

        // bidderA outbids with 2 ether
        vm.prank(bidderA);
        auction.bid{value: 2 ether}();

        // who can withdraw their 1 ether
        uint256 beforeBal = who.balance;
        vm.prank(who);
        auction.withdraw();
        assertEq(who.balance, beforeBal + 1 ether);
    }

    // Fuzz: startAuction rejects invalid endTimes and not-owned IDs
    function testFuzz_StartAuctionValidation(uint256 endTimeOffset, uint256 wrongTokenId) public {
        // Use a fresh auction instance so it's not already active
        vm.startPrank(deployer);
        NFTAuction freshAuction = new NFTAuction(deployer, payable(beneficiary));
        // mint tokenId 1 to deployer and transfer to freshAuction
        uint256 tokenId = minter.mintWithSVG(deployer, "AA=="); // tokenId 1
        IERC721(address(minter)).safeTransferFrom(deployer, address(freshAuction), tokenId);
        vm.stopPrank();

        // attempt with bad end time (<= now)
        vm.assume(endTimeOffset <= block.timestamp);
        vm.prank(deployer);
        vm.expectRevert(bytes("Bad end time"));
        freshAuction.startAuction(address(minter), tokenId, endTimeOffset);

        // attempt with not owned or non-existent token id on freshAuction
        vm.prank(deployer);
        vm.expectRevert(); // could be ERC721NonexistentToken or "NFT not owned"
        freshAuction.startAuction(address(minter), wrongTokenId == tokenId ? tokenId + 1 : wrongTokenId, block.timestamp + 1 days);
    }

    // Unit: finalize pays beneficiary and transfers NFT
    function testFinalizePaysAndTransfers() public {
        // place two bids
        vm.prank(bidderA);
        auction.bid{value: 3 ether}();
        vm.prank(bidderB);
        auction.bid{value: 5 ether}();

        uint256 benBefore = beneficiary.balance;
        vm.warp(block.timestamp + 2 days);
        auction.performUpkeep("");

        assertEq(beneficiary.balance, benBefore + 5 ether);
        assertEq(IERC721(address(minter)).ownerOf(0), bidderB);
        assertFalse(auction.auctionActive());
    }
}
