"use client";

import { useReadContract } from "wagmi";
import {
  MARKETPLACE_ADDRESS,
  contractsConfigured,
  marketplaceAbi,
  type Listing,
} from "@/lib/contracts";
import { NFTCard } from "./NFTCard";

export function MarketplaceGrid({ limit = 24 }: { limit?: number }) {
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

  if (!contractsConfigured) return null;

  if (isPending) {
    return (
      <div className="nftGrid" aria-label="Loading NFTs">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="nftCard skeletonCard" key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="emptyState">
        <h3>Couldn’t read marketplace state</h3>
        <p>Check the Sepolia RPC endpoint and deployed contract address.</p>
        <button className="secondaryButton" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  const listings = (data?.[0] ?? []) as readonly Listing[];
  if (!listings.length) {
    return (
      <div className="emptyState">
        <span className="eyebrow">Live Sepolia state</span>
        <h3>No active listings yet</h3>
        <p>Mint the first asset and list it from your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="nftGrid">
      {listings.map((listing) => (
        <NFTCard listing={listing} key={listing.id.toString()} />
      ))}
    </div>
  );
}
