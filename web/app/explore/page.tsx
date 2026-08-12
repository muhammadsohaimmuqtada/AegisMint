import { ContractGate } from "@/components/ContractGate";
import { MarketplaceGrid } from "@/components/MarketplaceGrid";
import { MarketplaceStats } from "@/components/MarketplaceStats";

export default function ExplorePage() {
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
          <span className="sectionKicker">Available now</span>
          <h2>Live works</h2>
        </div>
        <span className="liveLabel"><i /> Live on-chain</span>
      </div>

      <ContractGate><MarketplaceGrid limit={100} /></ContractGate>
    </main>
  );
}
