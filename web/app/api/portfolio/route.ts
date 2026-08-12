import { createPublicClient, http, isAddress } from "viem";
import { sepolia } from "viem/chains";
import {
  MARKETPLACE_ADDRESS,
  NFT_ADDRESS,
  ZERO_ADDRESS,
  marketplaceAbi,
  nftAbi,
  type Listing,
} from "@/lib/contracts";

const OWNER_SCAN_CHUNK = 64;
const MAX_TOKEN_SCAN = 5_000;
const LISTING_BATCH = 100;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address") ?? "";

  if (!isAddress(address)) {
    return Response.json({ error: "A valid wallet address is required." }, { status: 400 });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  if (!rpcUrl || NFT_ADDRESS === ZERO_ADDRESS || MARKETPLACE_ADDRESS === ZERO_ADDRESS) {
    return Response.json({ error: "The Sepolia deployment is not configured." }, { status: 503 });
  }

  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const normalizedAddress = address.toLowerCase();

  try {
    const [stats, pendingProceeds] = await Promise.all([
      client.readContract({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "marketplaceStats" }),
      client.readContract({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "pendingProceeds", args: [address] }),
    ]);

    const totalListings = Number(stats[0]);
    if (!Number.isSafeInteger(totalListings) || totalListings < 0 || totalListings > 100_000) {
      throw new Error("Marketplace listing count is outside the supported range.");
    }

    const listings: Listing[] = [];
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
        if (result.status === "success") listings.push(result.result as Listing);
      }
    }

    const owned: bigint[] = [];
    let reachedEnd = false;
    for (let start = 1; start <= MAX_TOKEN_SCAN && !reachedEnd; start += OWNER_SCAN_CHUNK) {
      const end = Math.min(MAX_TOKEN_SCAN, start + OWNER_SCAN_CHUNK - 1);
      const calls = Array.from({ length: end - start + 1 }, (_, index) => ({
        address: NFT_ADDRESS,
        abi: nftAbi,
        functionName: "ownerOf" as const,
        args: [BigInt(start + index)] as const,
      }));
      const results = await client.multicall({ contracts: calls, allowFailure: true });

      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        const tokenId = BigInt(start + index);
        if (result.status === "failure") {
          reachedEnd = true;
          break;
        }
        const owner = String(result.result).toLowerCase();
        if (owner === normalizedAddress) owned.push(tokenId);
      }
    }

    const activeListings = listings.filter((listing) => listing.active && listing.seller.toLowerCase() === normalizedAddress);
    const purchased = listings
      .filter((listing) => listing.sold && listing.buyer.toLowerCase() === normalizedAddress)
      .map((listing) => ({ listingId: listing.id, tokenId: listing.tokenId, price: listing.price }));
    const sold = listings
      .filter((listing) => listing.sold && listing.seller.toLowerCase() === normalizedAddress)
      .map((listing) => ({ listingId: listing.id, tokenId: listing.tokenId, price: listing.price }));
    const salesVolume = sold.reduce((sum, sale) => sum + sale.price, 0n);

    return Response.json({
      owned: owned.map(String),
      activeListings: activeListings.map(serializeListing),
      purchased: purchased.map(serializeSale),
      sold: sold.map(serializeSale),
      salesVolume: salesVolume.toString(),
      pendingProceeds: pendingProceeds.toString(),
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Portfolio reconstruction failed", error);
    return Response.json({ error: "Portfolio state could not be reconstructed from Sepolia." }, { status: 502 });
  }
}

function serializeListing(listing: Listing) {
  return {
    ...listing,
    id: listing.id.toString(),
    tokenId: listing.tokenId.toString(),
    feeBps: listing.feeBps.toString(),
    price: listing.price.toString(),
    listedAt: listing.listedAt.toString(),
    closedAt: listing.closedAt.toString(),
  };
}

function serializeSale(sale: { listingId: bigint; tokenId: bigint; price: bigint }) {
  return {
    listingId: sale.listingId.toString(),
    tokenId: sale.tokenId.toString(),
    price: sale.price.toString(),
  };
}
