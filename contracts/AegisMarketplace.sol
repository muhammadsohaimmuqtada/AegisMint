// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AegisMarketplace
/// @notice Escrow-based ERC-721 marketplace with defensive settlement and fee accounting.
/// @dev The contract intentionally rejects unsolicited safe NFT transfers so assets cannot be
///      accidentally trapped in marketplace custody outside a listing flow.
contract AegisMarketplace is IERC721Receiver, Ownable2Step, ReentrancyGuard {
    error InvalidAddress();
    error InvalidPrice();
    error FeeTooHigh();
    error NotTokenOwner();
    error MarketplaceNotApproved();
    error AlreadyListed();
    error ListingNotFound();
    error ListingNotActive();
    error UnauthorizedSeller();
    error CannotBuyOwnNFT();
    error IncorrectPayment(uint256 expected, uint256 received);
    error UnexpectedNFTTransfer();
    error NoProceeds();
    error TransferFailed();
    error DirectPaymentsNotAccepted();
    error InvalidPageSize();
    error UnsupportedNFTContract();

    uint96 public constant MAX_FEE_BPS = 1_000; // 10%
    uint96 public marketplaceFeeBps;
    address public immutable supportedNftContract;

    uint256 private _nextListingId = 1;
    uint256[] private _listingIds;
    uint256 private _activeListings;
    uint256 private _totalSales;
    uint256 private _totalVolume;

    uint256 public accruedFees;
    uint256 public totalDeferredProceeds;

    struct Listing {
        uint256 id;
        address nftContract;
        uint256 tokenId;
        address seller;
        uint96 feeBps;
        address buyer;
        uint256 price;
        bool active;
        bool sold;
        uint64 listedAt;
        uint64 closedAt;
    }

    mapping(uint256 listingId => Listing listing) private _listings;
    mapping(address nftContract => mapping(uint256 tokenId => uint256 listingId)) public activeListingByAsset;
    mapping(address seller => uint256 amount) public pendingProceeds;

    // Sentinel used to accept only the NFT transfer initiated by createListing.
    address private _expectedNftContract;
    address private _expectedFrom;
    uint256 private _expectedTokenId;

    event NFTListed(
        uint256 indexed listingId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );
    event NFTSold(
        uint256 indexed listingId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price,
        uint256 marketplaceFee
    );
    event ListingCancelled(
        uint256 indexed listingId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller
    );
    event ProceedsDeferred(uint256 indexed listingId, address indexed seller, uint256 amount);
    event ProceedsWithdrawn(address indexed seller, address indexed recipient, uint256 amount);
    event MarketplaceFeeUpdated(uint96 previousFeeBps, uint96 newFeeBps);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    constructor(address initialOwner, address supportedCollection, uint96 initialFeeBps) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert InvalidAddress();
        if (supportedCollection == address(0) || supportedCollection.code.length == 0) revert InvalidAddress();
        if (initialFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        supportedNftContract = supportedCollection;
        marketplaceFeeBps = initialFeeBps;
    }

    receive() external payable {
        revert DirectPaymentsNotAccepted();
    }

    function createListing(address nftContract, uint256 tokenId, uint256 price)
        external
        nonReentrant
        returns (uint256 listingId)
    {
        if (nftContract != supportedNftContract) revert UnsupportedNFTContract();
        if (price == 0) revert InvalidPrice();
        if (activeListingByAsset[nftContract][tokenId] != 0) revert AlreadyListed();

        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        bool approved = nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this));
        if (!approved) revert MarketplaceNotApproved();

        // Arm the receiver before escrow transfer; any other safe transfer is rejected.
        _expectedNftContract = nftContract;
        _expectedFrom = msg.sender;
        _expectedTokenId = tokenId;
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        _clearExpectedTransfer();

        listingId = _nextListingId++;
        _listings[listingId] = Listing({
            id: listingId,
            nftContract: nftContract,
            tokenId: tokenId,
            seller: msg.sender,
            feeBps: marketplaceFeeBps,
            buyer: address(0),
            price: price,
            active: true,
            sold: false,
            listedAt: uint64(block.timestamp),
            closedAt: 0
        });

        _listingIds.push(listingId);
        activeListingByAsset[nftContract][tokenId] = listingId;
        ++_activeListings;

        emit NFTListed(listingId, nftContract, tokenId, msg.sender, price);
    }

    function buyNFT(uint256 listingId) external payable nonReentrant {
        Listing storage listing = _getExistingListing(listingId);
        if (!listing.active) revert ListingNotActive();
        if (listing.seller == msg.sender) revert CannotBuyOwnNFT();
        if (msg.value != listing.price) revert IncorrectPayment(listing.price, msg.value);

        // Effects before interactions.
        listing.active = false;
        listing.sold = true;
        listing.buyer = msg.sender;
        listing.closedAt = uint64(block.timestamp);
        activeListingByAsset[listing.nftContract][listing.tokenId] = 0;
        --_activeListings;
        ++_totalSales;
        _totalVolume += listing.price;

        uint256 fee = (listing.price * listing.feeBps) / 10_000;
        uint256 sellerProceeds = listing.price - fee;
        accruedFees += fee;

        // Transfer ownership before settling ETH. A receiver rejection reverts the entire sale.
        IERC721(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);

        // A malicious/reverting seller must not be able to permanently DoS a valid purchase.
        (bool paid,) = payable(listing.seller).call{value: sellerProceeds}("");
        if (!paid) {
            pendingProceeds[listing.seller] += sellerProceeds;
            totalDeferredProceeds += sellerProceeds;
            emit ProceedsDeferred(listingId, listing.seller, sellerProceeds);
        }

        emit NFTSold(
            listingId,
            listing.nftContract,
            listing.tokenId,
            listing.seller,
            msg.sender,
            listing.price,
            fee
        );
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = _getExistingListing(listingId);
        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert UnauthorizedSeller();

        listing.active = false;
        listing.closedAt = uint64(block.timestamp);
        activeListingByAsset[listing.nftContract][listing.tokenId] = 0;
        --_activeListings;

        IERC721(listing.nftContract).safeTransferFrom(address(this), listing.seller, listing.tokenId);

        emit ListingCancelled(listingId, listing.nftContract, listing.tokenId, listing.seller);
    }

    function withdrawProceeds(address payable recipient) external nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        uint256 amount = pendingProceeds[msg.sender];
        if (amount == 0) revert NoProceeds();

        pendingProceeds[msg.sender] = 0;
        totalDeferredProceeds -= amount;

        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit ProceedsWithdrawn(msg.sender, recipient, amount);
    }

    function setMarketplaceFee(uint96 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint96 previous = marketplaceFeeBps;
        marketplaceFeeBps = newFeeBps;
        emit MarketplaceFeeUpdated(previous, newFeeBps);
    }

    function withdrawFees(address payable recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0 || amount > accruedFees) revert InvalidPrice();

        accruedFees -= amount;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(recipient, amount);
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return _getExistingListing(listingId);
    }

    /// @notice Returns active listings using cursor pagination.
    /// @dev Scans historical listing ids. Intended for small testnet datasets; production indexing
    ///      should consume emitted events with an indexer while treating contract state as canonical.
    function getActiveListings(uint256 cursor, uint256 pageSize)
        external
        view
        returns (Listing[] memory listings, uint256 nextCursor)
    {
        if (pageSize == 0 || pageSize > 100) revert InvalidPageSize();

        uint256 total = _listingIds.length;
        if (cursor >= total) return (new Listing[](0), total);

        Listing[] memory buffer = new Listing[](pageSize);
        uint256 count;
        uint256 i = cursor;

        while (i < total && count < pageSize) {
            Listing memory listing = _listings[_listingIds[i]];
            if (listing.active) {
                buffer[count] = listing;
                ++count;
            }
            ++i;
        }

        listings = new Listing[](count);
        for (uint256 j; j < count; ++j) listings[j] = buffer[j];
        nextCursor = i;
    }

    function marketplaceStats()
        external
        view
        returns (uint256 totalListings, uint256 activeListings, uint256 totalSales, uint256 totalVolume)
    {
        return (_listingIds.length, _activeListings, _totalSales, _totalVolume);
    }

    function onERC721Received(address, address from, uint256 tokenId, bytes calldata)
        external
        view
        override
        returns (bytes4)
    {
        if (msg.sender != _expectedNftContract || from != _expectedFrom || tokenId != _expectedTokenId) {
            revert UnexpectedNFTTransfer();
        }
        return IERC721Receiver.onERC721Received.selector;
    }

    function _getExistingListing(uint256 listingId) private view returns (Listing storage listing) {
        listing = _listings[listingId];
        if (listing.id == 0) revert ListingNotFound();
    }

    function _clearExpectedTransfer() private {
        _expectedNftContract = address(0);
        _expectedFrom = address(0);
        _expectedTokenId = 0;
    }
}
