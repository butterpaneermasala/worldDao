// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Simple ERC721 minter that stores SVG data as a data: URI
/// @notice The owner (expected to be the Voting contract) can mint NFTs with a base64 SVG payload
contract NFTMinter is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor(string memory name_, string memory symbol_, address initialOwner)
        ERC721(name_, symbol_)
        Ownable(initialOwner)
    {}

    /// @dev Mints an NFT to `to` with tokenURI set to a data URI `data:image/svg+xml;base64,<svgBase64>`
    /// @param to Recipient address
    /// @param svgBase64 Base64-encoded SVG string (do not include prefix)
    /// @return tokenId Newly minted token id
    function mintWithSVG(address to, string calldata svgBase64) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId;
        _nextTokenId = tokenId + 1;
        _safeMint(to, tokenId);
        string memory uri = string.concat("data:image/svg+xml;base64,", svgBase64);
        _setTokenURI(tokenId, uri);
    }

    /// @dev Mints an NFT to `to` with a provided tokenURI (e.g., ipfs://CID or https gateway URL)
    /// @param to Recipient address
    /// @param tokenURI_ The full tokenURI to set
    /// @return tokenId Newly minted token id
    function mintWithTokenURI(address to, string calldata tokenURI_) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId;
        _nextTokenId = tokenId + 1;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
    }
}
