"use client";

import { FormEvent, useMemo, useState } from "react";
import { decodeEventLog } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { contractsConfigured, NFT_ADDRESS, nftAbi } from "@/lib/contracts";
import { TransactionStatus, type TransactionStage } from "./TransactionStatus";

export function CreateNFTForm() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [traits, setTraits] = useState("Category: Digital Art");
  const [stage, setStage] = useState<TransactionStage>("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [message, setMessage] = useState("");
  const [mintedToken, setMintedToken] = useState<bigint>();

  const canSubmit = useMemo(
    () => Boolean(file && name.trim() && description.trim() && isConnected && chainId === sepolia.id && contractsConfigured),
    [file, name, description, isConnected, chainId],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !address || !publicClient || !canSubmit) return;

    setHash(undefined);
    setMintedToken(undefined);
    setMessage("");

    try {
      setStage("uploading-asset");
      if (file.size > 20 * 1024 * 1024) throw new Error("File exceeds the 20 MB upload limit");

      const authorizationResponse = await fetch("/api/ipfs/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size }),
      });
      const authorization = await authorizationResponse.json() as { url?: string; error?: string };
      if (!authorizationResponse.ok || !authorization.url) {
        throw new Error(authorization.error || "Could not authorize asset upload");
      }

      const assetData = new FormData();
      assetData.set("file", file);
      assetData.set("network", "public");
      const assetResponse = await fetch(authorization.url, { method: "POST", body: assetData });
      const assetPayload = await assetResponse.json() as { cid?: string; data?: { cid?: string }; error?: string };
      const assetCid = assetPayload.cid ?? assetPayload.data?.cid;
      if (!assetResponse.ok || !assetCid) throw new Error(assetPayload.error || "Asset upload failed");
      const asset = { cid: assetCid, uri: `ipfs://${assetCid}` };

      setStage("uploading-metadata");
      const attributes = traits
        .split("\n")
        .map((line) => line.split(":"))
        .filter(([key, value]) => key?.trim() && value?.trim())
        .map(([key, value]) => ({ trait_type: key.trim(), value: value.trim() }));

      const metadataResponse = await fetch("/api/ipfs/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          image: asset.uri,
          attributes,
          creator: address,
        }),
      });
      if (!metadataResponse.ok) throw new Error((await metadataResponse.json()).error || "Metadata upload failed");
      const metadata = (await metadataResponse.json()) as { cid: string; uri: string };

      setStage("awaiting-wallet");
      const txHash = await writeContractAsync({
        address: NFT_ADDRESS,
        abi: nftAbi,
        functionName: "mint",
        args: [metadata.uri],
        chain: sepolia,
        account: address,
      });
      setHash(txHash);
      setStage("pending");

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: nftAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "NFTMinted") {
            setMintedToken(decoded.args.tokenId);
            break;
          }
        } catch {
          // Ignore logs from unrelated contracts.
        }
      }

      setStage("confirmed");
      setMessage("Asset and metadata are pinned to IPFS and the metadata URI is now stored on-chain.");
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Minting failed");
    }
  }

  return (
    <form className="createForm" onSubmit={handleSubmit}>
      <div className="formGrid">
        <label className="uploadZone">
          <span className="eyebrow">NFT asset</span>
          <strong>{file ? file.name : "Choose image or digital asset"}</strong>
          <span>PNG, JPG, GIF, SVG or other file up to 20 MB</span>
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </label>

        <div className="formFields">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Aegis Genesis #1" maxLength={80} required />
          </label>
          <label>
            <span>Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the asset and its provenance…" maxLength={1000} required />
          </label>
          <label>
            <span>Attributes <small>one Key: Value per line</small></span>
            <textarea value={traits} onChange={(event) => setTraits(event.target.value)} placeholder={"Category: Digital Art\nEdition: Genesis"} />
          </label>
        </div>
      </div>

      <div className="mintSummary">
        <div>
          <span>Storage</span>
          <strong>Pinata / IPFS</strong>
        </div>
        <div>
          <span>Token standard</span>
          <strong>ERC-721</strong>
        </div>
        <div>
          <span>Network</span>
          <strong>Sepolia</strong>
        </div>
      </div>

      {!isConnected ? <p className="formHint">Connect MetaMask to mint.</p> : null}
      {isConnected && chainId !== sepolia.id ? <p className="formHint warningText">Switch your wallet to Sepolia.</p> : null}
      {!contractsConfigured ? <p className="formHint warningText">Contract addresses must be configured after deployment.</p> : null}

      <button className="primaryButton fullButton" type="submit" disabled={!canSubmit || !["idle", "confirmed", "error"].includes(stage)}>
        {stage === "idle" || stage === "confirmed" || stage === "error" ? "Upload & mint NFT" : "Processing…"}
      </button>

      <TransactionStatus stage={stage} hash={hash} message={message} />
      {mintedToken !== undefined ? (
        <a className="successLink" href={`/nft/${mintedToken.toString()}`}>Open NFT #{mintedToken.toString()} →</a>
      ) : null}
    </form>
  );
}
