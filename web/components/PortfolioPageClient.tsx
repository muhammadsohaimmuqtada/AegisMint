"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { MARKETPLACE_ADDRESS, NFT_ADDRESS } from "@/lib/contracts";
import { ProfileDashboard } from "@/components/ProfileDashboard";
import { WalletButton } from "@/components/WalletButton";

export function PortfolioPageClient() {
  const { isConnected } = useAccount();

  if (isConnected) return <ProfileDashboard />;

  return (
    <div className="portfolioLanding">
      <section className="portfolioLandingHero">
        <div className="portfolioLandingCopy">
          <span className="pageKicker">Portfolio · Ethereum Sepolia</span>
          <h1>Your collection,<br /><em>on-chain.</em></h1>
          <p>
            Connect the wallet you used with AegisMint to reconstruct holdings, active listings, acquisitions and completed sales directly from Sepolia ownership and marketplace events.
          </p>
          <div className="portfolioConnectRow">
            <WalletButton />
            <Link href="/resources" className="portfolioLearnLink">How portfolio data works <span>→</span></Link>
          </div>
        </div>

        <aside className="portfolioConnectionCard" aria-label="Portfolio connection status">
          <div className="portfolioConnectionTop">
            <span className="eyebrow">Connection</span>
            <span className="portfolioOffline"><i /> Wallet required</span>
          </div>
          <div className="portfolioWalletGlyph" aria-hidden="true">
            <svg viewBox="0 0 80 80">
              <rect x="13" y="20" width="54" height="40" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M13 31h45c6 0 9 3 9 9v7H49c-5 0-8-3-8-7s3-7 8-7h18" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="50" cy="40" r="2" fill="currentColor" />
            </svg>
          </div>
          <h2>Connect to read your market record.</h2>
          <p>No account database is required. AegisMint derives portfolio state from the deployed ERC-721 collection and marketplace contract.</p>
          <div className="portfolioContractRefs">
            <div><span>Collection</span><strong>{shortContract(NFT_ADDRESS)}</strong></div>
            <div><span>Marketplace</span><strong>{shortContract(MARKETPLACE_ADDRESS)}</strong></div>
          </div>
        </aside>
      </section>

      <section className="portfolioPreviewSection">
        <div className="portfolioPreviewHeading">
          <span className="sectionKicker">After connection</span>
          <h2>One wallet. Four market views.</h2>
          <p>Each view is reconstructed from contract state or historical marketplace events, not a hardcoded profile.</p>
        </div>

        <div className="portfolioPreviewGrid">
          <PortfolioPreviewCard number="01" label="Holdings" title="Current ownership" text="ERC-721 tokens currently owned by the connected wallet." />
          <PortfolioPreviewCard number="02" label="Listings" title="Active escrow" text="Works listed by the wallet and currently held by AegisMarketplace." />
          <PortfolioPreviewCard number="03" label="Acquisitions" title="Purchase history" text="Completed sales where the connected wallet was the buyer." />
          <PortfolioPreviewCard number="04" label="Sales" title="Seller history" text="Completed sales where the connected wallet was the seller, including settled volume." />
        </div>
      </section>

      <section className="portfolioAssurance">
        <span className="sectionKicker">Data provenance</span>
        <div>
          <strong>ERC-721 ownership</strong><span>ownerOf(tokenId)</span>
        </div>
        <div>
          <strong>Listings</strong><span>NFTListed events + getListing</span>
        </div>
        <div>
          <strong>Purchases & sales</strong><span>NFTSold events</span>
        </div>
        <div>
          <strong>Network</strong><span>Ethereum Sepolia · 11155111</span>
        </div>
      </section>
    </div>
  );
}

function PortfolioPreviewCard({ number, label, title, text }: { number: string; label: string; title: string; text: string }) {
  return (
    <article className="portfolioPreviewCard">
      <div><span>{number}</span><small>{label}</small></div>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="portfolioLocked">Connect to view</span>
    </article>
  );
}

function shortContract(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}
