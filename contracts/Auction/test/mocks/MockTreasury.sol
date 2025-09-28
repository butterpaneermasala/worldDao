// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Mock Treasury for testing
contract MockTreasury {
    address public governor;

    constructor(address _governor) {
        governor = _governor;
    }

    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
