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

export function NFTCard({ listing }: { listing: Listing }) {
  const { data: tokenUri } = useReadContract({
    address: listing.nftContract,
    abi: nftAbi,
    functionName: "tokenURI",
    args: [listing.tokenId],
  });
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tokenUri) return;

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
  }, [tokenUri]);

  return (
    <Link className="nftCard" href={`/nft/${listing.tokenId}?listing=${listing.id}`}>
      <div className="nftMedia">
        {metadata?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ipfsToHttp(metadata.image)} alt={metadata.name || `NFT #${listing.tokenId}`} />
        ) : (
          <div className="nftPlaceholder">AEGIS / {listing.tokenId.toString()}</div>
        )}
        <span className="verifiedBadge">On-chain</span>
      </div>
      <div className="nftBody">
        <div className="nftTitleRow">
          <div>
            <span className="nftCollection">AegisMint</span>
            <h3>{metadata?.name || `Token #${listing.tokenId}`}</h3>
          </div>
          <span className="availableBadge">Available</span>
        </div>
        <div className="nftPriceRow">
          <div>
            <span>Price</span>
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
