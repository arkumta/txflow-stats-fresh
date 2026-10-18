
"use client";

import PnlLeaderboard from "./components/PnlLeaderboard";
import PnlCards from "./components/PnlCards";
import VolumeChart from "./components/VolumeChart";
import MarketsTable from "./components/MarketsTable";
import { useEffect, useState } from "react";

type Overview = {
  volume_24h?: number | string | null;
  open_interest?: number | string | null;
};

type Trader = {
  wallet: string;
  trade_count: number;
  trading_volume: number;
  last_active: string;
};

function compactUsd(value: number | string | null | undefined) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function usd(value: number | string | null | undefined) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return "Loading…";
  }

  return `$${Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
}

export default function Home() {
  const [market, setMarket] = useState<any>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trades24h, setTrades24h] = useState<number | null>(null);
  const [activeTraders24h, setActiveTraders24h] = useState<number | null>(
    null
  );

  const [traders, setTraders] = useState<Trader[]>([]);
  const [tradersLoading, setTradersLoading] = useState(true);
  const [tradersError, setTradersError] = useState("");
  const [period, setPeriod] = useState(24);
  const [sort, setSort] = useState<"volume" | "trades">("volume");

  useEffect(() => {
    const controller = new AbortController();

    async function loadMarket() {
      try {
        const response = await fetch("/api/markets", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Failed to load market price");

        setMarket(await response.json());
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          console.error("Market fetch failed:", error);
        }
      }
    }

    loadMarket();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      try {
        const [overviewResponse, tradesResponse] = await Promise.all([
          fetch("/api/overview", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/trades-stats", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const overviewResult = await overviewResponse.json();
        const tradesResult = await tradesResponse.json();

        if (!overviewResponse.ok || !overviewResult.success) {
          throw new Error(
            overviewResult.error || "Failed to load overview"
          );
        }

        if (!tradesResponse.ok || !tradesResult.success) {
          throw new Error(
            tradesResult.error || "Failed to load trade statistics"
          );
        }

        setOverview(
          Array.isArray(overviewResult.data)
            ? overviewResult.data[0] ?? null
            : null
        );

        setTrades24h(Number(tradesResult.trades_24h) || 0);
        setActiveTraders24h(
          Number(tradesResult.active_traders_24h) || 0
        );
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          console.error("Overview stats failed:", error);
        }
      }
    }

    loadStats();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTraders() {
      setTradersLoading(true);
      setTradersError("");

      try {
        const response = await fetch(
          `/api/traders?hours=${period}&limit=10&sort=${sort}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Unable to load traders.");
        }

        if (!Array.isArray(result.traders)) {
          throw new Error("Invalid trader data returned by the API.");
        }

        setTraders(result.traders);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setTradersError(
          error instanceof Error
            ? error.message
            : "Could not load traders. Please try again."
        );
      } finally {
        if (!controller.signal.aborted) setTradersLoading(false);
      }
    }

    loadTraders();

    return () => controller.abort();
  }, [period, sort]);

  const stats = [
    {
      title: "24H VOLUME",
      value: overview ? compactUsd(overview.volume_24h) : "Loading…",
      detail: "Across Txflow markets",
      icon: "↗",
    },
    {
      title: "OPEN INTEREST",
      value: overview ? compactUsd(overview.open_interest) : "Loading…",
      detail: "Current open positions",
      icon: "◈",
    },
    {
      title: "ACTIVE TRADERS",
      value:
        activeTraders24h == null
          ? "Loading…"
          : activeTraders24h.toLocaleString("en-US"),
      detail: "Wallets active in 24h",
      icon: "◎",
    },
    {
      title: "24H TRADES",
      value:
        trades24h == null
          ? "Loading…"
          : trades24h.toLocaleString("en-US"),
      detail: "Recorded executions",
      icon: "⌁",
    },
  ];

  return (
    <main className="home-page">
      {/* The duplicate Navbar has been removed.
          app/layout.tsx already renders the shared Navbar. */}

      <div className="home-shell">
        <section className="home-hero" id="overview">
          <div className="home-hero-copy">
            <div className="home-eyebrow">
              <span className="home-live-dot" />
              TXFLOW PERPETUALS
              <span className="home-eyebrow-divider">/</span>
              MARKET INTELLIGENCE
            </div>

            <h1>
              See the market.
              <br />
              <span>Read the flow.</span>
            </h1>

            <p>
              Real-time market activity, trader performance, and historical
              analytics for Txflow Perpetuals.
            </p>

            <div className="home-hero-meta">
              <span className="home-status-pill">
                <span className="home-live-dot" />
                Live market data
              </span>
              <span className="home-meta-separator" />
              On-chain trading insights
            </div>
          </div>

          <div className="home-price-card">
            <div className="home-price-card-top">
              <span className="home-price-symbol">₿</span>
              <span>
                <strong>BTC · USDC</strong>
                <small>REFERENCE MARKET</small>
              </span>
              <span className="home-price-live">LIVE</span>
            </div>

            <div className="home-price-label">Latest market price</div>
            <div className="home-price-value">
              {market ? usd(market.lastPrice) : "Loading…"}
            </div>

            <div className="home-price-foot">
              <span className="home-live-dot" />
              Price from Txflow market data
            </div>

            <div className="home-price-spark" aria-hidden="true">
              <svg viewBox="0 0 300 62" preserveAspectRatio="none">
                <path d="M0 45 C18 43 22 22 43 27 S70 43 90 32 S120 15 142 27 S168 47 187 30 S215 19 232 25 S258 48 278 28 S291 22 300 14" />
              </svg>
            </div>
          </div>
        </section>

        <section
          className="home-stats-grid"
          aria-label="Txflow market statistics"
        >
          {stats.map((stat, index) => (
            <article
              className={`home-stat-card ${
                index === 0 ? "home-stat-featured" : ""
              }`}
              key={stat.title}
            >
              <div className="home-stat-top">
                <span>{stat.title}</span>
                <span className="home-stat-icon">{stat.icon}</span>
              </div>

              <div className="home-stat-value">{stat.value}</div>

              <div className="home-stat-detail">
                <span className="home-stat-dot" />
                {stat.detail}
              </div>

              <span className="home-stat-index">0{index + 1}</span>
            </article>
          ))}
        </section>

        <div className="home-section-heading">
          <div>
            <span className="home-section-kicker">
              PERFORMANCE INTELLIGENCE
            </span>
            <h2>Realized PnL</h2>
            <p>
              Closed trading performance, calculated from recorded PnL minus
              fees.
            </p>
          </div>
          <span className="home-section-tag">FILL-BASED DATA</span>
        </div>

        <PnlCards />

        <div className="home-section-heading">
          <div>
            <span className="home-section-kicker">MARKET TRENDS</span>
            <h2>Historical market analytics</h2>
            <p>Explore how key market metrics have changed over time.</p>
          </div>
        </div>

        <VolumeChart />

        <div className="home-section-heading">
          <div>
            <span className="home-section-kicker">MARKET MONITOR</span>
            <h2>Markets in focus</h2>
            <p>
              The most active perpetual markets by 24-hour trading volume.
            </p>
          </div>
          <a className="home-text-link" href="/markets">
            All markets ↗
          </a>
        </div>

        <MarketsTable />

        <div className="home-section-heading">
          <div>
            <span className="home-section-kicker">
              TRADER INTELLIGENCE
            </span>
            <h2>Top traders by realized PnL</h2>
            <p>
              Compare wallets using recorded closed PnL and fee data.
            </p>
          </div>
          <a className="home-text-link" href="/leaderboard">
            Full leaderboard ↗
          </a>
        </div>

        <PnlLeaderboard />

        <section className="home-activity-panel" id="traders">
          <div className="home-activity-heading">
            <div>
              <span className="home-section-kicker">WALLET ACTIVITY</span>
              <h2>Top traders</h2>
              <p>Ranked by trading activity recorded on Txflow.</p>
            </div>

            <div className="home-activity-controls">
              <label>
                <span>PERIOD</span>
                <select
                  value={period}
                  onChange={(event) => setPeriod(Number(event.target.value))}
                  aria-label="Leaderboard period"
                >
                  <option value={24}>Last 24 hours</option>
                  <option value={168}>Last 7 days</option>
                  <option value={720}>Last 30 days</option>
                </select>
              </label>

              <label>
                <span>RANK BY</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as "volume" | "trades")
                  }
                  aria-label="Sort traders"
                >
                  <option value="volume">Highest volume</option>
                  <option value="trades">Most trades</option>
                </select>
              </label>
            </div>
          </div>

          {tradersLoading ? (
            <div className="home-table-state">
              <span className="home-loading-ring" />
              Loading trader activity…
            </div>
          ) : tradersError ? (
            <div className="home-table-state home-table-error">
              {tradersError}
            </div>
          ) : traders.length === 0 ? (
            <div className="home-table-state">
              No trader activity found for this period.
            </div>
          ) : (
            <div className="home-table-scroll">
              <table className="home-traders-table">
                <thead>
                  <tr>
                    <th>RANK</th>
                    <th>WALLET</th>
                    <th>TRADES</th>
                    <th>TRADING VOLUME</th>
                    <th>LAST ACTIVE</th>
                  </tr>
                </thead>

                <tbody>
                  {traders.map((trader, index) => (
                    <tr key={trader.wallet}>
                      <td>
                        <span
                          className={`home-rank ${
                            index < 3 ? `home-rank-${index + 1}` : ""
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </td>

                      <td>
                        <a
                          className="home-wallet-link"
                          href={`/traders/${encodeURIComponent(
                            trader.wallet
                          )}`}
                        >
                          {trader.wallet.slice(0, 8)}…
                          {trader.wallet.slice(-6)}
                        </a>
                      </td>

                      <td>
                        {Number(trader.trade_count).toLocaleString("en-US")}
                      </td>

                      <td className="home-volume-cell">
                        {compactUsd(trader.trading_volume)}
                      </td>

                      <td className="home-last-active">
                        {trader.last_active
                          ? new Date(trader.last_active).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="home-panel-footer">
            <span>
              Rankings use recorded activity for the selected period.
            </span>
            <a href="/traders">Explore all traders ↗</a>
          </div>
        </section>

        <footer className="home-footer">
          <span>
            <b>T</b> TXFLOW STATS
          </span>
          <span>Independent analytics for Txflow Perpetuals</span>
          <a href="#overview">Back to top ↑</a>
        </footer>
      </div>
    </main>
  );
}
