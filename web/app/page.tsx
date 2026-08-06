import Link from "next/link";
import { ContractGate } from "@/components/ContractGate";
import { MarketplaceGrid } from "@/components/MarketplaceGrid";
import { MarketplaceStats } from "@/components/MarketplaceStats";

export default function Home() {
  return (
    <main>
      <section className="hero pageShell">
        <div className="heroCopy">
          <div className="heroBadge"><span /> Verified digital ownership on Sepolia</div>
          <h1>Collect art.<br /><em>Verify everything.</em></h1>
          <p>A security-first ERC-721 marketplace where every asset, listing, sale and ownership transition can be independently verified on-chain.</p>
          <div className="heroActions">
            <Link className="primaryButton" href="/explore">Explore marketplace</Link>
            <Link className="secondaryButton" href="/create">Create an NFT</Link>
          </div>
          <div className="heroProof">
            <span><i>✓</i> ERC-721</span>
            <span><i>✓</i> IPFS metadata</span>
            <span><i>✓</i> Escrow settlement</span>
            <span><i>✓</i> On-chain provenance</span>
          </div>
        </div>
        <div className="heroVisual" aria-hidden="true">
          <div className="heroOrb"><span className="orbCore">A</span><span className="orbit orbitOne" /><span className="orbit orbitTwo" /></div>
          <div className="floatingCard fcOne"><span>Integrity</span><strong>IPFS</strong><small>Content-addressed metadata</small></div>
          <div className="floatingCard fcTwo"><span>Standard</span><strong>ERC-721</strong><small>Verifiable ownership</small></div>
          <div className="floatingCard fcThree"><span>Network</span><strong>Sepolia</strong><small>Ethereum testnet</small></div>
        </div>
      </section>

      <section className="pageShell sectionBlock">
        <MarketplaceStats />
      </section>

      <section className="pageShell sectionBlock">
        <div className="sectionHeading splitHeading">
          <div><span className="eyebrow">Live marketplace</span><h2>Available now</h2></div>
          <Link href="/explore">View all →</Link>
        </div>
        <ContractGate><MarketplaceGrid limit={8} /></ContractGate>
      </section>

      <section className="pageShell sectionBlock trustStrip">
        <div><span className="eyebrow">The Aegis difference</span><h2>Trust is a feature you can inspect.</h2></div>
        <div className="featureGrid">
          <Feature n="01" title="On-chain provenance" text="Mint, listing, sale and ERC-721 transfer events form a reconstructable ownership trail." />
          <Feature n="02" title="IPFS integrity" text="Both digital assets and metadata are content-addressed with ipfs:// CIDs, not mutable database records." />
          <Feature n="03" title="Defensive settlement" text="Escrow, reentrancy protection, strict pricing and payout fallback protect marketplace state transitions." />
        </div>
      </section>
    </main>
  );
}

function Feature({ n, title, text }: { n: string; title: string; text: string }) {
  return <article className="featureCard"><span>{n}</span><h3>{title}</h3><p>{text}</p></article>;
}
