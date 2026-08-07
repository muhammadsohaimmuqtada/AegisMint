# Security Model

AegisMint treats contract state transitions and payment settlement as security-sensitive operations. The goal is not to claim a formal audit; it is to make assumptions and invariants explicit and test the important failure paths.

## Trust boundaries

1. **Wallet** — users authorize transactions through MetaMask.
2. **Frontend** — untrusted for authorization; contracts revalidate ownership, price, seller identity, and state.
3. **Pinata/API routes** — responsible for availability/storage only; IPFS metadata does not determine ownership or listing state.
4. **AegisNFT** — canonical ERC-721 collection.
5. **AegisMarketplace** — canonical listing/payment state machine.
6. **RPC/gateway providers** — may fail or lag; UI must surface errors and never manufacture successful state.

## Core invariants

- Minted metadata URIs must use the `ipfs://` scheme.
- Only the current token owner can list a token.
- Only the configured AegisMint collection can be listed.
- Listing price must be greater than zero.
- One token can have at most one active listing.
- An active listing places the token in marketplace escrow.
- Only the listing seller can cancel it.
- A cancelled or sold listing cannot be purchased.
- A seller cannot purchase their own listing.
- Purchase value must equal the listing price exactly.
- State is closed before external sale interactions.
- A successful purchase transfers the NFT to the buyer exactly once.
- Marketplace fees cannot exceed `MAX_FEE_BPS` (10%).
- Each listing snapshots its fee BPS so later admin fee changes cannot alter an existing seller’s sale terms.
- Fee withdrawals cannot consume deferred seller proceeds.
- Unsolicited `safeTransferFrom` calls into the marketplace are rejected.

## Defensive controls

### Reentrancy

Listing, purchase, cancellation, proceeds withdrawal, and fee withdrawal use `ReentrancyGuard`. Purchase state is updated before external transfers.

### Arbitrary NFT contract boundary

The marketplace stores `supportedNftContract` immutably at deployment and rejects other contracts. This avoids treating arbitrary user-supplied contracts as trustworthy ERC-721 implementations during the payment path.

### Seller payout denial-of-service

A seller may be a contract whose `receive()` deliberately reverts. Reverting the entire purchase would allow the seller to create an unbuyable listing. AegisMint instead credits `pendingProceeds[seller]`, completes the NFT transfer, and allows the seller contract to withdraw the deferred balance to a chosen recipient address.

### IPFS upload boundary

The Pinata JWT remains server-side. The browser receives a short-lived signed upload URL only after the API route validates the declared file name, size, and MIME type. Signed asset uploads are limited to 20 MB and an image allowlist (PNG, JPEG, WEBP, GIF). Metadata is independently validated server-side before being pinned, including bounded name/description/attributes, a valid creator address, and a direct `ipfs://CID` image URI.

### Secret management

- `SEPOLIA_PRIVATE_KEY`, `ETHERSCAN_API_KEY`, and `PINATA_JWT` are server/deployment secrets.
- No secret variable is prefixed `NEXT_PUBLIC_`.
- `.env*` files are ignored except examples.
- The repository contains placeholders only.
- Deployment preflight validates the Sepolia chain, private-key format, wallet balance, and required variables without printing the private key.

## Dependency risk posture

Dependency security is treated separately for deployable runtime code and local development tooling.

- The web application was upgraded from Next.js 16.2.12 to 16.3.0 after `npm audit` identified high-severity advisories through Next.js transitive dependencies. The locked web graph must pass `npm audit --audit-level=high` and the production Next.js build.
- The root Hardhat package contains development dependencies only; it is not shipped as a web/runtime application. The current Hardhat Ethers+Mocha toolbox graph retains advisories in transitive test/verification dependencies, including `serialize-javascript` and legacy `@ethersproject/*` paths. npm cannot remove all of them through a compatible non-breaking lockfile fix at this time.
- A forced transitive major override is intentionally not used simply to make an audit counter read zero. Any future toolbox/plugin upgrade must still pass Solidity compilation, all contract tests, local deployment, deployment-artifact validation, and ABI export.

This is a documented residual **development-toolchain** risk, not a claim that the advisories are fixed or irrelevant.

## Test categories

- Happy-path mint/list/buy/cancel/resell.
- Unauthorized actor tests.
- Invalid value and boundary tests.
- Duplicate/stale state tests.
- Unsupported token-contract test.
- Unsolicited NFT custody test.
- Fee-accounting tests.
- Malicious seller payout test.

## Known limitation: unsafe ERC-721 transfer

ERC-721 `transferFrom` does not call `onERC721Received`. Like any receiving contract, AegisMarketplace cannot reject an unsafe transfer before it occurs. The supported user flow is `createListing`, which uses `safeTransferFrom` and a guarded receiver sentinel. This limitation is documented rather than hidden.

## Audit statement

This project is security-oriented and extensively tested, but it is **not a third-party audited mainnet protocol**. Sepolia is the intended deployment for the assignment.
