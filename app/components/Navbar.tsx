
"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { label: "Overview", href: "/" },
  { label: "Markets", href: "/markets" },
  { label: "Traders", href: "/traders" },
  { label: "Fees", href: "/fees" },
];

function NavbarContent() {
  const pathname = usePathname();

  const [wallet, setWallet] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  async function handleSearch(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query = wallet.trim();

    if (!query) {
      setSearchError("Enter a wallet address to search.");
      return;
    }

    setSearching(true);
    setSearchError("");

    try {
      const response = await fetch(
        `/api/search-traders?q=${encodeURIComponent(query)}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error("Search failed");
      }

      const matches: string[] = result.traders ?? [];

      if (matches.length === 0) {
        setSearchError("No matching trader found.");
        return;
      }

      if (matches.length > 1) {
        setSearchError(
          "Multiple matches. Enter more of the wallet address."
        );
        return;
      }

      window.location.href =
        `/traders/${encodeURIComponent(matches[0])}`;
    } catch {
      setSearchError("Unable to search. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <nav className="txflow-navbar">
      <a href="/" className="txflow-brand">
        <span className="txflow-brand-mark">T</span>

        <span>
          <span className="txflow-brand-title">
            TXFLOW <span>STATS</span>
          </span>

          <span className="txflow-brand-subtitle">
            PERPETUALS ANALYTICS
          </span>
        </span>
      </a>

      <div className="txflow-nav-links">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href ||
                pathname.startsWith(`${link.href}/`);

          return (
            <a
              key={link.href}
              href={link.href}
              className={`txflow-nav-link${
                active ? " txflow-nav-link-active" : ""
              }`}
              aria-current={active ? "page" : undefined}
              style={
                active
                  ? {
                      color: "#c5f66b",
                      background: "#1a2410",
                      borderRadius: 8,
                    }
                  : undefined
              }
            >
              {link.label}
            </a>
          );
        })}
      </div>

      <div className="txflow-nav-actions">
        <form
          className="txflow-wallet-search"
          onSubmit={handleSearch}
        >
          <input
            aria-label="Search trader wallet"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="Search wallet address..."
          />

          <button type="submit" disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>

          {searchError && (
            <span className="txflow-search-error" role="alert">
              {searchError}
            </span>
          )}
        </form>

        <a
          className="txflow-join-button"
          href="https://app.txflow.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Join TxFlow <span aria-hidden="true">↗</span>
        </a>
      </div>
    </nav>
  );
}

export default function Navbar() {
  return (
    <Suspense
      fallback={
        <nav className="txflow-navbar">
          <a href="/" className="txflow-brand">
            <span className="txflow-brand-mark">T</span>
            <span className="txflow-brand-title">
              TXFLOW <span>STATS</span>
            </span>
          </a>
        </nav>
      }
    >
      <NavbarContent />
    </Suspense>
  );
}
