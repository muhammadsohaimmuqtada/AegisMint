import type { Address } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const NFT_ADDRESS = (process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || ZERO_ADDRESS) as Address;
export const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS || ZERO_ADDRESS) as Address;

export const contractsConfigured = NFT_ADDRESS !== ZERO_ADDRESS && MARKETPLACE_ADDRESS !== ZERO_ADDRESS;

export const nftAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "creatorOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "NFTMinted",
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "tokenURI", type: "string" },
    ],
  },
] as const;

const listingComponents = [
  { name: "id", type: "uint256" },
  { name: "nftContract", type: "address" },
  { name: "tokenId", type: "uint256" },
  { name: "seller", type: "address" },
  { name: "feeBps", type: "uint96" },
  { name: "buyer", type: "address" },
  { name: "price", type: "uint256" },
  { name: "active", type: "bool" },
  { name: "sold", type: "bool" },
  { name: "listedAt", type: "uint64" },
  { name: "closedAt", type: "uint64" },
] as const;

export const marketplaceAbi = [
  {
    type: "function",
    name: "activeListingByAsset",
    stateMutability: "view",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "createListing",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "buyNFT",
    stateMutability: "payable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelListing",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: listingComponents }],
  },
  {
    type: "function",
    name: "getActiveListings",
    stateMutability: "view",
    inputs: [
      { name: "cursor", type: "uint256" },
      { name: "pageSize", type: "uint256" },
    ],
    outputs: [
      { name: "listings", type: "tuple[]", components: listingComponents },
      { name: "nextCursor", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "marketplaceStats",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "totalListings", type: "uint256" },
      { name: "activeListings", type: "uint256" },
      { name: "totalSales", type: "uint256" },
      { name: "totalVolume", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "marketplaceFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
  },
  {
    type: "event",
    name: "NFTListed",
    anonymous: false,
    inputs: [
      { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "nftContract", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "seller", type: "address" },
      { indexed: false, name: "price", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "NFTSold",
    anonymous: false,
    inputs: [
      { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "nftContract", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "seller", type: "address" },
      { indexed: false, name: "buyer", type: "address" },
      { indexed: false, name: "price", type: "uint256" },
      { indexed: false, name: "marketplaceFee", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ListingCancelled",
    anonymous: false,
    inputs: [
      { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "nftContract", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "seller", type: "address" },
    ],
  },
] as const;

export type Listing = {
  id: bigint;
  nftContract: Address;
  tokenId: bigint;
  seller: Address;
  feeBps: bigint;
  buyer: Address;
  price: bigint;
  active: boolean;
  sold: boolean;
  listedAt: bigint;
  closedAt: bigint;
};
