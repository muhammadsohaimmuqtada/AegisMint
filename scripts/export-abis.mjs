import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const targets = ["AegisNFT", "AegisMarketplace"];

await mkdir(path.join(root, "web", "abi"), { recursive: true });

for (const contractName of targets) {
  const artifactPath = path.join(root, "artifacts", "contracts", `${contractName}.sol`, `${contractName}.json`);
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const outputPath = path.join(root, "web", "abi", `${contractName}.json`);
  await writeFile(outputPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);
  console.log(`Exported ${contractName} ABI -> ${path.relative(root, outputPath)}`);
}
