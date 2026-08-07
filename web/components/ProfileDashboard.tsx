"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther, parseAbiItem } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { MARKETPLACE_ADDRESS, NFT_ADDRESS, contractsConfigured, marketplaceAbi, nftAbi, type Listing } from "@/lib/contracts";
import { shortAddress } from "@/lib/ipfs";

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

    async function load() {
      setLoading(true);
      setError("");
      try {
        const fromBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || "0");
        const [mints, listingLogs, saleLogs] = await Promise.all([
          publicClient.getLogs({ address: NFT_ADDRESS, event: mintedEvent, fromBlock, toBlock: "latest" }),
          publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: listedEvent, fromBlock, toBlock: "latest" }),
          publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: soldEvent, fromBlock, toBlock: "latest" }),
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
          .filter((result) => result.owner.toLowerCase() === address.toLowerCase())
          .map((result) => result.tokenId);

        const myListingIds = listingLogs
          .filter((log) => log.args.seller?.toLowerCase() === address.toLowerCase())
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
          .filter((log) => log.args.buyer?.toLowerCase() === address.toLowerCase())
          .map((log) => ({ listingId: log.args.listingId!, tokenId: log.args.tokenId!, price: log.args.price! }));
        const sold = saleLogs
          .filter((log) => log.args.seller?.toLowerCase() === address.toLowerCase())
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
    return <div className="emptyState"><span className="eyebrow">Wallet dashboard</span><h3>Connect MetaMask to continue</h3><p>Your owned, listed, purchased and sold NFTs are derived from live Sepolia state and contract events.</p></div>;
  }
  if (!contractsConfigured) {
    return <div className="emptyState"><h3>Contracts are not configured</h3><p>Dashboard indexing activates after the Sepolia deployment.</p></div>;
  }

  return (
    <div className="dashboardStack">
      <div className="profileHero">
        <div><span className="eyebrow">Connected account</span><h1>{shortAddress(address)}</h1><p>Live portfolio reconstructed from ERC-721 ownership and AegisMarketplace events.</p></div>
        <span className="networkPill"><i /> Sepolia</span>
      </div>

      <div className="statsGrid dashboardStats">
        <DashStat label="Owned" value={state.owned.length.toString()} />
        <DashStat label="Active listings" value={state.activeListings.length.toString()} />
        <DashStat label="Purchased" value={state.purchased.length.toString()} />
        <DashStat label="Sales volume" value={`${Number(formatEther(state.salesVolume)).toFixed(3)} ETH`} />
      </div>

      {loading ? <div className="emptyState"><p>Indexing on-chain activity…</p></div> : null}
      {error ? <div className="txStatus error"><strong>Indexing error</strong><p>{error}</p></div> : null}

      {!loading ? (
        <div className="dashboardSections">
          <PortfolioSection title="My NFTs" subtitle="Current ERC-721 ownership" empty="No NFTs owned by this wallet.">
            {state.owned.map((tokenId) => <TokenLink tokenId={tokenId} key={tokenId.toString()} />)}
          </PortfolioSection>
          <PortfolioSection title="My listings" subtitle="Active escrow listings" empty="No active listings.">
            {state.activeListings.map((listing) => <TokenLink tokenId={listing.tokenId} listingId={listing.id} price={listing.price} key={listing.id.toString()} />)}
          </PortfolioSection>
          <PortfolioSection title="Purchased" subtitle="Historical successful purchases" empty="No purchases yet.">
            {state.purchased.map((sale) => <TokenLink tokenId={sale.tokenId} listingId={sale.listingId} price={sale.price} key={`buy-${sale.listingId}`} />)}
          </PortfolioSection>
          <PortfolioSection title="Sold" subtitle="Historical successful sales" empty="No completed sales yet.">
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
  return <Link className="tokenRow" href={`/nft/${tokenId.toString()}${listingId ? `?listing=${listingId}` : ""}`}><span><strong>Token #{tokenId.toString()}</strong>{listingId ? <small>Listing #{listingId.toString()}</small> : <small>ERC-721</small>}</span>{price !== undefined ? <strong>{formatEther(price)} ETH</strong> : <span>Open →</span>}</Link>;
}
