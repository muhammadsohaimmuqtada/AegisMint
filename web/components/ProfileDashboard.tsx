"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther, parseAbiItem } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { MARKETPLACE_ADDRESS, NFT_ADDRESS, contractsConfigured, marketplaceAbi, nftAbi, type Listing } from "@/lib/contracts";
import { shortAddress } from "@/lib/ipfs";
import { getLogsInChunks } from "@/lib/logs";

const mintedEvent = parseAbiItem("event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI)");
const listedEvent = parseAbiItem("event NFTListed(uint256 indexed listingId, address indexed nftContract, uint256 indexed tokenId, address seller, uint256 price)");
const soldEvent = parseAbiItem("event NFTSold(uint256 indexed listingId, address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price, uint256 marketplaceFee)");

type DashboardState = {
  owned: bigint[];
  activeListings: Listing[];
  purchased: Array<{ listingId: bigint; tokenId: bigint; price: bigint }>;
  sold: Array<{ listingId: bigint; tokenId: bigint; price: bigint }>;
  salesVolume: bigint;
};

const initial: DashboardState = { owned: [], activeListings: [], purchased: [], sold: [], salesVolume: 0n };

export function ProfileDashboard() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [state, setState] = useState<DashboardState>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!client || !address || !contractsConfigured) {
      setState(initial);
      return;
    }

    const publicClient = client;
    const walletAddress = address;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const fromBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || "0");
        const latestBlock = await publicClient.getBlockNumber();
        const [mints, listingLogs, saleLogs] = await Promise.all([
          getLogsInChunks(fromBlock, latestBlock, (start, end) =>
            publicClient.getLogs({ address: NFT_ADDRESS, event: mintedEvent, fromBlock: start, toBlock: end }),
          ),
          getLogsInChunks(fromBlock, latestBlock, (start, end) =>
            publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: listedEvent, fromBlock: start, toBlock: end }),
          ),
          getLogsInChunks(fromBlock, latestBlock, (start, end) =>
            publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: soldEvent, fromBlock: start, toBlock: end }),
          ),
        ]);

        const tokenIds = [...new Set(mints.map((log) => log.args.tokenId).filter((id): id is bigint => id !== undefined))];
        const ownerResults = await Promise.all(tokenIds.map(async (tokenId) => {
          try {
            const owner = await publicClient.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "ownerOf", args: [tokenId] });
            return { tokenId, owner };
          } catch {
            return null;
          }
        }));
        const owned = ownerResults
          .filter((result): result is { tokenId: bigint; owner: `0x${string}` } => Boolean(result))
          .filter((result) => result.owner.toLowerCase() === walletAddress.toLowerCase())
          .map((result) => result.tokenId);

        const myListingIds = listingLogs
          .filter((log) => log.args.seller?.toLowerCase() === walletAddress.toLowerCase())
          .map((log) => log.args.listingId)
          .filter((id): id is bigint => id !== undefined);
        const listingStates = await Promise.all(myListingIds.map(async (listingId) => {
          try {
            return await publicClient.readContract({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "getListing", args: [listingId] }) as Listing;
          } catch {
            return null;
          }
        }));
        const activeListings = listingStates.filter((listing): listing is Listing => Boolean(listing?.active));

        const purchased = saleLogs
          .filter((log) => log.args.buyer?.toLowerCase() === walletAddress.toLowerCase())
          .map((log) => ({ listingId: log.args.listingId!, tokenId: log.args.tokenId!, price: log.args.price! }));
        const sold = saleLogs
          .filter((log) => log.args.seller?.toLowerCase() === walletAddress.toLowerCase())
          .map((log) => ({ listingId: log.args.listingId!, tokenId: log.args.tokenId!, price: log.args.price! }));
        const salesVolume = sold.reduce((sum, sale) => sum + sale.price, 0n);

        if (!cancelled) setState({ owned, activeListings, purchased, sold, salesVolume });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not index wallet activity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [client, address]);

  if (!isConnected) {
    return <div className="emptyState"><span className="eyebrow">Portfolio</span><h3>Connect a wallet</h3><p>Holdings, active listings and market history are reconstructed from Sepolia state and contract events.</p></div>;
  }
  if (!contractsConfigured) {
    return <div className="emptyState"><h3>Portfolio unavailable</h3><p>The Sepolia deployment is not configured for this environment.</p></div>;
  }

  return (
    <div className="dashboardStack">
      <div className="profileHero">
        <div><span className="eyebrow">Portfolio</span><h1>{shortAddress(address)}</h1><p>ERC-721 holdings and AegisMint market history.</p></div>
        <span className="networkPill"><i /> Ethereum Sepolia</span>
      </div>

      <div className="statsGrid dashboardStats">
        <DashStat label="Held" value={state.owned.length.toString()} />
        <DashStat label="Listed" value={state.activeListings.length.toString()} />
        <DashStat label="Acquired" value={state.purchased.length.toString()} />
        <DashStat label="Sold volume" value={`${Number(formatEther(state.salesVolume)).toFixed(3)} ETH`} />
      </div>

      {loading ? <div className="emptyState"><p>Reading market history…</p></div> : null}
      {error ? <div className="txStatus error"><strong>Indexing error</strong><p>{error}</p></div> : null}

      {!loading ? (
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

function DashStat({ label, value }: { label: string; value: string }) {
  return <div className="statCard"><span>{label}</span><strong>{value}</strong></div>;
}

function PortfolioSection({ title, subtitle, empty, children }: { title: string; subtitle: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="portfolioSection"><div><span className="eyebrow">{subtitle}</span><h2>{title}</h2></div><div className="tokenList">{hasChildren ? children : <p className="muted">{empty}</p>}</div></section>;
}

function TokenLink({ tokenId, listingId, price }: { tokenId: bigint; listingId?: bigint; price?: bigint }) {
  return <Link className="tokenRow" href={`/nft/${tokenId.toString()}${listingId ? `?listing=${listingId}` : ""}`}><span><strong>Work #{tokenId.toString()}</strong>{listingId ? <small>Listing #{listingId.toString()}</small> : <small>ERC-721</small>}</span>{price !== undefined ? <strong>{formatEther(price)} ETH</strong> : <span>Open →</span>}</Link>;
}
