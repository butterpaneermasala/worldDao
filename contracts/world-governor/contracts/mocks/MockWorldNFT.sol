// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockWorldNFT
 * @notice Mock NFT contract for testing governance functionality
 * @dev Implements the same interface as the real WorldNFT contract
 */
contract MockWorldNFT {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    uint256 private _totalSupply;
    uint256 private _currentTokenId;

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );

    constructor() {
        _totalSupply = 0;
        _currentTokenId = 1;
    }

    /**
     * @notice Mint NFTs to an address (for testing)
     */
    function mint(address to, uint256 amount) external {
        require(to != address(0), "ERC721: mint to the zero address");

        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = _currentTokenId++;
            _owners[tokenId] = to;
            _balances[to]++;
            _totalSupply++;

            emit Transfer(address(0), to, tokenId);
        }
    }

    /**
     * @notice Get the balance of an address
     */
    function balanceOf(address owner) external view returns (uint256) {
        require(
            owner != address(0),
            "ERC721: balance query for the zero address"
        );
        return _balances[owner];
    }

    /**
     * @notice Get the owner of a specific token
     */
    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(
            owner != address(0),
            "ERC721: owner query for nonexistent token"
        );
        return owner;
    }

    /**
     * @notice Get total supply of NFTs
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Burn NFTs (for testing)
     */
    function burn(uint256 tokenId) external {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: burn of nonexistent token");

        _balances[owner]--;
        delete _owners[tokenId];
        _totalSupply--;

        emit Transfer(owner, address(0), tokenId);
    }

    /**
     * @notice Transfer NFT (basic implementation for testing)
     */
    function transfer(address to, uint256 tokenId) external {
        address owner = _owners[tokenId];
        require(msg.sender == owner, "Not token owner");
        require(to != address(0), "Transfer to zero address");

        _balances[owner]--;
        _balances[to]++;
        _owners[tokenId] = to;

        emit Transfer(owner, to, tokenId);
    }

    /**
     * @notice Set balance directly (for testing convenience)
     */
    function setBalance(address owner, uint256 balance) external {
        _balances[owner] = balance;
    }
}
