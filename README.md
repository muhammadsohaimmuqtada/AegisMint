# AegisMint

**A security-first ERC-721 marketplace built for Ethereum Sepolia.**

AegisMint is a full NFT lifecycle application: creators upload immutable assets and metadata to IPFS, mint ERC-721 tokens, list them through an escrow marketplace, sell to another wallet, cancel listings, and resell purchased NFTs. The web application reconstructs ownership, listings, purchases, sales, and provenance from live blockchain state and events rather than seeded records.

> Status: active development. Local contracts, tests, frontend, IPFS API routes, deployment scripts, and documentation are present. Sepolia addresses and the Vercel URL are intentionally left blank until final deployment.

## Why AegisMint is different

- **Security-first marketplace design** — escrow listings, reentrancy protection, custom errors, authorization checks, fee caps, exact-payment enforcement, and unsolicited safe-transfer rejection.
- **Canonical collection boundary** — the marketplace only accepts the AegisMint ERC-721 collection configured at deployment, reducing the attack surface from arbitrary/malicious token contracts.
- **Defensive settlement** — a seller contract that rejects ETH cannot permanently block a valid purchase; proceeds are deferred for later withdrawal.
- **On-chain provenance** — NFT pages reconstruct mint, transfer, listing, sale, and cancellation history from events.
- **Trust Center** — ownership, IPFS URIs, contract addresses, and explorer links are exposed for independent verification.
- **No hardcoded NFT inventory** — marketplace and dashboard data come from contract reads and event logs.
- **Server-side Pinata credentials** — the browser never receives the Pinata JWT.

## Stack

| Layer | Technology |
| --- | --- |
| NFT standard | ERC-721 / OpenZeppelin Contracts |
| Smart-contract tooling | Solidity + Hardhat 3 |
| Chain | Ethereum Sepolia |
| Wallet / chain client | MetaMask + wagmi + viem |
| Frontend | Next.js + React + TypeScript |
| NFT storage | Pinata IPFS |
| Contract verification | Etherscan |
| Hosting | Vercel |

## Architecture

```text
Creator / Buyer
      │
      ▼
 MetaMask (Sepolia)
      │
      ├──────────────────────────────┐
      │                              │
      ▼                              ▼
Next.js / wagmi                 Pinata API routes
      │                              │
      │                              ▼
      │                         Pinata / IPFS
      │                        image + metadata
      ▼
AegisNFT (ERC-721)
      │
      │ approve + escrow
      ▼
AegisMarketplace
      ├── listings
      ├── purchases
      ├── cancellation
      ├── resale
      ├── fees
      └── deferred proceeds
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/SECURITY.md`](docs/SECURITY.md) for the trust model and invariants.

## Repository layout

```text
.
├── contracts/
│   ├── AegisNFT.sol
│   ├── AegisMarketplace.sol
│   └── RevertingSeller.sol          # adversarial test helper
├── test/
│   └── AegisMint.test.ts
├── scripts/
│   ├── deploy.ts
│   └── export-abis.mjs
├── ignition/modules/
│   └── AegisMint.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   └── DEMO_SCRIPT.md
└── web/
    ├── app/
    ├── components/
    ├── lib/
    └── abi/
```

## Marketplace lifecycle

```text
OWNED ──list()──> ESCROWED / LISTED ──buy()──> SOLD / OWNED BY BUYER
  ▲                        │                          │
  └──── cancel() ──────────┘                          └── list() → RESALE
```

A listing cannot be purchased after sale/cancellation, a token cannot have two active listings, and only the original seller can cancel its active listing.

## IPFS flow

1. User selects an NFT asset.
2. `POST /api/ipfs/upload-url` creates a short-lived, size-limited Pinata upload URL using the server-only JWT; the browser uploads the asset directly to Pinata.
3. The client creates metadata containing `name`, `description`, `image: ipfs://CID`, attributes, and creator address.
4. `POST /api/ipfs/metadata` uploads the JSON to Pinata.
5. The ERC-721 contract stores the resulting `ipfs://METADATA_CID` as `tokenURI`.

The Pinata JWT is **never** prefixed with `NEXT_PUBLIC_` and must never be committed.

## Local setup

Requirements: Node.js 22+, npm, and MetaMask for browser flows.

```bash
cp .env.example .env
cp web/.env.example web/.env.local
npm install
npm --prefix web install
npm run compile
npm test
npm run abi:export
npm run web:dev
```

The frontend runs at `http://localhost:3000` by default.

## Environment variables

Root `.env`:

```text
SEPOLIA_RPC_URL=
SEPOLIA_PRIVATE_KEY=
ETHERSCAN_API_KEY=
MARKETPLACE_FEE_BPS=250
```

`web/.env.local`:

```text
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=
NEXT_PUBLIC_DEPLOYMENT_BLOCK=
NEXT_PUBLIC_PINATA_GATEWAY=
PINATA_JWT=
PINATA_GATEWAY=
```

Never commit `.env` or `.env.local`.

## Testing

```bash
npm test
npm run test:coverage
```

The test suite covers minting, creator provenance, listing escrow, missing approvals, foreign NFT rejection, unauthorized listing/cancellation, exact payment, double purchase, fee accounting, resale, unsolicited NFT transfers, pagination, and adversarial seller payout behavior.

## Sepolia deployment

```bash
npm run compile
npm test
npm run deploy:sepolia
npm run abi:export
```

The deploy script also writes a non-secret `deployments/<chainId>.json` record containing the addresses, transaction hashes, constructor arguments, and deployment block. Configure the frontend from that record. Full instructions, verification commands, and the two-wallet acceptance test are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Deployment record

| Item | Value |
| --- | --- |
| Network | Ethereum Sepolia |
| AegisNFT | `TBD` |
| AegisMarketplace | `TBD` |
| NFT Etherscan | `TBD` |
| Marketplace Etherscan | `TBD` |
| Vercel app | `TBD` |
| Demo video | `TBD` |
| LinkedIn post | `TBD` |

## Known limitations

- AegisMint intentionally supports one canonical ERC-721 collection rather than arbitrary third-party NFT contracts.
- The frontend reconstructs activity from RPC logs. This is appropriate for the Sepolia assignment dataset; a high-volume mainnet deployment should use an event indexer.
- ERC-721's unsafe `transferFrom` can send an NFT directly to any contract without invoking `onERC721Received`; users must list through the marketplace flow. AegisMint rejects unsolicited **safe** transfers.
- The current sale model is fixed-price only; auctions and offers are intentionally out of scope to keep the required flow small and auditable.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Deployment and verification](docs/DEPLOYMENT.md)
- [Demo script](docs/DEMO_SCRIPT.md)

## License

MIT
