"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { contractsConfigured } from "@/lib/contracts";

type Activity = {
  key: string;
  label: string;
  detail: string;
  block?: string;
  timestamp?: string;
  hash?: string;
};

type ProvenancePayload = {
  coverage?: "transfer-history" | "marketplace-state";
  rows?: Activity[];
  error?: string;
};

export function ProvenancePanel({ nftContract: _nftContract, tokenId }: { nftContract: Address; tokenId: bigint }) {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [coverage, setCoverage] = useState<"transfer-history" | "marketplace-state">("marketplace-state");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    if (!contractsConfigured) {
      setLoading(false);
      return () => controller.abort();
    }

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/provenance?tokenId=${tokenId.toString()}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as ProvenancePayload;
        if (!response.ok) throw new Error(payload.error || "Provenance could not be loaded.");
        if (!controller.signal.aborted) {
          setActivity(payload.rows ?? []);
          setCoverage(payload.coverage ?? "marketplace-state");
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Provenance could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [tokenId]);

  return (
    <section className="trustPanel provenancePanel">
      <div className="sectionHeading compactHeading provenanceHeading">
        <div>
          <span className="eyebrow">Provenance</span>
          <h2>Ownership history</h2>
        </div>
        {!loading && !error ? <span className="coverageBadge">{coverage === "transfer-history" ? "ERC-721 transfers" : "Market state"}</span> : null}
      </div>

      {loading ? <div className="timelineSkeleton" aria-busy="true"><span /><span /><span /></div> : null}
      {error ? <div className="provenanceError"><strong>History temporarily unavailable</strong><p>{error}</p></div> : null}
      {!loading && !error && !activity.length ? <p className="muted">No provenance records were returned for this token.</p> : null}

      <div className="timeline">
        {activity.map((item) => (
          <div className="timelineItem" key={item.key}>
            <span className="timelineDot" />
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
              <span className="timelineMeta">
                {item.block ? `Block ${item.block}` : item.timestamp ? formatTimestamp(item.timestamp) : "On-chain state"}
                {item.hash ? <a href={`https://sepolia.etherscan.io/tx/${item.hash}`} target="_blank" rel="noreferrer">Transaction ↗</a> : null}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!loading && !error && coverage === "marketplace-state" ? (
        <p className="coverageNote">Marketplace lifecycle and current ownership are canonical. Enhanced ERC-721 transfer history was unavailable from the configured RPC for this request.</p>
      ) : null}
    </section>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "On-chain event";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
