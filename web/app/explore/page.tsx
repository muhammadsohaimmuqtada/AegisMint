import Link from "next/link";
import { ContractGate } from "@/components/ContractGate";
import { MarketplaceGrid } from "@/components/MarketplaceGrid";
import { MarketplaceStats } from "@/components/MarketplaceStats";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? (params.q[0] ?? "") : (params.q ?? "");
  const normalizedQuery = query.trim();

  return (
    <main className="pageShell innerPage premiumMarketPage">
      <div className="pageIntro premiumPageIntro">
        <span className="pageKicker">Market · Ethereum Sepolia</span>
        <h1>Collect what can<br />be verified.</h1>
        <p>Every work below is an active listing from the AegisMarketplace contract. Price, seller, custody and ownership state are read directly from Sepolia.</p>
      </div>

      <MarketplaceStats />

      <div className="sectionHeading splitHeading exploreHeading">
        <div>
          <span className="sectionKicker">{normalizedQuery ? "Search results" : "Available now"}</span>
          <h2>{normalizedQuery ? `“${normalizedQuery}”` : "Live works"}</h2>
        </div>
        {normalizedQuery ? <Link className="marketClearLink" href="/explore">Clear search ×</Link> : <span className="liveLabel"><i /> Live on-chain</span>}
      </div>

      <ContractGate><MarketplaceGrid limit={100} query={normalizedQuery} /></ContractGate>
    </main>
  );
}
