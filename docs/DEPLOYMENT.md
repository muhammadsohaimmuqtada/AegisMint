# Deployment and Verification

## 1. Configure secrets

Copy `.env.example` to `.env` and set:

```text
SEPOLIA_RPC_URL=...
SEPOLIA_PRIVATE_KEY=...
ETHERSCAN_API_KEY=...
MARKETPLACE_FEE_BPS=250
```

Use a dedicated Sepolia-only deployment wallet. Never commit `.env`, private keys, Pinata JWTs, or provider secrets.

## 2. Deterministic install and local verification

The repository commits root and web lockfiles. Fresh clones should use the lockfile-backed install command:

```bash
npm run install:all
npm run compile
npm test
npm run web:build
```

`npm run install:all` runs `npm ci` for both the Hardhat project and the Next.js app. Do not deploy if compilation, tests, or the production web build fails.

## 3. Sepolia preflight

Before spending testnet ETH, verify that the selected network, deployment key, RPC connection, wallet balance, fee configuration, and Etherscan configuration are sane:

```bash
npm run deploy:preflight
```

The preflight refuses to continue if the selected chain is not Sepolia, the private key format is invalid, required deployment variables are missing, or the deployment wallet has zero Sepolia ETH. It never prints the private key.

## 4. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

The deployment script only permits the local Hardhat chain or Sepolia. It verifies that runtime bytecode exists at both deployed addresses and writes:

- `deployments/<chainId>.json` — addresses, deployment transaction hashes, deployment blocks, constructor arguments, deployer, and marketplace fee
- `deployments/<chainId>.frontend.env` — non-secret NFT address, marketplace address, and deployment block ready to copy into the frontend environment

## 5. Export ABIs

```bash
npm run abi:export
```

This writes compiler-generated ABI JSON files into `web/abi/`.

## 6. Verify on Etherscan

NFT has no constructor arguments:

```bash
npx hardhat verify --network sepolia <NFT_ADDRESS>
```

Marketplace constructor arguments are owner, supported NFT contract, and fee BPS:

```bash
npx hardhat verify --network sepolia \
  <MARKETPLACE_ADDRESS> \
  <OWNER_ADDRESS> \
  <NFT_ADDRESS> \
  250
```

## 7. Configure Pinata and the web app

Create `web/.env.local`:

```text
NEXT_PUBLIC_SEPOLIA_RPC_URL=...
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_DEPLOYMENT_BLOCK=...
NEXT_PUBLIC_PINATA_GATEWAY=your-gateway.mypinata.cloud
PINATA_JWT=...
PINATA_GATEWAY=your-gateway.mypinata.cloud
```

`PINATA_JWT` is server-only. The browser requests a short-lived signed upload URL from AegisMint, then uploads directly to Pinata. Signed URLs enforce the declared file size and an allowlist of PNG, JPEG, WEBP, and GIF MIME types. Metadata is uploaded separately by the server and the ERC-721 stores the resulting `ipfs://CID` URI.

Then:

```bash
npm run web:build
npm run web:dev
```

## 8. Vercel

Import the GitHub repository, set the Root Directory to `web`, and add the same web environment variables in Vercel. `PINATA_JWT` and `PINATA_GATEWAY` are server-side settings; only values prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## 9. Two-wallet acceptance test

Use two independent MetaMask accounts.

1. Wallet A mints an NFT.
2. Confirm `tokenURI` resolves to IPFS metadata and its image uses `ipfs://CID`.
3. Wallet A lists the NFT.
4. Confirm NFT custody moved to AegisMarketplace.
5. Wallet B purchases it.
6. Confirm `ownerOf(tokenId) == Wallet B`.
7. Confirm seller proceeds and marketplace fee accounting.
8. Wallet B relists at a new price.
9. Wallet A (or a third wallet) purchases it.
10. Verify mint/list/sale/transfer events on Sepolia Etherscan.
11. Verify the Trust Center and provenance timeline match on-chain history.

## 10. Final repository update

Replace all `TBD` deployment entries in the root README with real addresses/links before submission.
