import type { Metadata } from "next";
import "./globals.css";
import "./globals-extra.css";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "AegisMint — Verified NFT Marketplace",
  description: "Security-first ERC-721 marketplace on Ethereum Sepolia with IPFS provenance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="ambient ambientOne" />
          <div className="ambient ambientTwo" />
          <Header />
          {children}
          <footer className="siteFooter">
            <div className="brand footerBrand"><span className="brandMark">A</span><span>AegisMint</span></div>
            <p>ERC-721 ownership. IPFS metadata. Sepolia settlement. Verifiable by design.</p>
            <span>Built for transparent digital ownership.</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
