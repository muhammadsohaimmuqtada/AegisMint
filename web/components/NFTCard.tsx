"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { nftAbi, type Listing } from "@/lib/contracts";
import { ipfsToHttp, shortAddress } from "@/lib/ipfs";

export type NFTMetadata = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type?: string; value?: string | number }>;
  creator?: string;
};

export function NFTCard({ listing, prefetchedMetadata }: { listing: Listing; prefetchedMetadata?: NFTMetadata | null }) {
  const { data: tokenUri } = useReadContract({
    address: listing.nftContract,
    abi: nftAbi,
    functionName: "tokenURI",
    args: [listing.tokenId],
    query: { enabled: prefetchedMetadata === undefined },
  });
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (prefetchedMetadata !== undefined || !tokenUri) return;

    fetch(ipfsToHttp(tokenUri))
      .then((response) => {
        if (!response.ok) throw new Error("Metadata unavailable");
        return response.json();
      })
      .then((json) => !cancelled && setMetadata(json))
      .catch(() => !cancelled && setMetadata(null));

    return () => {
      cancelled = true;
    };
  }, [prefetchedMetadata, tokenUri]);

  const resolvedMetadata = prefetchedMetadata !== undefined ? prefetchedMetadata : metadata;

  return (
    <Link className="nftCard" href={`/nft/${listing.tokenId}?listing=${listing.id}`}>
      <div className="nftMedia">
        {resolvedMetadata?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ipfsToHttp(resolvedMetadata.image)} alt={resolvedMetadata.name || `NFT #${listing.tokenId}`} />
        ) : (
          <div className="nftPlaceholder">AEGIS / {listing.tokenId.toString()}</div>
        )}
      </div>
      <div className="nftBody">
        <div className="nftTitleRow">
          <div>
            <span className="nftCollection">Work #{listing.tokenId.toString()}</span>
            <h3>{resolvedMetadata?.name || `Token #${listing.tokenId}`}</h3>
          </div>
          <span className="availableBadge">Listed</span>
        </div>
        <div className="nftPriceRow">
          <div>
            <span>Ask</span>
            <strong>{formatEther(listing.price)} ETH</strong>
          </div>
          <div className="sellerCell">
            <span>Seller</span>
            <strong>{shortAddress(listing.seller)}</strong>
          </div>
        </div>
      </div>
    </Link>
  );
}
