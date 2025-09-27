// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockTarget
 * @notice Mock contract for testing Treasury executeTransaction functionality
 */
contract MockTarget {
    uint256 public value;
    address public caller;
    bytes public data;
    bool public shouldRevert;
    
    event MockCall(address caller, uint256 value, bytes data);
    
    constructor() {
        shouldRevert = false;
    }
    
    function setValue(uint256 _value) external payable {
        if (shouldRevert) {
            revert("MockTarget: Forced revert");
        }
        
        value = _value;
        caller = msg.sender;
        data = msg.data;
        
        emit MockCall(msg.sender, msg.value, msg.data);
    }
    
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
    
    function getValue() external view returns (uint256) {
        return value;
    }
    
    receive() external payable {
        emit MockCall(msg.sender, msg.value, "");
    }
}