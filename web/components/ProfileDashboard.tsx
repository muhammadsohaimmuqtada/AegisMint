"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { MARKETPLACE_ADDRESS, contractsConfigured, marketplaceAbi, type Listing } from "@/lib/contracts";
import { shortAddress } from "@/lib/ipfs";
import { TransactionStatus, type TransactionStage } from "./TransactionStatus";

type SaleRecord = { listingId: bigint; tokenId: bigint; price: bigint };
type DashboardState = {
  owned: bigint[];
  activeListings: Listing[];
  purchased: SaleRecord[];
  sold: SaleRecord[];
  salesVolume: bigint;
  pendingProceeds: bigint;
};

type PortfolioPayload = {
  owned: string[];
  activeListings: Array<{
    id: string;
    nftContract: Address;
    tokenId: string;
    seller: Address;
    feeBps: string;
    buyer: Address;
    price: string;
    active: boolean;
    sold: boolean;
    listedAt: string;
    closedAt: string;
  }>;
  purchased: Array<{ listingId: string; tokenId: string; price: string }>;
  sold: Array<{ listingId: string; tokenId: string; price: string }>;
  salesVolume: string;
  pendingProceeds: string;
  error?: string;
};

const initial: DashboardState = { owned: [], activeListings: [], purchased: [], sold: [], salesVolume: 0n, pendingProceeds: 0n };

export function ProfileDashboard() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<DashboardState>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [withdrawStage, setWithdrawStage] = useState<TransactionStage>("idle");
  const [withdrawHash, setWithdrawHash] = useState<`0x${string}`>();
  const [withdrawMessage, setWithdrawMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    if (!address || !contractsConfigured) {
      setState(initial);
      return () => controller.abort();
    }

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/portfolio?address=${encodeURIComponent(address!)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as PortfolioPayload;
        if (!response.ok) throw new Error(payload.error || "Portfolio state could not be loaded.");
        setState(hydratePortfolio(payload));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Portfolio state could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [address, refreshKey]);

  async function withdrawProceeds() {
    if (!address || !publicClient || state.pendingProceeds <= 0n || chainId !== sepolia.id) return;
    try {
      setWithdrawHash(undefined);
      setWithdrawStage("awaiting-wallet");
      setWithdrawMessage("Confirm withdrawal of deferred seller proceeds to this wallet.");
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "withdrawProceeds",
        args: [address],
        account: address,
        chain: sepolia,
      });
      setWithdrawHash(hash);
      setWithdrawStage("pending");
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      setWithdrawStage("confirmed");
      setWithdrawMessage("Deferred proceeds were withdrawn to your wallet.");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setWithdrawStage("error");
      setWithdrawMessage(err instanceof Error ? err.message : "Proceeds withdrawal failed.");
    }
  }

  if (!isConnected) {
    return <div className="emptyState refinedState"><span className="eyebrow">Portfolio</span><h3>Connect a wallet to load your record</h3><p>Holdings, listings, acquisitions and sales are reconstructed from the deployed Sepolia contracts.</p></div>;
  }
  if (!contractsConfigured) {
    return <div className="emptyState refinedState"><h3>Portfolio unavailable</h3><p>The Sepolia deployment is not configured for this environment.</p></div>;
  }

  return (
    <div className="dashboardStack">
      <div className="profileHero">
        <div>
          <span className="eyebrow">Portfolio</span>
          <h1>{shortAddress(address)}</h1>
          <p>Current ERC-721 ownership and AegisMint market history, reconstructed from Sepolia state.</p>
        </div>
        <div className="profileActions">
          <span className="networkPill"><i /> Ethereum Sepolia</span>
          <button className="portfolioRefresh" type="button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>

      <div className="statsGrid dashboardStats">
        <DashStat label="Held" value={state.owned.length.toString()} />
        <DashStat label="Listed" value={state.activeListings.length.toString()} />
        <DashStat label="Acquired" value={state.purchased.length.toString()} />
        <DashStat label="Sold volume" value={`${formatCompactEth(state.salesVolume)} ETH`} />
      </div>

      {state.pendingProceeds > 0n ? (
        <section className="proceedsBanner" aria-label="Deferred seller proceeds">
          <div><span className="eyebrow">Settlement recovery</span><h2>{formatEther(state.pendingProceeds)} ETH available</h2><p>A prior direct seller payment was deferred by the marketplace contract. These funds remain claimable on-chain.</p></div>
          <button className="primaryButton" disabled={chainId !== sepolia.id || withdrawStage === "pending" || withdrawStage === "awaiting-wallet"} onClick={withdrawProceeds}>Withdraw proceeds</button>
        </section>
      ) : null}
      <TransactionStatus stage={withdrawStage} hash={withdrawHash} message={withdrawMessage} />

      {loading && !error ? <PortfolioLoading /> : null}
      {error ? (
        <div className="emptyState refinedState portfolioError" role="alert">
          <span className="eyebrow">Portfolio read</span>
          <h3>Couldn’t reconstruct this wallet yet</h3>
          <p>{error}</p>
          <button className="secondaryButton" type="button" onClick={() => setRefreshKey((value) => value + 1)}>Retry portfolio read</button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="dashboardSections">
          <PortfolioSection title="Holdings" subtitle="Current ownership" empty="No works currently held by this wallet.">
            {state.owned.map((tokenId) => <TokenLink tokenId={tokenId} key={tokenId.toString()} />)}
          </PortfolioSection>
          <PortfolioSection title="Listings" subtitle="Active escrow" empty="No active listings.">
            {state.activeListings.map((listing) => <TokenLink tokenId={listing.tokenId} listingId={listing.id} price={listing.price} key={listing.id.toString()} />)}
          </PortfolioSection>
          <PortfolioSection title="Acquisitions" subtitle="Purchase history" empty="No completed purchases.">
            {state.purchased.map((sale) => <TokenLink tokenId={sale.tokenId} listingId={sale.listingId} price={sale.price} key={`buy-${sale.listingId}`} />)}
          </PortfolioSection>
          <PortfolioSection title="Sales" subtitle="Sale history" empty="No completed sales.">
            {state.sold.map((sale) => <TokenLink tokenId={sale.tokenId} listingId={sale.listingId} price={sale.price} key={`sold-${sale.listingId}`} />)}
          </PortfolioSection>
        </div>
      ) : null}
    </div>
  );
}

function hydratePortfolio(payload: PortfolioPayload): DashboardState {
  return {
    owned: payload.owned.map(BigInt),
    activeListings: payload.activeListings.map((listing) => ({
      ...listing,
      id: BigInt(listing.id),
      tokenId: BigInt(listing.tokenId),
      feeBps: BigInt(listing.feeBps),
      price: BigInt(listing.price),
      listedAt: BigInt(listing.listedAt),
      closedAt: BigInt(listing.closedAt),
    })),
    purchased: payload.purchased.map((sale) => ({ listingId: BigInt(sale.listingId), tokenId: BigInt(sale.tokenId), price: BigInt(sale.price) })),
    sold: payload.sold.map((sale) => ({ listingId: BigInt(sale.listingId), tokenId: BigInt(sale.tokenId), price: BigInt(sale.price) })),
    salesVolume: BigInt(payload.salesVolume),
    pendingProceeds: BigInt(payload.pendingProceeds),
  };
}

function formatCompactEth(value: bigint) {
  const formatted = formatEther(value);
  const [whole, fraction = ""] = formatted.split(".");
  if (!fraction) return whole;
  const trimmed = fraction.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function DashStat({ label, value }: { label: string; value: string }) {
  return <div className="statCard"><span>{label}</span><strong>{value}</strong></div>;
}

function PortfolioSection({ title, subtitle, empty, children }: { title: string; subtitle: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="portfolioSection"><div><span className="eyebrow">{subtitle}</span><h2>{title}</h2></div><div className="tokenList">{hasChildren ? children : <p className="muted portfolioEmptyCopy">{empty}</p>}</div></section>;
}

function TokenLink({ tokenId, listingId, price }: { tokenId: bigint; listingId?: bigint; price?: bigint }) {
  return <Link className="tokenRow" href={`/nft/${tokenId.toString()}${listingId ? `?listing=${listingId}` : ""}`}><span><strong>Work #{tokenId.toString()}</strong>{listingId ? <small>Listing #{listingId.toString()}</small> : <small>ERC-721</small>}</span>{price !== undefined ? <strong>{formatEther(price)} ETH</strong> : <span>Open →</span>}</Link>;
}

function PortfolioLoading() {
  return <div className="portfolioLoading" aria-busy="true" aria-label="Loading portfolio"><span /><span /><span /><span /></div>;
}
