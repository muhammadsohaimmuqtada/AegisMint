"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { decodeEventLog } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { contractsConfigured, NFT_ADDRESS, nftAbi } from "@/lib/contracts";
import { TransactionStatus, type TransactionStage } from "./TransactionStatus";

const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_ATTRIBUTES = 20;
const ALLOWED_ASSET_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function CreateNFTForm() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [traits, setTraits] = useState("Category: Digital Art");
  const [stage, setStage] = useState<TransactionStage>("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [message, setMessage] = useState("");
  const [mintedToken, setMintedToken] = useState<bigint>();

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const assetIsValid = Boolean(
    file && file.size > 0 && file.size <= MAX_ASSET_BYTES && ALLOWED_ASSET_TYPES.has(file.type),
  );

  const parsedAttributes = useMemo(() => parseAttributes(traits), [traits]);
  const attributesAreValid = parsedAttributes.error === "";

  const canSubmit = useMemo(
    () => Boolean(
      assetIsValid &&
      attributesAreValid &&
      name.trim() &&
      description.trim() &&
      isConnected &&
      chainId === sepolia.id &&
      contractsConfigured
    ),
    [assetIsValid, attributesAreValid, name, description, isConnected, chainId],
  );

  const busy = !["idle", "confirmed", "error"].includes(stage);

  function markEdited() {
    if (!busy && stage !== "idle") {
      setStage("idle");
      setHash(undefined);
      setMintedToken(undefined);
      setMessage("");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !address || !publicClient || !canSubmit) return;

    setHash(undefined);
    setMintedToken(undefined);
    setMessage("");

    try {
      setStage("uploading-asset");
      if (file.size > MAX_ASSET_BYTES) throw new Error("File exceeds the 20 MB upload limit.");
      if (!ALLOWED_ASSET_TYPES.has(file.type)) throw new Error("Asset must be PNG, JPG, WEBP, or GIF.");
      if (parsedAttributes.error) throw new Error(parsedAttributes.error);

      const authorizationResponse = await fetch("/api/ipfs/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
      });
      const authorization = await safeJson<{ url?: string; error?: string }>(authorizationResponse);
      if (!authorizationResponse.ok || !authorization?.url) {
        throw new Error(authorization?.error || "Could not authorize the IPFS asset upload.");
      }

      const assetData = new FormData();
      assetData.set("file", file);
      assetData.set("network", "public");
      const assetResponse = await fetch(authorization.url, { method: "POST", body: assetData });
      const assetPayload = await safeJson<{ cid?: string; data?: { cid?: string }; error?: string }>(assetResponse);
      const assetCid = assetPayload?.cid ?? assetPayload?.data?.cid;
      if (!assetResponse.ok || !assetCid) throw new Error(assetPayload?.error || "Asset upload to IPFS failed.");
      const assetUri = `ipfs://${assetCid}`;

      setStage("uploading-metadata");
      const metadataResponse = await fetch("/api/ipfs/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          image: assetUri,
          attributes: parsedAttributes.items,
          creator: address,
        }),
      });
      const metadata = await safeJson<{ cid?: string; uri?: string; error?: string }>(metadataResponse);
      if (!metadataResponse.ok || !metadata?.uri) {
        throw new Error(metadata?.error || "Metadata upload to IPFS failed.");
      }

      setStage("awaiting-wallet");
      setMessage("Confirm the ERC-721 mint in your wallet.");
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
      setMessage("Mint transaction submitted. Waiting for Sepolia confirmation.");

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: nftAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "NFTMinted") {
            setMintedToken(decoded.args.tokenId);
            break;
          }
        } catch {
          // Receipt can contain logs from unrelated contracts.
        }
      }

      setStage("confirmed");
      setMessage("Asset and metadata are pinned to IPFS, and the metadata URI is stored on-chain.");
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Minting failed.");
    }
  }

  return (
    <form className="createForm" onSubmit={handleSubmit} noValidate>
      <div className="formGrid">
        <label className={`uploadZone ${previewUrl ? "hasPreview" : ""}`}>
          {previewUrl ? (
            <span className="assetPreview" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" />
              <span className="assetPreviewShade" />
            </span>
          ) : null}
          <span className="uploadZoneContent">
            <span className="eyebrow">NFT asset</span>
            <strong>{file ? file.name : "Choose image asset"}</strong>
            <span>{file ? `${formatBytes(file.size)} · click to replace` : "PNG, JPG, WEBP or GIF · max 20 MB"}</span>
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              markEdited();
            }}
            disabled={busy}
            required
          />
        </label>

        <div className="formFields">
          <label>
            <span>Name <small>{name.length}/80</small></span>
            <input value={name} onChange={(event) => { setName(event.target.value); markEdited(); }} placeholder="Aegis Genesis #1" maxLength={80} autoComplete="off" disabled={busy} required />
          </label>
          <label>
            <span>Description <small>{description.length}/1000</small></span>
            <textarea value={description} onChange={(event) => { setDescription(event.target.value); markEdited(); }} placeholder="Describe the work and its provenance…" maxLength={1000} disabled={busy} required />
          </label>
          <label>
            <span>Attributes <small>one Key: Value per line · max {MAX_ATTRIBUTES}</small></span>
            <textarea value={traits} onChange={(event) => { setTraits(event.target.value); markEdited(); }} placeholder={"Category: Digital Art\nEdition: Genesis"} disabled={busy} />
          </label>
          {parsedAttributes.error ? <p className="fieldError">{parsedAttributes.error}</p> : <p className="fieldHelp">Values may contain colons; only the first colon separates the key from its value.</p>}
        </div>
      </div>

      {file && !assetIsValid ? <p className="formHint warningText">Choose a PNG, JPG, WEBP, or GIF no larger than 20 MB.</p> : null}

      <div className="mintSummary">
        <div><span>Storage</span><strong>Pinata / IPFS</strong></div>
        <div><span>Token standard</span><strong>ERC-721</strong></div>
        <div><span>Network</span><strong>Ethereum Sepolia</strong></div>
      </div>

      <div className="mintActionRow">
        <div className="mintReadiness" aria-live="polite">
          {!isConnected ? <p>Connect a wallet to mint.</p> : null}
          {isConnected && chainId !== sepolia.id ? <p className="warningText">Switch your wallet to Ethereum Sepolia.</p> : null}
          {!contractsConfigured ? <p className="warningText">The deployed contract addresses are not configured.</p> : null}
          {isConnected && chainId === sepolia.id && contractsConfigured && !file ? <p>Select an artwork file to continue.</p> : null}
          {isConnected && chainId === sepolia.id && contractsConfigured && file && (!name.trim() || !description.trim()) ? <p>Add a name and description to continue.</p> : null}
          {canSubmit ? <p className="readyText">Ready to publish to IPFS and mint on Sepolia.</p> : null}
        </div>
        <button className="primaryButton mintSubmitButton" type="submit" disabled={!canSubmit || busy}>
          {busy ? "Publishing…" : "Publish & mint"}
        </button>
      </div>

      <TransactionStatus stage={stage} hash={hash} message={message} />
      {mintedToken !== undefined ? (
        <div className="mintSuccessActions">
          <Link className="premiumPrimary" href={`/nft/${mintedToken.toString()}`}>Open work #{mintedToken.toString()} <span>→</span></Link>
          <Link className="premiumSecondary" href="/profile">View portfolio <span>→</span></Link>
        </div>
      ) : null}
    </form>
  );
}

function parseAttributes(value: string) {
  const items: Array<{ trait_type: string; value: string }> = [];
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > MAX_ATTRIBUTES) return { items, error: `Use at most ${MAX_ATTRIBUTES} attributes.` };

  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator <= 0 || separator === line.length - 1) return { items, error: `Invalid attribute “${line}”. Use Key: Value.` };
    const trait = line.slice(0, separator).trim();
    const itemValue = line.slice(separator + 1).trim();
    if (!trait || !itemValue) return { items, error: `Invalid attribute “${line}”. Use Key: Value.` };
    if (trait.length > 80) return { items, error: `Attribute key “${trait.slice(0, 24)}…” exceeds 80 characters.` };
    if (itemValue.length > 160) return { items, error: `The value for “${trait}” exceeds 160 characters.` };
    items.push({ trait_type: trait, value: itemValue });
  }

  return { items, error: "" };
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
