import "dotenv/config";
import { network } from "hardhat";

const required = ["SEPOLIA_RPC_URL", "SEPOLIA_PRIVATE_KEY"] as const;
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Missing required deployment environment variables: ${missing.join(", ")}`);
}

const privateKey = process.env.SEPOLIA_PRIVATE_KEY!;
if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  throw new Error("SEPOLIA_PRIVATE_KEY must be a 32-byte hex private key prefixed with 0x");
}

const { ethers } = await network.create();
const [deployer] = await ethers.getSigners();
const chain = await ethers.provider.getNetwork();

if (chain.chainId !== 11_155_111n) {
  throw new Error(`Deployment preflight expected Sepolia (11155111), received chain ${chain.chainId}`);
}

const [balance, blockNumber] = await Promise.all([
  ethers.provider.getBalance(deployer.address),
  ethers.provider.getBlockNumber(),
]);

if (balance === 0n) {
  throw new Error(`Deployment wallet ${deployer.address} has no Sepolia ETH`);
}

console.log("AegisMint Sepolia preflight: PASS");
console.log("Chain ID:", chain.chainId.toString());
console.log("Latest block:", blockNumber);
console.log("Deployer:", deployer.address);
console.log("Balance:", `${ethers.formatEther(balance)} ETH`);
console.log("Marketplace fee (bps):", process.env.MARKETPLACE_FEE_BPS ?? "250");
console.log("Etherscan verification key:", process.env.ETHERSCAN_API_KEY?.trim() ? "configured" : "missing (deployment works, verification will not)");
