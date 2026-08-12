import type { Metadata } from "next";
import "./globals.css";
import "./globals-extra.css";
import "./editorial.css";
import "./premium-gallery.css";
import "./resources-portfolio.css";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "AegisMint — On-chain Art Marketplace",
  description: "A premium ERC-721 art marketplace and ownership registry on Ethereum Sepolia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          {children}
          <footer className="siteFooter">
            <div className="brand footerBrand">
              <span className="brandMark premiumBrandMark" aria-hidden="true">
                <svg viewBox="0 0 32 36">
                  <path d="M16 1.75 29 6.7v10.55c0 8.05-5.4 14.28-13 17C8.4 31.53 3 25.3 3 17.25V6.7L16 1.75Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m10.2 25 5.85-15 5.8 15M12.7 18.6h6.7" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
                </svg>
              </span>
              <span>AegisMint</span>
            </div>
            <p>Ethereum Sepolia · ERC-721 · IPFS · Verified contracts</p>
            <span>Verifiable ownership. Immutable provenance.</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
