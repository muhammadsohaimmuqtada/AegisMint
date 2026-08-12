import { ContractGate } from "@/components/ContractGate";
import { MarketplaceGrid } from "@/components/MarketplaceGrid";
import { MarketplaceStats } from "@/components/MarketplaceStats";

export default function ExplorePage() {
  return (
    <main className="pageShell innerPage">
      <div className="pageIntro">
        <span className="pageKicker">Market / Ethereum Sepolia</span>
        <h1>Available works.</h1>
        <p>Live listings from the AegisMint marketplace contract. Prices, sellers and ownership state are read directly from Sepolia.</p>
      </div>
      <MarketplaceStats />
      <div className="sectionHeading splitHeading exploreHeading">
        <div><span className="sectionKicker">Active listings</span><h2>Market</h2></div>
        <span className="liveLabel"><i /> On-chain</span>
      </div>
      <ContractGate><MarketplaceGrid limit={100} /></ContractGate>
    </main>
  );
}
