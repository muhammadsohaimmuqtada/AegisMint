import type { Metadata } from "next";
import "./globals.css";
import "./globals-extra.css";
import "./editorial.css";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "AegisMint — On-chain Art Market",
  description: "ERC-721 art market and ownership registry on Ethereum Sepolia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          {children}
          <footer className="siteFooter">
            <div className="brand footerBrand"><span className="brandMark">A</span><span>AegisMint</span></div>
            <p>Ethereum Sepolia · ERC-721 · IPFS</p>
            <span>Ownership on the record.</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
