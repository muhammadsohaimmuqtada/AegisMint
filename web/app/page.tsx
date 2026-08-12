import Link from "next/link";
import { ContractGate } from "@/components/ContractGate";
import { MarketplaceGrid } from "@/components/MarketplaceGrid";
import { MarketplaceStats } from "@/components/MarketplaceStats";

export default function Home() {
  return (
    <main>
      <section className="hero pageShell editorialHero">
        <div className="heroCopy">
          <span className="heroKicker">Digital ownership / Ethereum Sepolia</span>
          <h1>Art ownership.<br /><span className="quiet">On the record.</span></h1>
          <p>AegisMint is an ERC-721 market where artwork, ownership, listings and sales remain independently inspectable from the chain and IPFS.</p>
          <div className="heroActions">
            <Link className="primaryButton" href="/explore">Enter market</Link>
            <Link className="secondaryButton" href="/create">Mint work</Link>
          </div>
          <div className="heroProof">
            <span><i>●</i> ERC-721</span>
            <span><i>●</i> IPFS</span>
            <span><i>●</i> Escrow</span>
            <span><i>●</i> Provenance</span>
          </div>
        </div>

        <div className="heroFeature">
          <div className="heroFeatureHeader"><span>Currently listed</span><strong>Sepolia market</strong></div>
          <ContractGate><MarketplaceGrid limit={1} /></ContractGate>
        </div>
      </section>

      <section className="pageShell sectionBlock">
        <MarketplaceStats />
      </section>

      <section className="pageShell sectionBlock">
        <div className="sectionHeading splitHeading">
          <div><span className="sectionKicker">Market</span><h2>Available works</h2></div>
          <Link href="/explore">View market →</Link>
        </div>
        <ContractGate><MarketplaceGrid limit={6} /></ContractGate>
      </section>

      <section className="pageShell sectionBlock trustStrip">
        <div><span className="sectionKicker">Market structure</span><h2>The record matters as much as the object.</h2></div>
        <div className="featureGrid">
          <Feature n="01" title="Ownership history" text="Mint, transfer, listing and sale events form a public provenance trail for each token." />
          <Feature n="02" title="Content-addressed media" text="Artwork and metadata resolve from IPFS CIDs rather than mutable marketplace inventory." />
          <Feature n="03" title="Escrow settlement" text="Listings custody the token on-chain and settle exact-price purchases through the marketplace contract." />
        </div>
      </section>
    </main>
  );
}

function Feature({ n, title, text }: { n: string; title: string; text: string }) {
  return <article className="featureCard"><span>{n}</span><h3>{title}</h3><p>{text}</p></article>;
}
