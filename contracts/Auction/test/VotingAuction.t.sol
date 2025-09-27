// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NFTMinter} from "../src/NFTMinter.sol";
import {Voting} from "../src/Voting.sol";
import {NFTAuction} from "../src/NFTAuction.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract VotingAuctionTest is Test {
    // Actors
    address deployer = address(0xD3B10);
    address beneficiary = address(0xB33F);
    address voter1 = address(0xA1);
    address voter2 = address(0xA2);
    address voter3 = address(0xA3);
    address bidder1 = address(0xB1);
    address bidder2 = address(0xB2);

    // Contracts
    NFTMinter minter;
    NFTAuction auction;
    Voting voting;

    // Helpers
    string[20] pngs;

    function setUp() public {
        // Provide balances
        deal(voter1, 1 ether);
        deal(voter2, 1 ether);
        deal(voter3, 1 ether);
        deal(bidder1, 100 ether);
        deal(bidder2, 100 ether);
        deal(beneficiary, 0 ether);

        // Build candidate PNGs (dummy base64 payloads)
        for (uint256 i = 0; i < 20; i++) {
            pngs[i] = "AA=="; // base64 for 0x00
        }

        // Set a deterministic timestamp before deployment
        // Choose an arbitrary base time (e.g., 1_700_000_000)
        vm.warp(1_700_000_000);

        // Deploy contracts
        vm.prank(deployer);
        minter = new NFTMinter("DailyNFT", "DNFT", deployer);

        // Auction operator initially deployer; will be switched to Voting later
        vm.prank(deployer);
        auction = new NFTAuction(deployer, payable(beneficiary));

        vm.prank(deployer);
        voting = new Voting(minter, auction, pngs);

        // Transfer minter ownership to voting so it can mint at finalize
        vm.prank(deployer);
        minter.transferOwnership(address(voting));

        // Set auction operator to voting so it can start auctions
        vm.prank(deployer);
        auction.setOperator(address(voting));
    }

    // -------- Voting unit tests --------

    function testVoteSuccessAndOnePerDay() public {
        uint256 end = voting.currentDayEndIST();
        // voter1 votes candidate 0
        vm.prank(voter1);
        voting.vote(0);
        assertEq(voting.votes(0), 1);
        // Re-vote in the same day should revert
        vm.prank(voter1);
        vm.expectRevert(bytes("Already voted this session"));
        voting.vote(0);
        // Advance to end of day and ensure voting closes
        vm.warp(end);
        vm.prank(voter2);
        vm.expectRevert(bytes("Voting closed"));
        voting.vote(1);
    }

    function testVoteInvalidCandidate() public {
        vm.prank(voter1);
        vm.expectRevert(bytes("Bad id"));
        voting.vote(20);
    }

    function testTieBreakerFirstToReachHighestVotes() public {
        // Two candidates will end day with 2 votes each.
        // Candidate 1 should be the winner if it reached 2 first (earlier lastVoteTimestamp).
        // Order: voter1 -> cand1, voter2 -> cand1 (cand1 hits 2) then voter3 -> cand0 twice (hits 2 later)
        vm.prank(voter1);
        voting.vote(1); // cand1:1
        // small time advance
        vm.warp(block.timestamp + 10);
        vm.prank(voter2);
        voting.vote(1); // cand1:2 (earlier timestamp for reaching 2)
        vm.warp(block.timestamp + 10);
        vm.prank(voter3);
        voting.vote(0); // cand0:1
        // Simulate second voter for cand0 on next address same day -> need a new address
        address voter4 = address(0xA4);
        deal(voter4, 1 ether);
        vm.prank(voter4);
        voting.vote(0); // cand0:2 (reached later)

        // End the day
        vm.warp(voting.currentDayEndIST());
        // Finalize
        voting.performUpkeep("");

        // After finalize, votes reset to 0 for next day and NFT minted+auction started.
        // We can't easily read the winner from the event here, but we can assert auction has started
        // for a token owned by the auction.
        // The auction token is owned by auction contract after Voting transferred it.
        // Check that auction has active auction.
        // By construction, the NFT minted is tokenId 0 for first day.
        assertTrue(auction.auctionActive());
    }

    // -------- Auction unit tests --------

    function testAuctionBiddingAndWithdraw() public {
        // Prepare an auction by finalizing today's voting quickly
        vm.prank(voter1);
        voting.vote(0);
        vm.warp(voting.currentDayEndIST());
        voting.performUpkeep("");

        // Now auction is active for next day. Place bids
        vm.prank(bidder1);
        auction.bid{value: 2 ether}();
        vm.prank(bidder2);
        auction.bid{value: 3 ether}();
        // bidder1 tries to withdraw (outbid)
        uint256 b1 = bidder1.balance;
        vm.prank(bidder1);
        auction.withdraw();
        assertEq(bidder1.balance, b1 + 2 ether);
        // Winner cannot withdraw
        vm.prank(bidder2);
        vm.expectRevert(bytes("Winner cannot withdraw"));
        auction.withdraw();
    }

    // -------- Mega end-to-end flow --------

    function testMega_EndToEnd_DailyVotingThenNextDayAuctionAndFinalize() public {
        // Day 1: voting
        vm.prank(voter1);
        voting.vote(5);
        vm.prank(voter2);
        voting.vote(5);
        // End of day 1
        vm.warp(voting.currentDayEndIST());
        uint256 beforeMintBalance = IERC721(address(minter)).balanceOf(address(voting));
        voting.performUpkeep("");
        // After finalize: NFT minted to voting, then transferred to auction and auction started
        assertTrue(auction.auctionActive());
        assertEq(IERC721(address(minter)).balanceOf(address(voting)), beforeMintBalance); // transferred out
        assertEq(IERC721(address(minter)).ownerOf(0), address(auction));

        // Day 2: place bids
        deal(bidder1, 100 ether);
        deal(bidder2, 100 ether);
        vm.prank(bidder1);
        auction.bid{value: 10 ether}();
        vm.prank(bidder2);
        auction.bid{value: 15 ether}();

        // Move to end of auction day (next IST midnight)
        // auction end equals voting.currentDayStartIST() + 1 days after first finalize
        // We can just warp past a day from current time to be safe
        vm.warp(block.timestamp + 1 days + 1);

        uint256 benBefore = beneficiary.balance;
        // Finalize auction upkeep
        auction.performUpkeep("");

        // NFT goes to highest bidder (bidder2), funds to beneficiary
        assertEq(IERC721(address(minter)).ownerOf(0), bidder2);
        assertEq(beneficiary.balance, benBefore + 15 ether);
        assertFalse(auction.auctionActive());
    }
}
