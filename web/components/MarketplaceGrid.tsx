"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import {
  MARKETPLACE_ADDRESS,
  contractsConfigured,
  marketplaceAbi,
  nftAbi,
  type Listing,
} from "@/lib/contracts";
import { ipfsToHttp } from "@/lib/ipfs";
import { NFTCard, type NFTMetadata } from "./NFTCard";

export function MarketplaceGrid({ limit = 24, query = "" }: { limit?: number; query?: string }) {
  const publicClient = usePublicClient();
  const [metadataByToken, setMetadataByToken] = useState<Map<string, NFTMetadata | null>>(new Map());
  const [searchingMetadata, setSearchingMetadata] = useState(false);
  const { data, isPending, isError, refetch } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "getActiveListings",
    args: [0n, BigInt(Math.min(limit, 100))],
    query: {
      enabled: contractsConfigured,
      refetchInterval: 12_000,
    },
  });

  const listings = useMemo(() => (data?.[0] ?? []) as readonly Listing[], [data]);
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    if (!normalizedQuery || !publicClient || listings.length === 0) {
      setMetadataByToken(new Map());
      setSearchingMetadata(false);
      return;
    }

    async function loadMetadata() {
      setSearchingMetadata(true);
      const entries = await Promise.all(listings.map(async (listing) => {
        const key = listing.tokenId.toString();
        try {
          const uri = await publicClient!.readContract({
            address: listing.nftContract,
            abi: nftAbi,
            functionName: "tokenURI",
            args: [listing.tokenId],
          });
          const response = await fetch(ipfsToHttp(uri));
          if (!response.ok) throw new Error("Metadata unavailable");
          return [key, await response.json() as NFTMetadata] as const;
        } catch {
          return [key, null] as const;
        }
      }));

      if (!cancelled) {
        setMetadataByToken(new Map(entries));
        setSearchingMetadata(false);
      }
    }

    void loadMetadata();
    return () => { cancelled = true; };
  }, [listings, normalizedQuery, publicClient]);

  const filteredListings = useMemo(() => {
    if (!normalizedQuery) return listings;
    const tokenQuery = normalizedQuery.replace(/^#/, "");
    return listings.filter((listing) => {
      const metadata = metadataByToken.get(listing.tokenId.toString());
      const attributeText = metadata?.attributes?.map((attribute) => `${attribute.trait_type ?? ""} ${String(attribute.value ?? "")}`).join(" ") ?? "";
      const searchable = [
        listing.id.toString(),
        listing.tokenId.toString(),
        listing.seller,
        metadata?.name ?? "",
        metadata?.description ?? "",
        attributeText,
      ].join(" ").toLowerCase();
      return searchable.includes(normalizedQuery) || listing.tokenId.toString().includes(tokenQuery);
    });
  }, [listings, metadataByToken, normalizedQuery]);

  if (!contractsConfigured) return null;

  if (isPending || (normalizedQuery && searchingMetadata)) {
    return (
      <div className="nftGrid" aria-label={normalizedQuery ? "Searching marketplace" : "Loading NFTs"} aria-busy="true">
        {Array.from({ length: Math.min(6, Math.max(3, listings.length || 6)) }).map((_, index) => (
          <div className="nftCard skeletonCard" key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="emptyState refinedState">
        <span className="eyebrow">Sepolia connection</span>
        <h3>Marketplace data is temporarily unavailable</h3>
        <p>The contracts are configured, but the RPC request did not complete. Retry without leaving the page.</p>
        <button className="secondaryButton" onClick={() => refetch()}>Retry market read</button>
      </div>
    );
  }

  if (!listings.length) {
    return (
      <div className="emptyState refinedState">
        <span className="eyebrow">Live Sepolia state</span>
        <h3>No active listings</h3>
        <p>There are currently no works in marketplace escrow. Mint a work, then list it from its detail page.</p>
        <Link className="secondaryButton" href="/create">Create a work</Link>
      </div>
    );
  }

  if (normalizedQuery && !filteredListings.length) {
    return (
      <div className="emptyState refinedState marketSearchEmpty">
        <span className="eyebrow">Marketplace search</span>
        <h3>No works match “{query.trim()}”</h3>
        <p>Search by artwork name, description, token ID, listing ID, attribute, or seller address.</p>
        <Link className="secondaryButton" href="/explore">Clear search</Link>
      </div>
    );
  }

  return (
    <div className="nftGrid">
      {filteredListings.map((listing) => (
        <NFTCard
          listing={listing}
          prefetchedMetadata={normalizedQuery ? (metadataByToken.get(listing.tokenId.toString()) ?? null) : undefined}
          key={listing.id.toString()}
        />
      ))}
    </div>
  );
}
