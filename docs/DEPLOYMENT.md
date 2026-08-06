# Deployment and Verification

## 1. Configure secrets

Copy `.env.example` to `.env` and set:

```text
SEPOLIA_RPC_URL=...
SEPOLIA_PRIVATE_KEY=...
ETHERSCAN_API_KEY=...
MARKETPLACE_FEE_BPS=250
```

Use a dedicated Sepolia wallet. Never commit the file.

## 2. Install and test

```bash
npm install
npm --prefix web install
npm run compile
npm test
npm run test:coverage
```

Do not deploy if tests fail.

## 3. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

The deployment script writes `deployments/<chainId>.json` with:

- deployer address
- AegisNFT address and deployment transaction hash
- AegisMarketplace address, constructor arguments, and deployment transaction hash
- deployment block
- snapshotted marketplace fee

## 4. Export ABIs

```bash
npm run abi:export
```

This writes compiler-generated ABI JSON files into `web/abi/`.

## 5. Verify on Etherscan

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

## 6. Configure the web app

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

Then:

```bash
npm run web:build
npm run web:dev
```

## 7. Vercel

Import the GitHub repository, set the Root Directory to `web`, and add the same web environment variables in Vercel. `PINATA_JWT` must remain server-only.

## 8. Two-wallet acceptance test

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

## 9. Final repository update

Replace all `TBD` deployment entries in the root README with real addresses/links before submission.
