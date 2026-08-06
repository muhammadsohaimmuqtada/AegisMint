# AegisMint Architecture

## Design goals

AegisMint optimizes for correctness, auditability, and a clear end-to-end NFT lifecycle rather than feature count. Smart contracts are the source of truth for token ownership, listings, sale status, prices, and settlement. IPFS is the source of truth for immutable NFT content and metadata. The frontend is a presentation/indexing layer.

## Components

### `AegisNFT.sol`

Responsibilities:

- ERC-721 ownership and transfers.
- Permissionless NFT minting.
- `ipfs://...` metadata URI storage.
- Immutable creator provenance through `creatorOf(tokenId)`.
- Standard ERC-721 `Transfer` events plus `NFTMinted`.

Current ownership is never copied into metadata because ownership is mutable. `ownerOf(tokenId)` is canonical.

### `AegisMarketplace.sol`

Responsibilities:

- Fixed-price escrow listings.
- Canonical-collection enforcement.
- Exact-price purchases.
- Listing cancellation.
- Resale through the same listing flow.
- Fee accounting.
- Deferred seller proceeds when direct payout fails.
- Marketplace statistics.
- Cursor-based active listing reads.

The marketplace receives the NFT at listing time. This removes stale-listing states caused by owners transferring tokens or revoking approvals after listing.

### Next.js application

Responsibilities:

- Wallet connection and Sepolia network status.
- NFT creation and IPFS upload flow.
- Contract transaction lifecycle UI.
- Active marketplace discovery.
- NFT detail and Trust Center.
- Wallet dashboard for owned/listed/purchased/sold NFTs.
- Event-derived provenance timeline.

No seeded NFT records are used as marketplace truth.

### Pinata integration

The Pinata JWT exists only in server runtime environment variables. The server issues a short-lived, size-limited signed URL for asset uploads so the Pinata JWT stays private and large assets do not traverse the Next.js request body. Metadata JSON remains a small server-side upload. Both flows return CIDs/IPFS URIs.

## Data ownership

| Data | Canonical source |
| --- | --- |
| Current NFT owner | `AegisNFT.ownerOf` |
| NFT metadata URI | `AegisNFT.tokenURI` |
| Creator | `AegisNFT.creatorOf` |
| Listing price/status | `AegisMarketplace` |
| Sale/cancel history | Marketplace events |
| Ownership history | ERC-721 `Transfer` events |
| Image / metadata body | IPFS |
| Dashboard history | Contract events + live ownership reads |

## Sale sequence

```text
Seller owns token
      │
      ├─ approve marketplace
      │
      └─ createListing()
             │
             ▼
      Marketplace escrow
             │
        buyer buyNFT()
             │
      checks + state effects
             │
             ├─ NFT → buyer
             ├─ ETH → seller (or deferred)
             └─ fee → accrued fees
```

## Why escrow

A non-custodial listing can become stale if the seller transfers the NFT or revokes approval before purchase. Escrow makes `listing.active == true` correspond to a token held by the marketplace contract, reducing state ambiguity for this project's fixed-price model.
