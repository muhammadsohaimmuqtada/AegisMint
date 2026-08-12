"use client";

import { useEffect, useState } from "react";
import { parseAbiItem, zeroAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { MARKETPLACE_ADDRESS, contractsConfigured } from "@/lib/contracts";
import { shortAddress } from "@/lib/ipfs";
import { getLogsInChunks } from "@/lib/logs";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");
const listedEvent = parseAbiItem("event NFTListed(uint256 indexed listingId, address indexed nftContract, uint256 indexed tokenId, address seller, uint256 price)");
const soldEvent = parseAbiItem("event NFTSold(uint256 indexed listingId, address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price, uint256 marketplaceFee)");
const cancelledEvent = parseAbiItem("event ListingCancelled(uint256 indexed listingId, address indexed nftContract, uint256 indexed tokenId, address seller)");

type Activity = {
  key: string;
  block: bigint;
  label: string;
  detail: string;
};

export function ProvenancePanel({ nftContract, tokenId }: { nftContract: Address; tokenId: bigint }) {
  const client = usePublicClient();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!client || !contractsConfigured) return;

    const publicClient = client;
    const deploymentBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || "0");

    async function load() {
      setLoading(true);
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const [transfers, listings, sales, cancellations] = await Promise.all([
          getLogsInChunks(deploymentBlock, latestBlock, (start, end) =>
            publicClient.getLogs({ address: nftContract, event: transferEvent, args: { tokenId }, fromBlock: start, toBlock: end }),
          ),
          getLogsInChunks(deploymentBlock, latestBlock, (start, end) =>
            publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: listedEvent, args: { nftContract, tokenId }, fromBlock: start, toBlock: end }),
          ),
          getLogsInChunks(deploymentBlock, latestBlock, (start, end) =>
            publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: soldEvent, args: { nftContract, tokenId }, fromBlock: start, toBlock: end }),
          ),
          getLogsInChunks(deploymentBlock, latestBlock, (start, end) =>
            publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: cancelledEvent, args: { nftContract, tokenId }, fromBlock: start, toBlock: end }),
          ),
        ]);

        const rows: Activity[] = [];
        for (const log of transfers) {
          const from = log.args.from;
          const to = log.args.to;
          rows.push({
            key: `${log.transactionHash}-transfer-${log.logIndex}`,
            block: log.blockNumber,
            label: from === zeroAddress ? "Minted" : "Ownership transfer",
            detail: from === zeroAddress ? `Created by ${shortAddress(to)}` : `${shortAddress(from)} → ${shortAddress(to)}`,
          });
        }
        for (const log of listings) {
          rows.push({
            key: `${log.transactionHash}-listed-${log.logIndex}`,
            block: log.blockNumber,
            label: "Listed",
            detail: `Listing #${log.args.listingId?.toString()} created by ${shortAddress(log.args.seller)}`,
          });
        }
        for (const log of sales) {
          rows.push({
            key: `${log.transactionHash}-sold-${log.logIndex}`,
            block: log.blockNumber,
            label: "Sold",
            detail: `${shortAddress(log.args.seller)} → ${shortAddress(log.args.buyer)}`,
          });
        }
        for (const log of cancellations) {
          rows.push({
            key: `${log.transactionHash}-cancel-${log.logIndex}`,
            block: log.blockNumber,
            label: "Listing cancelled",
            detail: `Returned to ${shortAddress(log.args.seller)}`,
          });
        }

        rows.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
        if (!cancelled) setActivity(rows);
      } catch {
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [client, nftContract, tokenId]);

  return (
    <section className="trustPanel">
      <div className="sectionHeading compactHeading">
        <span className="eyebrow">On-chain provenance</span>
        <h2>Immutable activity trail</h2>
      </div>
      {loading ? <p className="muted">Reading contract events…</p> : null}
      {!loading && !activity.length ? <p className="muted">No event history returned by the configured RPC.</p> : null}
      <div className="timeline">
        {activity.map((item) => (
          <div className="timelineItem" key={item.key}>
            <span className="timelineDot" />
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
              <span>Block {item.block.toString()}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
