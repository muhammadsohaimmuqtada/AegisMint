import Link from "next/link";
import { MARKETPLACE_ADDRESS, NFT_ADDRESS } from "@/lib/contracts";

const deploymentBlock = process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || "—";

export default function ResourcesPage() {
  return (
    <main className="pageShell resourcePage">
      <section className="resourceHero">
        <div className="resourceHeroTitle">
          <span className="pageKicker">Resources · Protocol reference</span>
          <h1>Know exactly<br />what you own.</h1>
        </div>

        <div className="resourceHeroCopy">
          <p>
            AegisMint separates media, metadata, ownership and market settlement so every important layer can be independently inspected.
            This is the public reference for the live Sepolia deployment.
          </p>
          <nav className="resourceJumpNav" aria-label="Resource sections">
            <a href="#protocol">Protocol</a>
            <a href="#contracts">Contracts</a>
            <a href="#storage">Storage</a>
            <a href="#security">Security</a>
            <a href="#verification">Verification</a>
          </nav>
        </div>
      </section>

      <section className="resourceSection" id="protocol">
        <ResourceLabel number="01" label="Protocol" />
        <div className="resourceSectionBody">
          <span className="sectionKicker">System model</span>
          <h2>One work. Four independent records.</h2>
          <p className="resourceLead">
            The marketplace UI is a client, not the source of truth. Ownership and settlement live on-chain; artwork and metadata remain content-addressed on IPFS.
          </p>
          <div className="protocolFlow">
            <ResourceStep number="01" title="Publish" text="The artwork is uploaded to IPFS and receives an immutable content identifier." />
            <ResourceStep number="02" title="Mint" text="Metadata is pinned separately, and its ipfs:// URI is committed to the ERC-721 token." />
            <ResourceStep number="03" title="List" text="The owner approves AegisMarketplace and the NFT enters contract escrow at the seller-defined ETH price." />
            <ResourceStep number="04" title="Settle" text="The buyer pays the exact listing price; ownership transfers and seller proceeds settle on-chain." />
          </div>
        </div>
      </section>

      <section className="resourceSection" id="contracts">
        <ResourceLabel number="02" label="Contracts" />
        <div className="resourceSectionBody">
          <span className="sectionKicker">Live deployment</span>
          <h2>Ethereum Sepolia, publicly verifiable.</h2>
          <div className="registryTable">
            <RegistryRow label="Network" value="Ethereum Sepolia" />
            <RegistryRow label="Chain ID" value="11155111" mono />
            <RegistryRow label="Deployment block" value={deploymentBlock} mono />
            <RegistryRow label="ERC-721 collection" value={NFT_ADDRESS} mono href={`https://sepolia.etherscan.io/address/${NFT_ADDRESS}#code`} />
            <RegistryRow label="Marketplace" value={MARKETPLACE_ADDRESS} mono href={`https://sepolia.etherscan.io/address/${MARKETPLACE_ADDRESS}#code`} />
            <RegistryRow label="Marketplace fee" value="2.50%" />
          </div>
        </div>
      </section>

      <section className="resourceSection" id="storage">
        <ResourceLabel number="03" label="Storage" />
        <div className="resourceSectionBody">
          <span className="sectionKicker">IPFS architecture</span>
          <h2>Content-addressed by design.</h2>
          <div className="resourceColumns">
            <article>
              <span className="resourceOrdinal">A</span>
              <h3>Artwork CID</h3>
              <p>The original asset is pinned first. Its CID identifies the content itself rather than a mutable application database record.</p>
            </article>
            <article>
              <span className="resourceOrdinal">B</span>
              <h3>Metadata CID</h3>
              <p>Name, description, attributes and the artwork&apos;s ipfs:// URI are published as JSON under a separate CID.</p>
            </article>
            <article>
              <span className="resourceOrdinal">C</span>
              <h3>Token URI</h3>
              <p>The ERC-721 contract stores the metadata ipfs:// URI. The web client only resolves it through a gateway for display.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="resourceSection" id="security">
        <ResourceLabel number="04" label="Security" />
        <div className="resourceSectionBody">
          <span className="sectionKicker">Market invariants</span>
          <h2>Designed for adversarial behavior.</h2>
          <div className="securityGrid">
            <SecurityItem title="Canonical collection" text="Marketplace listings are restricted to the deployed AegisMint ERC-721 collection." />
            <SecurityItem title="Escrow custody" text="Listed NFTs are held by the marketplace contract until purchase or seller cancellation." />
            <SecurityItem title="Exact payment" text="Purchases reject underpayment and overpayment; the listing price is the settlement amount." />
            <SecurityItem title="Deferred proceeds" text="A seller that rejects direct ETH cannot block a completed sale; proceeds can be recorded for withdrawal." />
            <SecurityItem title="Fee snapshot" text="The marketplace fee is captured when a listing is created and capped by the contract." />
            <SecurityItem title="Unsolicited transfer guard" text="Unexpected safe NFT transfers into marketplace custody are rejected." />
          </div>
        </div>
      </section>

      <section className="resourceSection resourceVerification" id="verification">
        <ResourceLabel number="05" label="Verification" />
        <div className="resourceSectionBody">
          <span className="sectionKicker">Independent inspection</span>
          <h2>Verify without trusting this website.</h2>
          <p className="resourceLead">
            The deployed Solidity source is verified publicly. Contract state, transaction history, ownership and events remain inspectable even if the AegisMint frontend is unavailable.
          </p>
          <div className="verificationActions">
            <a className="premiumPrimary" href={`https://sepolia.etherscan.io/address/${NFT_ADDRESS}#code`} target="_blank" rel="noreferrer">ERC-721 on Etherscan <span>↗</span></a>
            <a className="premiumSecondary" href={`https://sepolia.etherscan.io/address/${MARKETPLACE_ADDRESS}#code`} target="_blank" rel="noreferrer">Marketplace on Etherscan <span>↗</span></a>
            <Link className="premiumSecondary" href="/explore">Open live market <span>→</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function ResourceLabel({ number, label }: { number: string; label: string }) {
  return <div className="resourceSectionLabel"><span>{number}</span><p>{label}</p></div>;
}

function ResourceStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article className="resourceStep">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function RegistryRow({ label, value, mono = false, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  return (
    <div className="registryRow">
      <span>{label}</span>
      {href ? <a className={mono ? "monoValue" : ""} href={href} target="_blank" rel="noreferrer">{value}<b>↗</b></a> : <strong className={mono ? "monoValue" : ""}>{value}</strong>}
    </div>
  );
}

function SecurityItem({ title, text }: { title: string; text: string }) {
  return <article className="securityItem"><i aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></article>;
}
