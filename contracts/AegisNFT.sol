// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title AegisNFT
/// @notice ERC-721 collection used by AegisMint. Metadata URIs are stored as ipfs:// CIDs.
contract AegisNFT is ERC721URIStorage {
    error EmptyTokenURI();
    error InvalidTokenURI();

    uint256 private _nextTokenId = 1;

    mapping(uint256 tokenId => address creator) private _creators;

    event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI);

    constructor() ERC721("AegisMint NFT", "AEGIS") {}

    function mint(string calldata metadataURI) external returns (uint256 tokenId) {
        bytes memory uri = bytes(metadataURI);
        if (uri.length == 0) revert EmptyTokenURI();
        if (!_isIpfsURI(uri)) revert InvalidTokenURI();

        tokenId = _nextTokenId++;
        _creators[tokenId] = msg.sender;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit NFTMinted(tokenId, msg.sender, metadataURI);
    }

    function creatorOf(uint256 tokenId) external view returns (address) {
        // ownerOf provides the canonical existence check and custom ERC-721 error.
        ownerOf(tokenId);
        return _creators[tokenId];
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function _isIpfsURI(bytes memory uri) private pure returns (bool) {
        return uri.length > 7
            && uri[0] == 0x69 && uri[1] == 0x70 && uri[2] == 0x66 && uri[3] == 0x73
            && uri[4] == 0x3a && uri[5] == 0x2f && uri[6] == 0x2f;
    }
}
