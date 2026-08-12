import { createPublicClient, http, zeroAddress } from "viem";
import { sepolia } from "viem/chains";
import { MARKETPLACE_ADDRESS, NFT_ADDRESS, ZERO_ADDRESS, marketplaceAbi, nftAbi, type Listing } from "@/lib/contracts";

export const dynamic = "force-dynamic";

const MAX_LISTINGS = 100_000;
const LISTING_BATCH = 100;
const MAX_TRANSFER_PAGES = 20;

type Transfer = {
  hash?: string;
  blockNum?: string;
  from?: string;
  to?: string;
  erc721TokenId?: string | null;
  tokenId?: string | null;
  metadata?: { blockTimestamp?: string } | null;
};

type TimelineRow = {
  key: string;
  label: string;
  detail: string;
  block?: string;
  timestamp?: string;
  hash?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawTokenId = url.searchParams.get("tokenId") ?? "";
  let tokenId: bigint;
  try {
    tokenId = BigInt(rawTokenId);
    if (tokenId <= 0n) throw new Error();
  } catch {
    return Response.json({ error: "A valid positive token ID is required." }, { status: 400 });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  if (!rpcUrl || NFT_ADDRESS === ZERO_ADDRESS || MARKETPLACE_ADDRESS === ZERO_ADDRESS) {
    return Response.json({ error: "The Sepolia deployment is not configured." }, { status: 503 });
  }

  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

  try {
    const [creator, owner, stats] = await Promise.all([
      client.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "creatorOf", args: [tokenId] }),
      client.readContract({ address: NFT_ADDRESS, abi: nftAbi, functionName: "ownerOf", args: [tokenId] }),
      client.readContract({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "marketplaceStats" }),
    ]);

    const totalListings = Number(stats[0]);
    if (!Number.isSafeInteger(totalListings) || totalListings < 0 || totalListings > MAX_LISTINGS) {
      throw new Error("Marketplace listing count is outside the supported range.");
    }

    const relevantListings = await readListingsForToken(client, totalListings, tokenId);
    const enhancedTransfers = await readAlchemyTransfers(rpcUrl, tokenId);
    const rows = enhancedTransfers
      ? buildEnhancedTimeline(enhancedTransfers, relevantListings)
      : buildStateTimeline(creator, owner, relevantListings);

    return Response.json({
      creator,
      owner,
      coverage: enhancedTransfers ? "transfer-history" : "marketplace-state",
      rows,
    }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45" } });
  } catch (error) {
    console.error("Provenance reconstruction failed", error);
    return Response.json({ error: "Provenance could not be reconstructed from Sepolia." }, { status: 502 });
  }
}

async function readListingsForToken(client: ReturnType<typeof createPublicClient>, totalListings: number, tokenId: bigint) {
  const relevant: Listing[] = [];
  for (let start = 1; start <= totalListings; start += LISTING_BATCH) {
    const end = Math.min(totalListings, start + LISTING_BATCH - 1);
    const calls = Array.from({ length: end - start + 1 }, (_, index) => ({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: "getListing" as const,
      args: [BigInt(start + index)] as const,
    }));
    const results = await client.multicall({ contracts: calls, allowFailure: true });
    for (const result of results) {
      if (result.status === "success") {
        const listing = result.result as Listing;
        if (listing.tokenId === tokenId && listing.nftContract.toLowerCase() === NFT_ADDRESS.toLowerCase()) relevant.push(listing);
      }
    }
  }
  return relevant.sort((a, b) => a.listedAt < b.listedAt ? -1 : a.listedAt > b.listedAt ? 1 : 0);
}

async function readAlchemyTransfers(rpcUrl: string, tokenId: bigint): Promise<Transfer[] | null> {
  const transfers: Transfer[] = [];
  let pageKey: string | undefined;

  try {
    for (let page = 0; page < MAX_TRANSFER_PAGES; page += 1) {
      const params: Record<string, unknown> = {
        fromBlock: process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ? `0x${BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK).toString(16)}` : "0x0",
        toBlock: "latest",
        contractAddresses: [NFT_ADDRESS],
        category: ["erc721"],
        excludeZeroValue: false,
        withMetadata: true,
        maxCount: "0x3e8",
      };
      if (pageKey) params.pageKey = pageKey;

      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: page + 1, method: "alchemy_getAssetTransfers", params: [params] }),
        cache: "no-store",
      });
      if (!response.ok) return null;
      const payload = await response.json() as { result?: { transfers?: Transfer[]; pageKey?: string }; error?: unknown };
      if (payload.error || !payload.result?.transfers) return null;

      transfers.push(...payload.result.transfers.filter((transfer) => transferTokenId(transfer) === tokenId));
      pageKey = payload.result.pageKey;
      if (!pageKey) break;
    }
    return transfers;
  } catch {
    return null;
  }
}

function buildEnhancedTimeline(transfers: Transfer[], listings: Listing[]): TimelineRow[] {
  const unusedListings = [...listings];
  return transfers
    .map((transfer, index) => {
      const from = (transfer.from ?? ZERO_ADDRESS).toLowerCase();
      const to = (transfer.to ?? ZERO_ADDRESS).toLowerCase();
      let label = "Ownership transfer";
      let detail = `${shortAddress(from)} → ${shortAddress(to)}`;

      if (from === zeroAddress.toLowerCase()) {
        label = "Minted";
        detail = `Created for ${shortAddress(to)}`;
      } else if (to === MARKETPLACE_ADDRESS.toLowerCase()) {
        label = "Listed / escrowed";
        const listing = unusedListings.find((item) => item.seller.toLowerCase() === from);
        detail = listing ? `Listing #${listing.id.toString()} · ${formatEth(listing.price)} ETH` : `Escrowed by ${shortAddress(from)}`;
      } else if (from === MARKETPLACE_ADDRESS.toLowerCase()) {
        const listingIndex = unusedListings.findIndex((item) => item.sold ? item.buyer.toLowerCase() === to : item.seller.toLowerCase() === to);
        const listing = listingIndex >= 0 ? unusedListings.splice(listingIndex, 1)[0] : undefined;
        if (listing?.sold) {
          label = "Sale settled";
          detail = `Listing #${listing.id.toString()} · ${formatEth(listing.price)} ETH · to ${shortAddress(to)}`;
        } else {
          label = "Listing cancelled";
          detail = listing ? `Listing #${listing.id.toString()} · returned to ${shortAddress(to)}` : `Returned to ${shortAddress(to)}`;
        }
      }

      return {
        key: transfer.hash ? `${transfer.hash}-${index}` : `transfer-${index}`,
        label,
        detail,
        block: transfer.blockNum ? BigInt(transfer.blockNum).toString() : undefined,
        timestamp: transfer.metadata?.blockTimestamp,
        hash: transfer.hash,
      };
    })
    .sort((a, b) => Number(BigInt(a.block ?? "0") - BigInt(b.block ?? "0")));
}

function buildStateTimeline(creator: string, owner: string, listings: Listing[]): TimelineRow[] {
  const rows: Array<TimelineRow & { order: bigint }> = [{
    key: "mint-state",
    label: "Minted",
    detail: `Creator ${shortAddress(creator)}`,
    order: 0n,
  }];

  for (const listing of listings) {
    rows.push({
      key: `listing-${listing.id}`,
      label: "Listed / escrowed",
      detail: `Listing #${listing.id.toString()} · ${formatEth(listing.price)} ETH · seller ${shortAddress(listing.seller)}`,
      timestamp: unixToIso(listing.listedAt),
      order: listing.listedAt,
    });
    if (listing.closedAt > 0n) {
      rows.push({
        key: `listing-close-${listing.id}`,
        label: listing.sold ? "Sale settled" : "Listing cancelled",
        detail: listing.sold ? `${shortAddress(listing.seller)} → ${shortAddress(listing.buyer)} · ${formatEth(listing.price)} ETH` : `Returned to ${shortAddress(listing.seller)}`,
        timestamp: unixToIso(listing.closedAt),
        order: listing.closedAt,
      });
    }
  }

  rows.push({
    key: "current-owner",
    label: "Current ownership",
    detail: `Held by ${shortAddress(owner)}`,
    order: (listings.at(-1)?.closedAt || listings.at(-1)?.listedAt || 0n) + 1n,
  });

  return rows.sort((a, b) => a.order < b.order ? -1 : a.order > b.order ? 1 : 0).map(({ order: _order, ...row }) => row);
}

function transferTokenId(transfer: Transfer) {
  const value = transfer.erc721TokenId ?? transfer.tokenId;
  if (!value) return -1n;
  try { return BigInt(value); } catch { return -1n; }
}

function unixToIso(value: bigint) {
  if (value <= 0n) return undefined;
  return new Date(Number(value) * 1000).toISOString();
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatEth(value: bigint) {
  const whole = value / 1_000_000_000_000_000_000n;
  const remainder = value % 1_000_000_000_000_000_000n;
  if (remainder === 0n) return whole.toString();
  const fraction = remainder.toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  return `${whole}.${fraction}`;
}
