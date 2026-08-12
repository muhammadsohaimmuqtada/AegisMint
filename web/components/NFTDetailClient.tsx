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
  const [metadataError, setMetadataError] = useState(false);
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
    query: { enabled: contractsConfigured && listingId > 0n, refetchInterval: listingId > 0n ? 10_000 : false },
  });
  const listing = listingId > 0n ? listingQuery.data as Listing | undefined : undefined;

  useEffect(() => {
    let cancelled = false;
    if (!tokenUriQuery.data) return;
    setMetadataError(false);
    fetch(ipfsToHttp(tokenUriQuery.data))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Metadata unavailable")))
      .then((value) => { if (!cancelled) setMetadata(value); })
      .catch(() => { if (!cancelled) { setMetadata(null); setMetadataError(true); } });
    return () => { cancelled = true; };
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
  const transactionBusy = stage === "pending" || stage === "awaiting-wallet";

  async function refreshMarketState() {
    await ownerQuery.refetch();
    await listingIdQuery.refetch();
  }

  async function runTx(label: string, action: () => Promise<`0x${string}`>) {
    if (!client) return;
    try {
      setHash(undefined);
      setStage("awaiting-wallet");
      setMessage(label);
      const txHash = await action();
      setHash(txHash);
      setStage("pending");
      await client.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      await refreshMarketState();
      setStage("confirmed");
      setMessage(`${label} confirmed on Sepolia.`);
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : `${label} failed`);
    }
  }

  async function listForSale(event: FormEvent) {
    event.preventDefault();
    if (!address || chainId !== sepolia.id || !client) return;
    let wei: bigint;
    try {
      wei = parseEther(price.trim());
      if (wei <= 0n) throw new Error();
    } catch {
      setStage("error");
      setMessage("Enter a valid ETH price greater than zero.");
      return;
    }

    try {
      setHash(undefined);
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
      await client.waitForTransactionReceipt({ hash: approvalHash, confirmations: 1 });

      setStage("awaiting-wallet");
      setMessage("Approval confirmed. Confirm the listing transaction.");
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
      await refreshMarketState();
      setStage("confirmed");
      setMessage("NFT is now escrowed and listed on AegisMint.");
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Listing failed");
    }
  }

  if (!contractsConfigured) {
    return <div className="emptyState refinedState"><h3>Contracts unavailable</h3><p>The Sepolia deployment is not configured for this environment.</p></div>;
  }

  if (tokenUriQuery.isPending || ownerQuery.isPending) {
    return <div className="detailSkeleton" aria-label="Loading artwork" aria-busy="true" />;
  }

  if (tokenUriQuery.isError || ownerQuery.isError) {
    return <div className="emptyState refinedState"><span className="eyebrow">Collection lookup</span><h3>Work not found</h3><p>Token #{tokenId.toString()} does not exist on the configured AegisMint collection.</p></div>;
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
          <span className="eyebrow">AegisMint / Work #{tokenId.toString()}</span>
          <h1>{metadata?.name || `Token #${tokenId.toString()}`}</h1>
          <p className="detailDescription">{metadata?.description || (metadataError ? "The on-chain token exists, but its IPFS metadata could not be resolved through the configured gateway." : "Metadata is loading from IPFS.")}</p>

          <div className="identityGrid" aria-label="Ownership record">
            <div><span>Creator</span><strong>{shortAddress(creatorQuery.data)}</strong></div>
            <div><span>Current owner</span><strong>{shortAddress(ownerQuery.data)}</strong></div>
            <div><span>Market state</span><strong>{listing?.active ? "Listed" : "Held"}</strong></div>
            <div><span>Network</span><strong>Ethereum Sepolia</strong></div>
          </div>

          {listing?.active ? (
            <div className="saleBox">
              <div className="salePrice"><span>Asking price</span><strong>{formatEther(listing.price)} ETH</strong></div>
              <div className="saleBreakdown">
                <span>Market fee {(Number(listing.feeBps) / 100).toFixed(2)}% · {formatEther(listingFee)} ETH</span>
                <span>Seller proceeds {formatEther(sellerProceeds)} ETH</span>
              </div>
              {isSeller ? (
                <button className="secondaryButton" disabled={transactionBusy} onClick={() => address && runTx("Cancel listing", () => writeContractAsync({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "cancelListing", args: [listing.id], account: address, chain: sepolia }))}>Cancel listing</button>
              ) : (
                <button className="primaryButton" disabled={!isConnected || chainId !== sepolia.id || transactionBusy} onClick={() => address && runTx("Purchase", () => writeContractAsync({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "buyNFT", args: [listing.id], value: listing.price, account: address, chain: sepolia }))}>Acquire</button>
              )}
            </div>
          ) : isOwner ? (
            <form className="saleBox listingForm" onSubmit={listForSale}>
              <label><span>Offer for sale</span><div className="priceInput"><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" aria-label="Listing price in ETH" autoComplete="off" /><strong>ETH</strong></div></label>
              <button className="primaryButton" type="submit" disabled={!isConnected || chainId !== sepolia.id || transactionBusy}>Approve & list</button>
            </form>
          ) : null}

          {!isConnected && listing?.active ? <p className="actionHint">Connect a wallet to acquire this work.</p> : null}
          {isConnected && chainId !== sepolia.id ? <p className="actionHint warningText">Switch your wallet to Ethereum Sepolia before submitting a market transaction.</p> : null}
          <TransactionStatus stage={stage} hash={hash} message={message} />
        </div>
      </div>

      <div className="detailLowerGrid">
        <section className="trustPanel">
          <div className="sectionHeading compactHeading"><span className="eyebrow">On-chain record</span><h2>Ownership registry</h2></div>
          <div className="verificationList">
            <Verification label="ERC-721 state" value="Verified on-chain" />
            <Verification label="Metadata URI" value={tokenUriQuery.data || "—"} mono />
            <Verification label="Asset URI" value={metadata?.image || "—"} mono />
            <Verification label="Collection" value={NFT_ADDRESS} mono href={`https://sepolia.etherscan.io/address/${NFT_ADDRESS}`} />
            <Verification label="Market contract" value={MARKETPLACE_ADDRESS} mono href={`https://sepolia.etherscan.io/address/${MARKETPLACE_ADDRESS}`} />
          </div>
        </section>
        <ProvenancePanel nftContract={NFT_ADDRESS as Address} tokenId={tokenId} />
      </div>
    </>
  );
}

function Verification({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  const content = <strong className={mono ? "mono" : ""}>{value}</strong>;
  return <div className="verificationRow"><span><i>●</i>{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer">{content} ↗</a> : content}</div>;
}
