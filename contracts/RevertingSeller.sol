// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IAegisNFT {
    function mint(string calldata metadataURI) external returns (uint256);
    function approve(address to, uint256 tokenId) external;
}

interface IAegisMarketplace {
    function createListing(address nftContract, uint256 tokenId, uint256 price) external returns (uint256);
    function withdrawProceeds(address payable recipient) external;
}

/// @dev Test helper proving seller payout failure cannot DoS marketplace settlement.
contract RevertingSeller is IERC721Receiver {
    error EtherRejected();

    receive() external payable {
        revert EtherRejected();
    }

    function mintApproveAndList(address nft, address marketplace, string calldata uri, uint256 price)
        external
        returns (uint256 tokenId, uint256 listingId)
    {
        tokenId = IAegisNFT(nft).mint(uri);
        IAegisNFT(nft).approve(marketplace, tokenId);
        listingId = IAegisMarketplace(marketplace).createListing(nft, tokenId, price);
    }

    function attemptWithdraw(address marketplace, address payable recipient) external {
        IAegisMarketplace(marketplace).withdrawProceeds(recipient);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
