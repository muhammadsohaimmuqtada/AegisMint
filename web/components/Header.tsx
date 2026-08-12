"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WalletButton } from "./WalletButton";

const primaryLinks = [
  { href: "/explore", label: "Market" },
  { href: "/create", label: "Create" },
  { href: "/profile", label: "Portfolio" },
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const resourceRef = useRef<HTMLDetailsElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    if (resourceRef.current) resourceRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const compact = window.matchMedia("(max-width: 1050px)").matches;
        if (compact) {
          setMobileOpen(true);
          window.setTimeout(() => mobileSearchRef.current?.focus(), 0);
        } else {
          desktopSearchRef.current?.focus();
        }
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        if (resourceRef.current) resourceRef.current.open = false;
        desktopSearchRef.current?.blur();
        mobileSearchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get("q") || "").trim();
    setMobileOpen(false);
    router.push(query ? `/explore?q=${encodeURIComponent(query)}` : "/explore");
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

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
        {primaryLinks.map((link) => (
          <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? "page" : undefined}>{link.label}</Link>
        ))}
        <details className="resourceMenu" ref={resourceRef}>
          <summary aria-label="Open resources menu">Resources <span aria-hidden="true">⌄</span></summary>
          <div className="resourceMenuPanel">
            <Link href="/resources"><strong>Resource index</strong><small>Protocol reference</small></Link>
            <Link href="/resources#protocol"><strong>Protocol</strong><small>Mint → list → settle</small></Link>
            <Link href="/resources#contracts"><strong>Contracts</strong><small>Live Sepolia deployment</small></Link>
            <Link href="/resources#storage"><strong>Storage</strong><small>IPFS asset + metadata</small></Link>
            <Link href="/resources#security"><strong>Security</strong><small>Marketplace invariants</small></Link>
          </div>
        </details>
      </nav>

      <form className="headerSearch" onSubmit={runSearch} role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input ref={desktopSearchRef} name="q" aria-label="Search marketplace" placeholder="Search artworks, token ID…" autoComplete="off" />
        <kbd>⌘K</kbd>
      </form>

      <div className="headerActions">
        <Link className="headerTextLink" href="/#market-activity">Stats</Link>
        <Link className="headerTextLink" href="/resources">About</Link>
        <WalletButton />
        <button
          type="button"
          className="mobileMenuButton"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
        >
          <span /><span />
        </button>
      </div>

      <div className={`mobileNavPanel ${mobileOpen ? "open" : ""}`} aria-hidden={!mobileOpen}>
        <form className="mobileHeaderSearch" onSubmit={runSearch} role="search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input ref={mobileSearchRef} name="q" aria-label="Search marketplace" placeholder="Search artworks, token ID, seller…" autoComplete="off" />
        </form>
        <nav aria-label="Mobile navigation">
          {primaryLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}<span>→</span></Link>)}
          <Link href="/resources">Resources<span>→</span></Link>
          <Link href="/#market-activity">Market stats<span>→</span></Link>
        </nav>
      </div>
    </header>
  );
}
