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
if (chain.chainId !== 31_337n && chain.chainId !== 11_155_111n) {
  throw new Error(`Refusing to deploy AegisMint to unsupported chain ${chain.chainId}`);
}

const deployerBalance = await ethers.provider.getBalance(deployer.address);
if (chain.chainId === 11_155_111n && deployerBalance === 0n) {
  throw new Error(`Deployment wallet ${deployer.address} has no Sepolia ETH`);
}

console.log(`Deploying AegisMint with ${deployer.address} on chain ${chain.chainId}`);
console.log("Deployer balance:", `${ethers.formatEther(deployerBalance)} ETH`);

const nft = await ethers.deployContract("AegisNFT");
await nft.waitForDeployment();

const nftAddress = await nft.getAddress();
const marketplace = await ethers.deployContract("AegisMarketplace", [
  deployer.address,
  nftAddress,
  feeBps,
]);
await marketplace.waitForDeployment();

const marketplaceAddress = await marketplace.getAddress();
const [nftCode, marketplaceCode] = await Promise.all([
  ethers.provider.getCode(nftAddress),
  ethers.provider.getCode(marketplaceAddress),
]);
if (nftCode === "0x" || marketplaceCode === "0x") {
  throw new Error("Deployment finished without runtime bytecode at one or more contract addresses");
}

const nftDeployment = nft.deploymentTransaction();
const marketplaceDeployment = marketplace.deploymentTransaction();
const [nftReceipt, marketplaceReceipt] = await Promise.all([
  nftDeployment ? ethers.provider.getTransactionReceipt(nftDeployment.hash) : null,
  marketplaceDeployment ? ethers.provider.getTransactionReceipt(marketplaceDeployment.hash) : null,
]);

const deploymentBlocks = [nftReceipt?.blockNumber, marketplaceReceipt?.blockNumber].filter(
  (block): block is number => block !== undefined && block !== null,
);
const deploymentBlock = deploymentBlocks.length ? Math.min(...deploymentBlocks) : null;

const record = {
  chainId: chain.chainId.toString(),
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  deployerBalanceAtStartWei: deployerBalance.toString(),
  marketplaceFeeBps: feeBps.toString(),
  deploymentBlock,
  contracts: {
    AegisNFT: {
      address: nftAddress,
      transactionHash: nftDeployment?.hash ?? null,
      blockNumber: nftReceipt?.blockNumber ?? null,
    },
    AegisMarketplace: {
      address: marketplaceAddress,
      transactionHash: marketplaceDeployment?.hash ?? null,
      blockNumber: marketplaceReceipt?.blockNumber ?? null,
      constructorArguments: [deployer.address, nftAddress, feeBps.toString()],
    },
  },
};

await mkdir("deployments", { recursive: true });
const recordPath = `deployments/${chain.chainId}.json`;
await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

const frontendEnvPath = `deployments/${chain.chainId}.frontend.env`;
const frontendEnv = [
  `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=${nftAddress}`,
  `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`,
  `NEXT_PUBLIC_DEPLOYMENT_BLOCK=${deploymentBlock ?? 0}`,
  "",
].join("\n");
await writeFile(frontendEnvPath, frontendEnv, "utf8");

console.log("AegisNFT:", nftAddress);
console.log("AegisMarketplace:", marketplaceAddress);
console.log("Marketplace fee (bps):", feeBps.toString());
console.log("Deployment block:", deploymentBlock ?? "unknown");
console.log("Deployment record:", recordPath);
console.log("Frontend env fragment:", frontendEnvPath);
