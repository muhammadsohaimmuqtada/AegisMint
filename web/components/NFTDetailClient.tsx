"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  MARKETPLACE_ADDRESS,
  NFT_ADDRESS,
  contractsConfigured,
  marketplaceAbi,
  nftAbi,
  type Listing,
} from "@/lib/contracts";
import { ipfsToHttp, shortAddress } from "@/lib/ipfs";
import type { NFTMetadata } from "./NFTCard";
import { ProvenancePanel } from "./ProvenancePanel";
import { TransactionStatus, type TransactionStage } from "./TransactionStatus";

export function NFTDetailClient({ tokenId }: { tokenId: bigint }) {
  const { address, chainId, isConnected } = useAccount();
  const client = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [price, setPrice] = useState("0.01");
  const [stage, setStage] = useState<TransactionStage>("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [message, setMessage] = useState("");

  const tokenUriQuery = useReadContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "tokenURI", args: [tokenId], query: { enabled: contractsConfigured } });
  const ownerQuery = useReadContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "ownerOf", args: [tokenId], query: { enabled: contractsConfigured } });
  const creatorQuery = useReadContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "creatorOf", args: [tokenId], query: { enabled: contractsConfigured } });
  const listingIdQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "activeListingByAsset",
    args: [NFT_ADDRESS, tokenId],
    query: { enabled: contractsConfigured, refetchInterval: 10_000 },
  });
  const listingId = listingIdQuery.data ?? 0n;
  const listingQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "getListing",
    args: [listingId],
    query: { enabled: contractsConfigured && listingId > 0n },
  });
  const listing = listingQuery.data as Listing | undefined;

  useEffect(() => {
    if (!tokenUriQuery.data) return;
    fetch(ipfsToHttp(tokenUriQuery.data))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Metadata unavailable")))
      .then(setMetadata)
      .catch(() => setMetadata(null));
  }, [tokenUriQuery.data]);

  const isOwner = useMemo(
    () => Boolean(address && ownerQuery.data && address.toLowerCase() === ownerQuery.data.toLowerCase()),
    [address, ownerQuery.data],
  );
  const isSeller = useMemo(
    () => Boolean(address && listing?.seller && address.toLowerCase() === listing.seller.toLowerCase()),
    [address, listing?.seller],
  );
  const listingFee = listing ? (listing.price * listing.feeBps) / 10_000n : 0n;
  const sellerProceeds = listing ? listing.price - listingFee : 0n;

  async function runTx(label: string, action: () => Promise<`0x${string}`>) {
    if (!client) return;
    try {
      setStage("awaiting-wallet");
      setMessage(label);
      const txHash = await action();
      setHash(txHash);
      setStage("pending");
      await client.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      setStage("confirmed");
      setMessage(`${label} confirmed on Sepolia.`);
      await Promise.all([ownerQuery.refetch(), listingIdQuery.refetch(), listingQuery.refetch()]);
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : `${label} failed`);
    }
  }

  async function listForSale(event: FormEvent) {
    event.preventDefault();
    if (!address || chainId !== sepolia.id) return;
    let wei: bigint;
    try {
      wei = parseEther(price);
      if (wei <= 0n) throw new Error();
    } catch {
      setStage("error");
      setMessage("Enter a valid ETH price greater than zero.");
      return;
    }

    try {
      setStage("awaiting-wallet");
      setMessage("Approve AegisMarketplace to escrow this NFT.");
      const approvalHash = await writeContractAsync({
        address: NFT_ADDRESS,
        abi: nftAbi,
        functionName: "approve",
        args: [MARKETPLACE_ADDRESS, tokenId],
        account: address,
        chain: sepolia,
      });
      setHash(approvalHash);
      setStage("pending");
      if (!client) return;
      await client.waitForTransactionReceipt({ hash: approvalHash, confirmations: 1 });

      setStage("awaiting-wallet");
      setMessage("Approval confirmed. Now confirm the listing transaction.");
      const listingHash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "createListing",
        args: [NFT_ADDRESS, tokenId, wei],
        account: address,
        chain: sepolia,
      });
      setHash(listingHash);
      setStage("pending");
      await client.waitForTransactionReceipt({ hash: listingHash, confirmations: 1 });
      setStage("confirmed");
      setMessage("NFT is now escrowed and listed on AegisMint.");
      await Promise.all([ownerQuery.refetch(), listingIdQuery.refetch()]);
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Listing failed");
    }
  }

  if (!contractsConfigured) {
    return <div className="emptyState"><h3>Deploy contracts first</h3><p>This view becomes live after Sepolia contract addresses are configured.</p></div>;
  }

  if (tokenUriQuery.isPending || ownerQuery.isPending) {
    return <div className="detailSkeleton" />;
  }

  if (tokenUriQuery.isError || ownerQuery.isError) {
    return <div className="emptyState"><h3>NFT not found</h3><p>Token #{tokenId.toString()} does not exist on the configured contract.</p></div>;
  }

  return (
    <>
      <div className="nftDetailGrid">
        <div className="detailMedia">
          {metadata?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ipfsToHttp(metadata.image)} alt={metadata.name || `NFT #${tokenId}`} />
          ) : <div className="nftPlaceholder large">AEGIS / {tokenId.toString()}</div>}
        </div>

        <div className="detailContent">
          <span className="eyebrow">AegisMint / Token #{tokenId.toString()}</span>
          <h1>{metadata?.name || `Token #${tokenId.toString()}`}</h1>
          <p className="detailDescription">{metadata?.description || "Metadata is loading from IPFS."}</p>

          <div className="identityGrid">
            <div><span>Creator</span><strong>{shortAddress(creatorQuery.data)}</strong></div>
            <div><span>Current owner</span><strong>{shortAddress(ownerQuery.data)}</strong></div>
            <div><span>Status</span><strong>{listing?.active ? "Available" : "Owned"}</strong></div>
            <div><span>Network</span><strong>Sepolia</strong></div>
          </div>

          {listing?.active ? (
            <div className="saleBox">
              <div className="salePrice"><span>Current price</span><strong>{formatEther(listing.price)} ETH</strong></div>
              <div className="saleBreakdown">
                <span>Fee {(Number(listing.feeBps) / 100).toFixed(2)}% · {formatEther(listingFee)} ETH</span>
                <span>Seller receives {formatEther(sellerProceeds)} ETH</span>
              </div>
              {isSeller ? (
                <button className="secondaryButton" disabled={stage === "pending" || stage === "awaiting-wallet"} onClick={() => address && runTx("Cancel listing", () => writeContractAsync({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "cancelListing", args: [listing.id], account: address, chain: sepolia }))}>Cancel listing</button>
              ) : (
                <button className="primaryButton" disabled={!isConnected || chainId !== sepolia.id || stage === "pending" || stage === "awaiting-wallet"} onClick={() => address && runTx("Purchase", () => writeContractAsync({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "buyNFT", args: [listing.id], value: listing.price, account: address, chain: sepolia }))}>Buy now</button>
              )}
            </div>
          ) : isOwner ? (
            <form className="saleBox listingForm" onSubmit={listForSale}>
              <label><span>List for sale</span><div className="priceInput"><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" /><strong>ETH</strong></div></label>
              <button className="primaryButton" type="submit" disabled={!isConnected || chainId !== sepolia.id || stage === "pending" || stage === "awaiting-wallet"}>Approve & list</button>
            </form>
          ) : null}

          <TransactionStatus stage={stage} hash={hash} message={message} />
        </div>
      </div>

      <div className="detailLowerGrid">
        <section className="trustPanel">
          <div className="sectionHeading compactHeading"><span className="eyebrow">Trust center</span><h2>Verify, don’t trust</h2></div>
          <div className="verificationList">
            <Verification label="ERC-721 ownership" value="Verified on-chain" />
            <Verification label="Metadata" value={tokenUriQuery.data || "—"} mono />
            <Verification label="Asset storage" value={metadata?.image || "—"} mono />
            <Verification label="NFT contract" value={NFT_ADDRESS} mono href={`https://sepolia.etherscan.io/address/${NFT_ADDRESS}`} />
            <Verification label="Marketplace" value={MARKETPLACE_ADDRESS} mono href={`https://sepolia.etherscan.io/address/${MARKETPLACE_ADDRESS}`} />
          </div>
        </section>
        <ProvenancePanel nftContract={NFT_ADDRESS as Address} tokenId={tokenId} />
      </div>
    </>
  );
}

function Verification({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  const content = <strong className={mono ? "mono" : ""}>{value}</strong>;
  return <div className="verificationRow"><span><i>✓</i>{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer">{content} ↗</a> : content}</div>;
}
