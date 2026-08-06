# Demo Video Script

Target: concise, technical, and evidence-driven. Show real state transitions rather than narrating static UI.

## 1. Opening

- Introduce **AegisMint**, a security-first ERC-721 marketplace on Sepolia.
- Show the architecture diagram in the README.
- Briefly identify AegisNFT, AegisMarketplace, Next.js/wagmi/viem, Pinata IPFS, MetaMask, Hardhat, Etherscan, and Vercel.

## 2. Mint

- Connect Wallet A on Sepolia.
- Open Create.
- Select an image/digital asset.
- Show asset upload completing.
- Show metadata creation/upload completing.
- Point out `ipfs://CID` rather than a centralized URL.
- Confirm MetaMask mint transaction.
- Open the transaction on Etherscan.

## 3. Trust Center

- Open the newly minted NFT.
- Show creator, current owner, token ID, metadata URI, asset URI, NFT contract, and marketplace contract.
- Open IPFS metadata and Etherscan contract links.

## 4. Listing

- Enter a fixed ETH price.
- Approve marketplace custody.
- List the NFT.
- Explain escrow and why it prevents stale listings.
- Show the listing event / transfer on Etherscan.

## 5. Purchase from another wallet

- Switch to Wallet B.
- Open Explore and the NFT.
- Buy at the exact listed price.
- Show pending and confirmed transaction states.
- Verify ownership changed to Wallet B.
- Show seller payment and ERC-721 transfer on Etherscan.

## 6. Resale

- From Wallet B dashboard, open the purchased NFT.
- Relist at a different price.
- Purchase from Wallet A or a third wallet.
- Show provenance timeline containing the complete lifecycle.

## 7. Security demonstration

Run the Hardhat test suite and highlight negative-path tests:

- non-owner listing rejected
- foreign NFT contract rejected
- missing approval rejected
- unauthorized cancellation rejected
- wrong ETH amount rejected
- double purchase rejected
- malicious/reverting seller cannot DoS a valid sale

This is the project's differentiating segment.

## 8. Engineering evidence

- Show contract separation.
- Show custom errors/events.
- Show tests and coverage.
- Show server-only Pinata API route and `.env.example` without secrets.
- Show verified Sepolia source code.
- Show live Vercel deployment.

## 9. Closing

Summarize the core learning: ERC-721 lifecycle, escrow marketplace state transitions, payment settlement, IPFS metadata, wallet transaction UX, event-driven provenance, testing, and deployment.
