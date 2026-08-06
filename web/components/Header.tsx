import Link from "next/link";
import { WalletButton } from "./WalletButton";

export function Header() {
  return (
    <header className="siteHeader">
      <Link href="/" className="brand" aria-label="AegisMint home">
        <span className="brandMark">A</span>
        <span>AegisMint</span>
      </Link>
      <nav className="navLinks" aria-label="Primary navigation">
        <Link href="/explore">Explore</Link>
        <Link href="/create">Create</Link>
        <Link href="/profile">Dashboard</Link>
      </nav>
      <WalletButton />
    </header>
  );
}
