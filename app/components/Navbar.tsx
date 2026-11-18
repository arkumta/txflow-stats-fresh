"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { label: "Overview", href: "/" },
  { label: "Markets", href: "/markets" },
  { label: "Screener", href: "/screener" },
  { label: "Traders", href: "/traders" },
  { label: "Positions", href: "/positions" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Tools", href: "/fees" },
  { label: "Point Calculator", href: "https://perppoints.com/", external: true },
];

function NavbarContent() {
  const pathname = usePathname();
  const [wallet, setWallet] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = wallet.trim();
    if (!query) {
      setSearchError("Enter a wallet address to search.");
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const response = await fetch(`/api/search-traders?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error("Search failed");
      const matches: string[] = result.traders ?? [];
      if (matches.length === 0) {
        setSearchError("No matching trader found.");
        return;
      }
      if (matches.length > 1) {
        setSearchError("Multiple matches. Enter more of the wallet address.");
        return;
      }
      window.location.href = `/traders/${encodeURIComponent(matches[0])}`;
    } catch {
      setSearchError("Unable to search. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <header className="txflow-header">
      <nav className="txflow-navbar" aria-label="Main navigation">
        <a href="/" className="txflow-brand" aria-label="Txflow Stats home">
          <span className="txflow-brand-mark">T</span>
          <span className="txflow-brand-copy">
            <span className="txflow-brand-title">TXFLOW <span>STATS</span></span>
            <span className="txflow-brand-subtitle">PERPETUALS ANALYTICS</span>
          </span>
        </a>

        <button
          type="button"
          className="txflow-mobile-toggle"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span /><span />
        </button>

        <div className={`txflow-nav-content${menuOpen ? " txflow-nav-content-open" : ""}`}>
          <div className="txflow-nav-links">
            {links.map((link) => {
              const active = link.external
                ? false
                : link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className={`txflow-nav-link${active ? " txflow-nav-link-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          <div className="txflow-nav-actions">
            <form className="txflow-wallet-search" onSubmit={handleSearch}>
              <span className="txflow-search-icon" aria-hidden="true">⌕</span>
              <input
                aria-label="Search trader wallet"
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="Search wallet address"
              />
              <button type="submit" disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </button>
              {searchError && <span className="txflow-search-error" role="alert">{searchError}</span>}
            </form>
            <a className="txflow-join-button" href="https://app.txflow.com/" target="_blank" rel="noopener noreferrer">
              Trade on Txflow <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<header className="txflow-header"><nav className="txflow-navbar"><a href="/" className="txflow-brand"><span className="txflow-brand-mark">T</span><span className="txflow-brand-title">TXFLOW <span>STATS</span></span></a></nav></header>}>
      <NavbarContent />
    </Suspense>
  );
}
