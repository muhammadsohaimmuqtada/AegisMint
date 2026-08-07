import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { network } from "hardhat";

const { ethers } = await network.create();
const [deployer] = await ethers.getSigners();
const feeBps = BigInt(process.env.MARKETPLACE_FEE_BPS ?? "250");

if (feeBps < 0n || feeBps > 1_000n) {
  throw new Error("MARKETPLACE_FEE_BPS must be between 0 and 1000");
}

const chain = await ethers.provider.getNetwork();
console.log(`Deploying AegisMint with ${deployer.address} on chain ${chain.chainId}`);

const nft = await ethers.deployContract("AegisNFT");
await nft.waitForDeployment();

const marketplace = await ethers.deployContract("AegisMarketplace", [
  deployer.address,
  await nft.getAddress(),
  feeBps,
]);
await marketplace.waitForDeployment();

const nftAddress = await nft.getAddress();
const marketplaceAddress = await marketplace.getAddress();
const nftDeployment = nft.deploymentTransaction();
const marketplaceDeployment = marketplace.deploymentTransaction();
const marketplaceReceipt = marketplaceDeployment
  ? await ethers.provider.getTransactionReceipt(marketplaceDeployment.hash)
  : null;

const record = {
  chainId: chain.chainId.toString(),
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  marketplaceFeeBps: feeBps.toString(),
  deploymentBlock: marketplaceReceipt?.blockNumber ?? null,
  contracts: {
    AegisNFT: {
      address: nftAddress,
      transactionHash: nftDeployment?.hash ?? null,
    },
    AegisMarketplace: {
      address: marketplaceAddress,
      transactionHash: marketplaceDeployment?.hash ?? null,
      constructorArguments: [deployer.address, nftAddress, feeBps.toString()],
    },
  },
};

await mkdir("deployments", { recursive: true });
const recordPath = `deployments/${chain.chainId}.json`;
await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

console.log("AegisNFT:", nftAddress);
console.log("AegisMarketplace:", marketplaceAddress);
console.log("Marketplace fee (bps):", feeBps.toString());
console.log("Deployment block:", marketplaceReceipt?.blockNumber ?? "unknown");
console.log("Deployment record:", recordPath);
