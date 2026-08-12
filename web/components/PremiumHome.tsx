"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEther, parseAbiItem } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import {
  MARKETPLACE_ADDRESS,
  NFT_ADDRESS,
  contractsConfigured,
  marketplaceAbi,
  nftAbi,
  type Listing,
} from "@/lib/contracts";
import { getLogsInChunks } from "@/lib/logs";
import { ipfsToHttp, shortAddress } from "@/lib/ipfs";
import type { NFTMetadata } from "./NFTCard";

const listedEvent = parseAbiItem("event NFTListed(uint256 indexed listingId, address indexed nftContract, uint256 indexed tokenId, address seller, uint256 price)");
const soldEvent = parseAbiItem("event NFTSold(uint256 indexed listingId, address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price, uint256 marketplaceFee)");
const mintedEvent = parseAbiItem("event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI)");

type ActivityRow = {
  key: string;
  kind: "Listed" | "Sale" | "Minted";
  tokenId: bigint;
  value?: bigint;
  block: bigint;
};

export function PremiumHome() {
  const client = usePublicClient();
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activitySeries, setActivitySeries] = useState<number[]>(Array(12).fill(0));

  const listingsQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "getActiveListings",
    args: [0n, 8n],
    query: { enabled: contractsConfigured, refetchInterval: 12_000 },
  });

  const statsQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "marketplaceStats",
    query: { enabled: contractsConfigured, refetchInterval: 15_000 },
  });

  const listings = ((listingsQuery.data?.[0] ?? []) as readonly Listing[]);
  const featured = listings[0];
  const stats = statsQuery.data ?? [0n, 0n, 0n, 0n];

  useEffect(() => {
    let cancelled = false;
    if (!client || !contractsConfigured) return;
    const publicClient = client;

    async function loadActivity() {
      try {
        const latest = await publicClient.getBlockNumber();
        const deployment = BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || "0");
        const recentStart = latest > 120n ? latest - 120n : 0n;
        const from = deployment > recentStart ? deployment : recentStart;

        const [listed, sold, minted] = await Promise.all([
          getLogsInChunks(from, latest, (start, end) => publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: listedEvent, fromBlock: start, toBlock: end })),
          getLogsInChunks(from, latest, (start, end) => publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: soldEvent, fromBlock: start, toBlock: end })),
          getLogsInChunks(from, latest, (start, end) => publicClient.getLogs({ address: NFT_ADDRESS, event: mintedEvent, fromBlock: start, toBlock: end })),
        ]);

        const rows: ActivityRow[] = [
          ...listed.map((log) => ({
            key: `${log.transactionHash}-listed-${log.logIndex}`,
            kind: "Listed" as const,
            tokenId: log.args.tokenId ?? 0n,
            value: log.args.price,
            block: log.blockNumber,
          })),
          ...sold.map((log) => ({
            key: `${log.transactionHash}-sold-${log.logIndex}`,
            kind: "Sale" as const,
            tokenId: log.args.tokenId ?? 0n,
            value: log.args.price,
            block: log.blockNumber,
          })),
          ...minted.map((log) => ({
            key: `${log.transactionHash}-mint-${log.logIndex}`,
            kind: "Minted" as const,
            tokenId: log.args.tokenId ?? 0n,
            block: log.blockNumber,
          })),
        ].sort((a, b) => (a.block > b.block ? -1 : a.block < b.block ? 1 : 0));

        const span = latest - from + 1n;
        const bucketWidth = span > 12n ? (span + 11n) / 12n : 1n;
        const buckets = Array(12).fill(0) as number[];
        for (const row of rows) {
          const raw = Number((row.block - from) / bucketWidth);
          const index = Math.max(0, Math.min(11, raw));
          buckets[index] += 1;
        }

        if (!cancelled) {
          setActivity(rows.slice(0, 5));
          setActivitySeries(buckets);
        }
      } catch {
        if (!cancelled) {
          setActivity([]);
          setActivitySeries(Array(12).fill(0));
        }
      }
    }

    void loadActivity();
    const timer = window.setInterval(() => void loadActivity(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client]);

  return (
    <main className="premiumHome">
      <section className="premiumHero pageShell">
        <div className="premiumHeroCopy">
          <span className="premiumKicker">Digital ownership · Ethereum · Sepolia</span>
          <h1>Art ownership,<br /><em>on-chain.</em></h1>
          <p>AegisMint is an ERC-721 marketplace for collectible digital art. Ownership, provenance and settlement remain independently verifiable.</p>
          <div className="premiumHeroActions">
            <Link className="premiumPrimary" href="/explore">Explore Market <span>↗</span></Link>
            <Link className="premiumSecondary" href="/#protocol">Learn More <span>↗</span></Link>
          </div>
          <div className="premiumCapabilityRow" id="protocol">
            <Capability icon="cube" title="ERC-721" subtitle="Standard" />
            <Capability icon="link" title="On-chain" subtitle="Provenance" />
            <Capability icon="lock" title="Escrow" subtitle="Settlement" />
            <Capability icon="shield" title="Verified" subtitle="Contracts" />
          </div>
        </div>

        <div className="premiumFeatureWrap">
          {featured ? <FeaturedArtwork listing={featured} /> : <FeaturedEmpty pending={listingsQuery.isPending} />}
        </div>
      </section>

      <section className="premiumDashboard pageShell" id="market-activity">
        <Panel title="Live Listings" action={<Link href="/explore">View all</Link>} className="listingPanel">
          <div className="compactListings">
            {listings.length ? listings.slice(0, 4).map((listing) => <CompactListing listing={listing} key={listing.id.toString()} />) : <PanelEmpty text="No active listings on Sepolia." />}
          </div>
        </Panel>

        <Panel title="Market Activity" action={<span className="panelPeriod">Recent blocks</span>} className="activityChartPanel">
          <MarketSnapshot stats={stats} series={activitySeries} />
        </Panel>

        <Panel title="Recent Activity" action={<Link href="/explore">View all</Link>} className="recentPanel">
          <div className="recentActivityList">
            {activity.length ? activity.map((row) => <ActivityItem row={row} key={row.key} />) : <PanelEmpty text="No recent contract events." />}
          </div>
        </Panel>

        <aside className="createCallout">
          <div>
            <span className="calloutKicker">Create on-chain</span>
            <h2>Create. Mint.<br />Make it yours.</h2>
            <p>Pin the asset and metadata to IPFS, then mint directly to the verified AegisMint collection.</p>
          </div>
          <Link href="/create">Create Artwork <span>↗</span></Link>
        </aside>
      </section>

      <section className="protocolRail">
        <div className="pageShell protocolRailInner">
          <span className="protocolLead">Built on Ethereum. Verifiable by design.</span>
          <ProtocolBadge mark="◆" title="Ethereum" subtitle="On-chain" />
          <ProtocolBadge mark="⬡" title="Sepolia" subtitle="Testnet" />
          <ProtocolBadge mark="◇" title="IPFS" subtitle="Storage" />
          <ProtocolBadge mark="Z" title="OpenZeppelin" subtitle="Contracts" />
          <ProtocolBadge mark="✓" title="Verified" subtitle="Etherscan" />
        </div>
      </section>
    </main>
  );
}

function FeaturedArtwork({ listing }: { listing: Listing }) {
  const tokenQuery = useReadContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "tokenURI", args: [listing.tokenId] });
  const creatorQuery = useReadContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "creatorOf", args: [listing.tokenId] });
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tokenQuery.data) return;
    fetch(ipfsToHttp(tokenQuery.data))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("metadata unavailable")))
      .then((json) => !cancelled && setMetadata(json))
      .catch(() => !cancelled && setMetadata(null));
    return () => { cancelled = true; };
  }, [tokenQuery.data]);

  return (
    <article className="featuredArtworkCard">
      <div className="featuredInfo">
        <span className="featuredBadge"><i /> Featured Artwork</span>
        <div>
          <h2>{metadata?.name || `Token #${listing.tokenId.toString()}`}</h2>
          <p className="featuredCollection">AegisMint Sepolia Collection <span>●</span></p>
          <p className="featuredDescription">{metadata?.description || "Verifiable digital ownership, permanently anchored to an ERC-721 token."}</p>
        </div>
        <dl className="featuredMeta">
          <div><dt>Creator</dt><dd>{shortAddress(creatorQuery.data)}</dd></div>
          <div><dt>Token ID</dt><dd>#{listing.tokenId.toString()}</dd></div>
          <div><dt>Standard</dt><dd>ERC-721</dd></div>
        </dl>
        <div className="featuredPrice">
          <span>Current Price</span>
          <strong><b>◆</b> {formatEther(listing.price)} ETH</strong>
          <small>Sepolia test ETH</small>
        </div>
        <Link className="featuredAction" href={`/nft/${listing.tokenId.toString()}?listing=${listing.id.toString()}`}>View Artwork <span>↗</span></Link>
      </div>
      <Link className="featuredImage" href={`/nft/${listing.tokenId.toString()}?listing=${listing.id.toString()}`}>
        {metadata?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ipfsToHttp(metadata.image)} alt={metadata.name || `NFT #${listing.tokenId.toString()}`} />
        ) : <div className="premiumImagePlaceholder">AEGIS / {listing.tokenId.toString()}</div>}
      </Link>
    </article>
  );
}

function FeaturedEmpty({ pending }: { pending: boolean }) {
  return <div className="featuredEmpty"><span>{pending ? "Reading Sepolia market…" : "No work is currently listed."}</span><Link href="/create">Mint the first work →</Link></div>;
}

function CompactListing({ listing }: { listing: Listing }) {
  const tokenQuery = useReadContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "tokenURI", args: [listing.tokenId] });
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tokenQuery.data) return;
    fetch(ipfsToHttp(tokenQuery.data))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("metadata unavailable")))
      .then((json) => !cancelled && setMetadata(json))
      .catch(() => !cancelled && setMetadata(null));
    return () => { cancelled = true; };
  }, [tokenQuery.data]);

  return (
    <Link href={`/nft/${listing.tokenId.toString()}?listing=${listing.id.toString()}`} className="compactListingRow">
      <div className="compactThumb">
        {metadata?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ipfsToHttp(metadata.image)} alt="" />
        ) : <span>#{listing.tokenId.toString()}</span>}
      </div>
      <div className="compactTitle"><strong>{metadata?.name || `Token #${listing.tokenId.toString()}`}</strong><span>{shortAddress(listing.seller)}</span></div>
      <div className="compactPrice"><strong>◆ {formatEther(listing.price)} ETH</strong><span>Listed</span></div>
    </Link>
  );
}

function MarketSnapshot({ stats, series }: { stats: readonly bigint[]; series: number[] }) {
  const [totalListings, activeListings, totalSales, totalVolume] = stats;
  const points = useMemo(() => {
    const max = Math.max(1, ...series);
    return series.map((value, index) => {
      const x = (index / Math.max(1, series.length - 1)) * 100;
      const y = 86 - (value / max) * 64;
      return `${x},${y}`;
    }).join(" ");
  }, [series]);

  return (
    <div className="marketSnapshot">
      <div className="snapshotMetrics">
        <SnapshotMetric label="Listings" value={totalListings.toString()} />
        <SnapshotMetric label="Available" value={activeListings.toString()} />
        <SnapshotMetric label="Sales" value={totalSales.toString()} />
        <SnapshotMetric label="Volume" value={`${Number(formatEther(totalVolume)).toFixed(3)} ETH`} />
      </div>
      <div className="marketChart" aria-label="Recent on-chain marketplace event activity">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
          <defs>
            <linearGradient id="activityFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity=".16" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="chartGrid" d="M0 22H100 M0 54H100 M0 86H100" />
          <polygon className="chartFill" points={`0,96 ${points} 100,96`} />
          <polyline className="chartLine" points={points} />
        </svg>
        <div className="chartAxis"><span>Earlier</span><span>Recent blocks</span><span>Latest</span></div>
      </div>
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function ActivityItem({ row }: { row: ActivityRow }) {
  return (
    <Link href={`/nft/${row.tokenId.toString()}`} className="activityItem">
      <span className={`activityIcon ${row.kind.toLowerCase()}`}>{row.kind === "Sale" ? "↗" : row.kind === "Listed" ? "◇" : "+"}</span>
      <span className="activityCopy"><b>{row.kind}</b><small>Aegis token #{row.tokenId.toString()}</small></span>
      <span className="activityValue"><b>{row.value !== undefined ? `${formatEther(row.value)} ETH` : "—"}</b><small>Block {row.block.toString()}</small></span>
    </Link>
  );
}

function Capability({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  const icons: Record<string, string> = { cube: "◇", link: "↗", lock: "▣", shield: "⬡" };
  return <div className="premiumCapability"><span>{icons[icon] || "•"}</span><div><strong>{title}</strong><small>{subtitle}</small></div></div>;
}

function ProtocolBadge({ mark, title, subtitle }: { mark: string; title: string; subtitle: string }) {
  return <div className="protocolBadge"><span>{mark}</span><div><strong>{title}</strong><small>{subtitle}</small></div></div>;
}

function Panel({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <section className={`premiumPanel ${className || ""}`}><header><h2>{title}</h2>{action}</header>{children}</section>;
}

function PanelEmpty({ text }: { text: string }) {
  return <div className="panelEmpty">{text}</div>;
}
