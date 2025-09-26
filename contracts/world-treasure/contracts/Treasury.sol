// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @notice Treasury contract for DAO that safely holds ETH and tokens
 * @dev Only allows execution through authorized governance contract
 */
contract Treasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public governor;

    // Events for transparency
    event FundsReceived(address indexed from, uint256 amount);
    event TokensReceived(
        address indexed token,
        address indexed from,
        uint256 amount
    );
    event TransactionExecuted(
        address indexed target,
        uint256 value,
        bytes data,
        bool success
    );
    event GovernorChanged(
        address indexed oldGovernor,
        address indexed newGovernor
    );

    modifier onlyGovernor() {
        require(msg.sender == governor, "Treasury: Not authorized");
        _;
    }

    constructor(address _governor) {
        require(_governor != address(0), "Treasury: Invalid governor address");
        governor = _governor;
        emit GovernorChanged(address(0), _governor);
    }

    /**
     * @notice Receive ETH deposits from anyone
     */
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    /**
     * @notice Fallback function to receive ETH
     */
    fallback() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    /**
     * @notice Accept token deposits from anyone
     * @param token The ERC20 token address
     * @param amount The amount to deposit
     */
    function depositToken(address token, uint256 amount) external {
        require(token != address(0), "Treasury: Invalid token address");
        require(amount > 0, "Treasury: Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TokensReceived(token, msg.sender, amount);
    }

    /**
     * @notice Execute arbitrary transaction (only governance)
     * @param target Contract or wallet to call
     * @param value ETH value to send
     * @param data Call data (function call encoded)
     * @return success Whether the call succeeded
     * @return returnData The return data from the call
     */
    function executeTransaction(
        address target,
        uint256 value,
        bytes calldata data
    )
        external
        onlyGovernor
        nonReentrant
        returns (bool success, bytes memory returnData)
    {
        require(target != address(0), "Treasury: Invalid target address");
        require(
            address(this).balance >= value,
            "Treasury: Insufficient ETH balance"
        );

        (success, returnData) = target.call{value: value}(data);
        emit TransactionExecuted(target, value, data, success);

        return (success, returnData);
    }

    /**
     * @notice Batch execute multiple transactions (only governance)
     * @param targets Array of contract/wallet addresses to call
     * @param values Array of ETH values to send
     * @param datas Array of call data
     * @return successes Array of success status for each call
     */
    function batchExecuteTransactions(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyGovernor nonReentrant returns (bool[] memory successes) {
        require(
            targets.length == values.length && values.length == datas.length,
            "Treasury: Array length mismatch"
        );

        successes = new bool[](targets.length);

        for (uint256 i = 0; i < targets.length; i++) {
            require(
                targets[i] != address(0),
                "Treasury: Invalid target address"
            );

            bytes memory returnData;
            (successes[i], returnData) = targets[i].call{value: values[i]}(
                datas[i]
            );
            emit TransactionExecuted(
                targets[i],
                values[i],
                datas[i],
                successes[i]
            );
        }

        return successes;
    }

    /**
     * @notice Transfer ETH to address (only governance)
     * @param to Recipient address
     * @param amount Amount of ETH to transfer
     */
    function transferETH(
        address payable to,
        uint256 amount
    ) external onlyGovernor nonReentrant {
        require(to != address(0), "Treasury: Invalid recipient address");
        require(
            address(this).balance >= amount,
            "Treasury: Insufficient ETH balance"
        );

        (bool success, ) = to.call{value: amount}("");
        require(success, "Treasury: ETH transfer failed");

        emit TransactionExecuted(to, amount, "", success);
    }

    /**
     * @notice Transfer tokens to address (only governance)
     * @param token Token contract address
     * @param to Recipient address
     * @param amount Amount of tokens to transfer
     */
    function transferToken(
        address token,
        address to,
        uint256 amount
    ) external onlyGovernor {
        require(token != address(0), "Treasury: Invalid token address");
        require(to != address(0), "Treasury: Invalid recipient address");

        IERC20(token).safeTransfer(to, amount);

        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            to,
            amount
        );
        emit TransactionExecuted(token, 0, data, true);
    }

    /**
     * @notice Change governor for governance migration (only current governor)
     * @param _newGovernor New governor address
     */
    function setGovernor(address _newGovernor) external onlyGovernor {
        require(
            _newGovernor != address(0),
            "Treasury: Invalid governor address"
        );
        require(_newGovernor != governor, "Treasury: Same governor address");

        address oldGovernor = governor;
        governor = _newGovernor;

        emit GovernorChanged(oldGovernor, _newGovernor);
    }

    /**
     * @notice Get ETH balance
     * @return ETH balance of the treasury
     */
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get token balance
     * @param token Token contract address
     * @return Token balance of the treasury
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
