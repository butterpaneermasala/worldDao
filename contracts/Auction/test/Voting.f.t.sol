// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NFTMinter} from "../src/NFTMinter.sol";
import {NFTAuction} from "../src/Auction.sol";
import {Voting, ITreasury} from "../src/Voting.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MockTreasury} from "./mocks/MockTreasury.sol";

contract VotingFuzzTest is Test {
    address deployer = address(0xD3B10);
    address beneficiary = address(0xB33F);
    address voter = address(0xB07E);

    NFTMinter minter;
    NFTAuction auction;
    Voting voting;

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.deal(voter, 1 ether);

        // default: no seeds -> starts Uploading phase
        vm.startPrank(deployer);
        MockTreasury treasury = new MockTreasury(deployer);
        minter = new NFTMinter("DailyNFT", "DNFT", deployer);
        auction = new NFTAuction(deployer, payable(beneficiary));
        string[20] memory empty;
        voting = new Voting(
            minter,
            auction,
            ITreasury(address(treasury)),
            empty
        );
        // wire ownership/operator
        minter.transferOwnership(address(voting));
        auction.setOperator(address(voting));
        vm.stopPrank();
    }

    // Fuzz: proposing requires uploading phase and non-empty svg
    function testFuzz_ProposeRequiresUploadingAndNonEmpty(
        string memory tokenURI,
        string memory svg
    ) public {
        // At start: Uploading phase, empty proposals
        if (bytes(svg).length == 0) {
            vm.expectRevert(bytes("svg required"));
            voting.propose(tokenURI, svg);
            return;
        }
        voting.propose(tokenURI, svg);
        // proposalsCount should increase
        assertEq(voting.proposalsCount(), 1);
    }

    // Unit: automation from Uploading -> Voting when at least 1 proposal exists, extends otherwise
    function test_AutomationTransitionsUploadingToVoting() public {
        (Voting.Phase phase, ) = voting.currentPhaseInfo();
        assertEq(uint256(phase), uint256(Voting.Phase.Uploading));
        uint256 oldEnd;
        (, oldEnd) = voting.currentPhaseInfo();

        // Without proposals, performUpkeep should extend uploading
        vm.warp(oldEnd + 1);
        voting.performUpkeep("");
        (phase, ) = voting.currentPhaseInfo();
        assertEq(uint256(phase), uint256(Voting.Phase.Uploading));

        // Add a proposal then performUpkeep to move to Voting
        voting.propose("ipfs://x", "AA==");
        uint256 endBefore;
        (, endBefore) = voting.currentPhaseInfo();
        vm.warp(endBefore + 1);
        voting.performUpkeep("");
        (phase, ) = voting.currentPhaseInfo();
        assertEq(uint256(phase), uint256(Voting.Phase.Voting));
    }

    // Fuzz: vote only once per session and id must be valid
    function testFuzz_VoteOnceAndValidId(uint8 idx) public {
        uint256 count = 3;
        // Seed three proposals
        voting.propose("u1", "AA==");
        voting.propose("u2", "AA==");
        voting.propose("u3", "AA==");
        // move to Voting
        (, uint256 endUpload) = voting.currentPhaseInfo();
        vm.warp(endUpload + 1);
        voting.performUpkeep("");
        // bound idx to [0, count-1]
        uint256 id = bound(uint256(idx), 0, count - 1);
        vm.prank(voter);
        voting.voteIndex(uint8(id));
        vm.prank(voter);
        vm.expectRevert(bytes("Already voted this session"));
        voting.voteIndex(uint8(id));
    }

    // Unit: finalize mints and starts auction, then Bidding->Uploading cycles
    function test_FinalizeMintsAndStartsAuctionThenCycles() public {
        // seed
        voting.propose("u", "AA==");
        (, uint256 endUpload) = voting.currentPhaseInfo();
        vm.warp(endUpload + 1);
        voting.performUpkeep(""); // open voting
        // cast a vote to ensure a winner exists
        voting.voteIndex(0);
        (, uint256 endVote) = voting.currentPhaseInfo();
        vm.warp(endVote + 1);
        voting.performUpkeep(""); // finalize -> bidding
        // auction should be active now
        assertTrue(auction.auctionActive());
        // move past bidding end
        (, uint256 endBid) = voting.currentPhaseInfo();
        vm.warp(endBid + 1);
        voting.performUpkeep(""); // cycle back to uploading
        (Voting.Phase phase, ) = voting.currentPhaseInfo();
        assertEq(uint256(phase), uint256(Voting.Phase.Uploading));
    }
}
