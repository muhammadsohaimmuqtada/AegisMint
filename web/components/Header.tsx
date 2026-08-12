import Link from "next/link";
import { WalletButton } from "./WalletButton";

export function Header() {
  return (
    <header className="siteHeader premiumHeader">
      <Link href="/" className="brand premiumBrand" aria-label="AegisMint home">
        <span className="brandMark premiumBrandMark" aria-hidden="true">
          <svg viewBox="0 0 32 36" role="img">
            <path d="M16 1.75 29 6.7v10.55c0 8.05-5.4 14.28-13 17C8.4 31.53 3 25.3 3 17.25V6.7L16 1.75Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.2 25 5.85-15 5.8 15M12.7 18.6h6.7" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
          </svg>
        </span>
        <span>AegisMint</span>
      </Link>

      <nav className="navLinks premiumNav" aria-label="Primary navigation">
        <Link href="/explore">Market</Link>
        <Link href="/create">Create</Link>
        <Link href="/profile">Portfolio</Link>
        <Link href="/#protocol">Resources <span aria-hidden="true">⌄</span></Link>
      </nav>

      <form className="headerSearch" action="/explore" role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input name="q" aria-label="Search marketplace" placeholder="Search artworks, token ID…" />
        <kbd>⌘K</kbd>
      </form>

      <div className="headerActions">
        <Link className="headerTextLink" href="/#market-activity">Stats</Link>
        <Link className="headerTextLink" href="/#protocol">About</Link>
        <WalletButton />
        <span className="themeGlyph" aria-hidden="true">◔</span>
      </div>
    </header>
  );
}
