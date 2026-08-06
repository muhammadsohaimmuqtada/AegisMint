import { ContractGate } from "@/components/ContractGate";
import { MarketplaceGrid } from "@/components/MarketplaceGrid";
import { MarketplaceStats } from "@/components/MarketplaceStats";

export default function ExplorePage() {
  return (
    <main className="pageShell innerPage">
      <div className="pageIntro"><span className="eyebrow">Explore / Sepolia</span><h1>Discover verified assets.</h1><p>Every card below is derived from live AegisMarketplace contract state. No hardcoded NFT inventory.</p></div>
      <MarketplaceStats />
      <div className="sectionHeading splitHeading exploreHeading"><div><span className="eyebrow">Active listings</span><h2>Marketplace</h2></div><span className="liveLabel"><i /> Live on-chain</span></div>
      <ContractGate><MarketplaceGrid limit={100} /></ContractGate>
    </main>
  );
}
