"use client";

import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { MARKETPLACE_ADDRESS, contractsConfigured, marketplaceAbi } from "@/lib/contracts";

export function MarketplaceStats() {
  const { data } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "marketplaceStats",
    query: { enabled: contractsConfigured, refetchInterval: 15_000 },
  });

  const [totalListings, activeListings, totalSales, totalVolume] = data ?? [0n, 0n, 0n, 0n];

  return (
    <div className="statsGrid">
      <Stat label="Listings" value={totalListings.toString()} />
      <Stat label="Available" value={activeListings.toString()} />
      <Stat label="Sales" value={totalSales.toString()} />
      <Stat label="Volume" value={`${Number(formatEther(totalVolume)).toFixed(3)} ETH`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="statCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
