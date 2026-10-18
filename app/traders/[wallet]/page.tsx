
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ActivityChart from "./ActivityChart";

type TraderStats = {
  wallet: string;
  trade_count: number;
  trading_volume: number;
  last_active: string;
};

type Trade = {
  coin: string;
  price: number;
  size: number;
  side: string;
  trade_time: string;
  trade_id: string;
};

type Activity = {
  activity_date: string;
  trade_count: number;
  trading_volume: number;
};

type MarketBreakdown = {
  coin: string;
  trade_count: number;
  trading_volume: number;
  last_traded_at: string;
};

const C = {
  page: "#080a08",
  panel: "#101410",
  border: "#252d25",
  text: "#f3f7f1",
  muted: "#8e9a8c",
  dim: "#657063",
  lime: "#b8f34a",
  limeSoft: "rgba(184,243,74,.10)",
  red: "#ff7777",
};

function TraderProfileContent() {
  const params = useParams<{ wallet: string }>();
  const wallet = params.wallet || "";

  const [trader, setTrader] = useState<TraderStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [markets, setMarkets] = useState<MarketBreakdown[]>([]);

  const [loading, setLoading] = useState(true);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [marketsLoading, setMarketsLoading] = useState(true);

  const [error, setError] = useState("");
  const [tradesError, setTradesError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [marketsError, setMarketsError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;


async function loadTrader() {
  setLoading(true);
  setError("");

  try {
    const response = await fetch(
      `/api/trader-activity?wallet=${encodeURIComponent(wallet)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error("Trader activity API failed:", data);

      throw new Error(
        data.details || data.error || "Failed to load trader activity."
      );
    }

    const dailyActivity = (data.activity || []) as Activity[];

    if (cancelled) return;

    if (dailyActivity.length === 0) {
      setError(
        "No trading activity found for this wallet in the last 30 days."
      );
      return;
    }

    const tradeCount = dailyActivity.reduce(
      (total, day) => total + Number(day.trade_count || 0),
      0
    );

    const tradingVolume = dailyActivity.reduce(
      (total, day) => total + Number(day.trading_volume || 0),
      0
    );

    const lastActive = [...dailyActivity].sort(
      (a, b) =>
        new Date(b.activity_date).getTime() -
        new Date(a.activity_date).getTime()
    )[0].activity_date;

    setTrader({
      wallet,
      trade_count: tradeCount,
      trading_volume: tradingVolume,
      last_active: lastActive,
    });
  } catch (err) {
    console.error("Trader profile error:", err);

    if (!cancelled) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error loading trader profile."
      );
    }
  } finally {
    if (!cancelled) setLoading(false);
  }
}


    async function loadTrades() {
      setTradesLoading(true);
      setTradesError("");

      try {
        const response = await fetch(
          `/api/trader-trades?wallet=${encodeURIComponent(wallet)}&limit=50`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load trading history.");
        }

        if (!cancelled) setTrades(data.trades || []);
      } catch {
        if (!cancelled) setTradesError("Unable to load recent trades.");
      } finally {
        if (!cancelled) setTradesLoading(false);
      }
    }

    async function loadActivity() {
      setActivityLoading(true);
      setActivityError("");

      try {
        const response = await fetch(
          `/api/trader-activity?wallet=${encodeURIComponent(wallet)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load trading activity.");
        }

        if (!cancelled) setActivity(data.activity || []);
      } catch {
        if (!cancelled) {
          setActivityError("Unable to load trading activity.");
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    }

    async function loadMarkets() {
      setMarketsLoading(true);
      setMarketsError("");

      try {
        const response = await fetch(
          `/api/market-breakdown?wallet=${encodeURIComponent(wallet)}&days=30`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load market breakdown.");
        }

        if (!cancelled) setMarkets(data.markets || []);
      } catch {
        if (!cancelled) {
          setMarketsError("Unable to load market breakdown.");
        }
      } finally {
        if (!cancelled) setMarketsLoading(false);
      }
    }

    if (wallet) {
      loadTrader();
      loadTrades();
      loadActivity();
      loadMarkets();
    }

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  function formatVolume(volume: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(volume) || 0);
  }

  function formatNumber(value: number) {
    return Number(value).toLocaleString("en-US", {
      maximumFractionDigits: 8,
    });
  }

  function formatDate(date: string) {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return "—";

    return parsed.toLocaleString();
  }

  async function copyWallet() {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const shortWallet =
    wallet.length > 28
      ? `${wallet.slice(0, 12)}…${wallet.slice(-10)}`
      : wallet;

  return (
    <main className="profile-page">
      <div className="profile-shell">
        <a href="/traders" className="back-link">
          <span>←</span> Back to Traders
        </a>

        {loading ? (
          <div className="state-panel">
            <span className="loading-dot" />
            <p>Loading trader profile…</p>
          </div>
        ) : error ? (
          <div className="state-panel error-panel">
            <div className="state-icon">!</div>
            <h1>Trader profile unavailable</h1>
            <p>{error}</p>
            <a href="/traders" className="primary-button">
              Return to Traders
            </a>
          </div>
        ) : trader ? (
          <>
            <header className="profile-header">
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                TXFLOW / TRADER INTELLIGENCE
              </div>

              <div className="header-row">
                <div className="heading-copy">
                  <h1>
                    Trader <span>Profile</span>
                  </h1>
                  <p>
                    Trading activity and market breakdown for this wallet
                    over the last 30 days.
                  </p>
                </div>

                <div className="profile-status">
                  <span />
                  PROFILE LOADED
                </div>
              </div>

              <div className="wallet-panel">
                <div className="wallet-avatar">↗</div>

                <div className="wallet-details">
                  <span className="field-label">WALLET ADDRESS</span>
                  <span className="wallet-full" title={wallet}>
                    {wallet}
                  </span>
                  <span className="wallet-short">{shortWallet}</span>
                </div>

                <button
                  onClick={copyWallet}
                  className="copy-button"
                  type="button"
                >
                  <span>{copied ? "✓" : "▣"}</span>
                  {copied ? "Copied" : "Copy address"}
                </button>
              </div>
            </header>

            <section className="metrics-grid">
              <article className="metric-card">
                <div className="metric-top">
                  <span className="metric-icon">⌁</span>
                  <span className="metric-period">30 DAYS</span>
                </div>
                <p className="metric-label">Total trades</p>
                <div className="metric-value">
                  {Number(trader.trade_count).toLocaleString("en-US")}
                </div>
                <p className="metric-foot">Recorded trade count</p>
              </article>

              <article className="metric-card metric-highlight">
                <div className="metric-top">
                  <span className="metric-icon">$</span>
                  <span className="metric-period">30 DAYS</span>
                </div>
                <p className="metric-label">Trading volume</p>
                <div className="metric-value lime-value">
                  {formatVolume(trader.trading_volume)}
                </div>
                <p className="metric-foot">
                  Calculated from price × size
                </p>
              </article>

              <article className="metric-card">
                <div className="metric-top">
                  <span className="metric-icon">◷</span>
                  <span className="metric-period">LATEST</span>
                </div>
                <p className="metric-label">Last active</p>
                <div className="metric-value date-value">
                  {formatDate(trader.last_active)}
                </div>
                <p className="metric-foot">Most recent recorded activity</p>
              </article>
            </section>

            <div className="data-note">
              <span className="note-mark">i</span>
              <span>
                Statistics cover the last 30 days. Volume is calculated from
                recorded price × size values.
              </span>
            </div>

            <section className="content-section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">PERFORMANCE OVER TIME</div>
                  <h2>Trading activity</h2>
                  <p>Daily trade count and calculated trading volume</p>
                </div>
                <span className="section-tag">LAST 30 DAYS</span>
              </div>

              <div className="content-card chart-card">
                {activityLoading ? (
                  <LoadingMessage text="Loading activity chart…" />
                ) : activityError ? (
                  <ErrorMessage text={activityError} />
                ) : activity.length === 0 ? (
                  <EmptyMessage text="No activity data is available for this wallet." />
                ) : (
                  <ActivityChart data={activity} />
                )}
              </div>
            </section>

            <section className="content-section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">WHERE THEY TRADE</div>
                  <h2>Market breakdown</h2>
                  <p>
                    Markets traded by this wallet, ranked by calculated volume
                  </p>
                </div>
                <span className="section-tag">30-DAY WINDOW</span>
              </div>

              <div className="content-card table-card">
                {marketsLoading ? (
                  <LoadingMessage text="Loading market breakdown…" />
                ) : marketsError ? (
                  <ErrorMessage text={marketsError} />
                ) : markets.length === 0 ? (
                  <EmptyMessage text="No market data found for this wallet." />
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Market</th>
                          <th>Trades</th>
                          <th>Calculated volume</th>
                          <th>Last traded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {markets.map((market) => (
                          <tr key={market.coin}>
                            <td>
                              <span className="market-symbol">
                                {market.coin}
                              </span>
                            </td>
                            <td className="numeric-cell">
                              {Number(market.trade_count).toLocaleString(
                                "en-US"
                              )}
                            </td>
                            <td className="volume-cell">
                              {formatVolume(Number(market.trading_volume))}
                            </td>
                            <td className="muted-cell">
                              {formatDate(market.last_traded_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <section className="content-section last-section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">LATEST EXECUTIONS</div>
                  <h2>Recent trading history</h2>
                  <p>Latest recorded trades associated with this wallet</p>
                </div>
                <span className="section-tag">{trades.length} LOADED</span>
              </div>

              <div className="content-card table-card">
                {tradesLoading ? (
                  <LoadingMessage text="Loading recent trades…" />
                ) : tradesError ? (
                  <ErrorMessage text={tradesError} />
                ) : trades.length === 0 ? (
                  <EmptyMessage text="No recent trades found for this wallet." />
                ) : (
                  <div className="table-scroll">
                    <table className="trades-table">
                      <thead>
                        <tr>
                          <th>Market</th>
                          <th>Side code</th>
                          <th>Price</th>
                          <th>Size</th>
                          <th>Trade time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((trade, index) => {
                          const side = String(trade.side || "");
                          const isBuy = /buy|long/i.test(side);
                          const isSell = /sell|short/i.test(side);

                          return (
                            <tr key={`${trade.trade_id}-${index}`}>
                              <td>
                                <span className="market-symbol">
                                  {trade.coin}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`side-pill ${
                                    isBuy
                                      ? "side-buy"
                                      : isSell
                                      ? "side-sell"
                                      : "side-neutral"
                                  }`}
                                >
                                  {side || "—"}
                                </span>
                              </td>
                              <td className="numeric-cell">
                                {formatNumber(Number(trade.price))}
                              </td>
                              <td className="numeric-cell">
                                {formatNumber(Number(trade.size))}
                              </td>
                              <td className="muted-cell">
                                {formatDate(trade.trade_time)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="table-footnote">
                Showing up to 50 latest trades returned by the data API.
              </p>
            </section>

            <footer className="profile-footer">
              <span className="footer-mark">T</span>
              <span>TXFLOW STATS</span>
              <span className="footer-divider">/</span>
              <span>Trader analytics</span>
              <a href="/traders">All traders ↗</a>
            </footer>
          </>
        ) : null}
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: ${C.page};
        }

        .profile-page {
          min-height: 100vh;
          padding: 34px 28px 48px;
          color: ${C.text};
          font-family: Arial, Helvetica, sans-serif;
          background: ${C.page};
          background-image: radial-gradient(
            ellipse at 50% -15%,
            rgba(184, 243, 74, 0.075),
            transparent 42%
          );
        }

        .profile-shell {
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: ${C.muted};
          text-decoration: none;
          font-size: 13px;
          transition: color 0.18s;
        }

        .back-link:hover {
          color: ${C.lime};
        }

        .back-link span {
          font-size: 18px;
        }

        .profile-header {
          margin-top: 34px;
        }

        .eyebrow,
        .section-kicker {
          color: ${C.lime};
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${C.lime};
          box-shadow: 0 0 12px rgba(184, 243, 74, 0.45);
        }

        .header-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-top: 13px;
        }

        .heading-copy h1 {
          margin: 0;
          font-size: clamp(30px, 4vw, 43px);
          letter-spacing: -1.8px;
          line-height: 1.1;
          font-weight: 750;
        }

        .heading-copy h1 span {
          color: ${C.lime};
        }

        .heading-copy p {
          color: ${C.muted};
          font-size: 14px;
          line-height: 1.6;
          margin: 12px 0 0;
        }

        .profile-status {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border: 1px solid ${C.border};
          border-radius: 999px;
          background: rgba(16, 20, 16, 0.8);
          color: #b5c0b1;
          font-size: 9px;
          letter-spacing: 1.2px;
        }

        .profile-status span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${C.lime};
        }

        .wallet-panel {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 27px;
          padding: 18px 20px;
          border: 1px solid ${C.border};
          border-radius: 14px;
          background: linear-gradient(
            110deg,
            rgba(20, 26, 20, 0.96),
            rgba(13, 17, 13, 0.96)
          );
        }

        .wallet-avatar {
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          width: 44px;
          height: 44px;
          border: 1px solid rgba(184, 243, 74, 0.22);
          border-radius: 12px;
          background: ${C.limeSoft};
          color: ${C.lime};
          font-size: 25px;
        }

        .wallet-details {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          gap: 7px;
        }

        .field-label {
          color: ${C.dim};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .wallet-full {
          color: #d5ddd1;
          font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
          overflow-wrap: anywhere;
        }

        .wallet-short {
          display: none;
          color: #d5ddd1;
          font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
        }

        .copy-button,
        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 13px;
          border: 1px solid rgba(184, 243, 74, 0.34);
          border-radius: 9px;
          background: ${C.limeSoft};
          color: ${C.lime};
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.18s, border-color 0.18s;
        }

        .copy-button:hover,
        .primary-button:hover {
          border-color: ${C.lime};
          background: rgba(184, 243, 74, 0.17);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .metric-card {
          min-width: 0;
          padding: 20px 21px 18px;
          border: 1px solid ${C.border};
          border-radius: 13px;
          background: ${C.panel};
        }

        .metric-highlight {
          border-color: rgba(184, 243, 74, 0.25);
          background: linear-gradient(
            135deg,
            rgba(184, 243, 74, 0.075),
            ${C.panel} 62%
          );
        }

        .metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .metric-icon {
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          border: 1px solid ${C.border};
          border-radius: 9px;
          background: #171d15;
          color: ${C.lime};
          font-size: 17px;
        }

        .metric-period {
          color: ${C.dim};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .metric-label {
          margin: 17px 0 8px;
          color: ${C.muted};
          font-size: 12px;
        }

        .metric-value {
          min-height: 32px;
          color: ${C.text};
          font-size: clamp(21px, 2.6vw, 29px);
          font-weight: 750;
          line-height: 1.3;
          letter-spacing: -0.8px;
          overflow-wrap: anywhere;
        }

        .lime-value {
          color: ${C.lime};
        }

        .date-value {
          padding-top: 5px;
          font-size: 16px;
          letter-spacing: -0.2px;
        }

        .metric-foot {
          margin: 12px 0 0;
          color: ${C.dim};
          font-size: 11px;
        }

        .data-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 17px;
          color: ${C.dim};
          font-size: 11px;
          line-height: 1.6;
        }

        .note-mark {
          display: inline-grid;
          flex: 0 0 auto;
          place-items: center;
          width: 15px;
          height: 15px;
          border: 1px solid #3b4934;
          border-radius: 50%;
          color: ${C.lime};
          font-size: 10px;
          font-weight: 800;
        }

        .content-section {
          margin-top: 42px;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 17px;
        }

        .section-kicker {
          font-size: 9px;
          letter-spacing: 1.6px;
        }

        .section-heading h2 {
          margin: 7px 0 0;
          font-size: 22px;
          letter-spacing: -0.6px;
        }

        .section-heading p {
          margin: 7px 0 0;
          color: ${C.muted};
          font-size: 12px;
          line-height: 1.5;
        }

        .section-tag {
          flex: 0 0 auto;
          padding: 7px 9px;
          border: 1px solid ${C.border};
          border-radius: 6px;
          background: ${C.panel};
          color: ${C.dim};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .content-card {
          overflow: hidden;
          border: 1px solid ${C.border};
          border-radius: 13px;
          background: ${C.panel};
        }

        .chart-card {
          min-height: 180px;
          padding: 22px;
        }

        .table-card {
          min-height: 100px;
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 650px;
          border-collapse: collapse;
          text-align: left;
        }

        th {
          padding: 15px 19px;
          background: #131813;
          color: ${C.dim};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.15px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        td {
          padding: 16px 19px;
          border-top: 1px solid #222a22;
          color: #dce3d8;
          font-size: 12px;
          white-space: nowrap;
        }

        tbody tr {
          transition: background 0.15s;
        }

        tbody tr:hover {
          background: rgba(184, 243, 74, 0.035);
        }

        .market-symbol {
          color: ${C.text};
          font-weight: 750;
        }

        .numeric-cell {
          font-variant-numeric: tabular-nums;
        }

        .volume-cell {
          color: ${C.lime};
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .muted-cell {
          color: ${C.muted};
          font-size: 11px;
        }

        .side-pill {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border-radius: 5px;
          font-size: 10px;
          font-weight: 800;
        }

        .side-buy {
          color: #b8f34a;
          background: rgba(184, 243, 74, 0.1);
        }

        .side-sell {
          color: #ff9292;
          background: rgba(255, 119, 119, 0.1);
        }

        .side-neutral {
          color: #bdc7b9;
          background: #202720;
        }

        .table-footnote {
          margin: 10px 2px 0;
          color: ${C.dim};
          font-size: 10px;
        }

        .profile-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 48px;
          padding-top: 20px;
          border-top: 1px solid ${C.border};
          color: ${C.dim};
          font-size: 10px;
          letter-spacing: 0.7px;
        }

        .footer-mark {
          display: grid;
          place-items: center;
          width: 23px;
          height: 23px;
          border-radius: 6px;
          background: ${C.lime};
          color: #10150b;
          font-size: 13px;
          font-weight: 900;
        }

        .footer-divider {
          color: #3b4638;
        }

        .profile-footer a {
          margin-left: auto;
          color: ${C.muted};
          text-decoration: none;
          font-size: 11px;
          letter-spacing: 0;
        }

        .profile-footer a:hover {
          color: ${C.lime};
        }

        .state-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 240px;
          margin-top: 60px;
          padding: 28px;
          border: 1px solid ${C.border};
          border-radius: 14px;
          background: ${C.panel};
          color: ${C.muted};
          text-align: center;
        }

        .state-panel p {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
        }

        .state-panel h1 {
          margin: 5px 0;
          color: ${C.text};
          font-size: 23px;
        }

        .error-panel p {
          max-width: 520px;
          color: ${C.red};
        }

        .state-icon {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 119, 119, 0.1);
          color: ${C.red};
          font-weight: 900;
        }

        .primary-button {
          margin-top: 12px;
        }

        .loading-dot {
          width: 18px;
          height: 18px;
          border: 2px solid #303b2c;
          border-top-color: ${C.lime};
          border-radius: 50%;
          animation: profile-spin 0.8s linear infinite;
        }

        @keyframes profile-spin {
          to { transform: rotate(360deg); }
        }

        .inline-state {
          padding: 26px 20px;
          color: ${C.muted};
          font-size: 12px;
        }

        .inline-error {
          color: ${C.red};
        }

        @media (max-width: 760px) {
          .profile-page { padding: 24px 16px 34px; }
          .header-row { align-items: flex-start; flex-direction: column; }
          .wallet-panel { align-items: flex-start; flex-wrap: wrap; padding: 15px; gap: 12px; }
          .wallet-details { width: calc(100% - 60px); flex: initial; }
          .wallet-full { display: none; }
          .wallet-short { display: block; }
          .copy-button { margin-left: 56px; }
          .metrics-grid { grid-template-columns: 1fr; gap: 10px; }
          .metric-card { padding: 17px; }
          .metric-label { margin-top: 12px; }
          .metric-value { font-size: 25px; }
          .section-heading { align-items: flex-start; }
          .section-tag { margin-top: 3px; font-size: 8px; }
          .chart-card { padding: 12px; }
          th, td { padding: 13px 14px; }
          .profile-footer { flex-wrap: wrap; }
        }

        @media (max-width: 430px) {
          .profile-page { padding-left: 12px; padding-right: 12px; }
          .heading-copy h1 { font-size: 32px; }
          .section-heading h2 { font-size: 20px; }
          .section-heading p { max-width: 230px; }
          .section-tag { max-width: 100px; text-align: center; line-height: 1.4; }
          .wallet-avatar { width: 38px; height: 38px; }
          .wallet-details { width: calc(100% - 52px); }
          .copy-button { margin-left: 50px; }
        }
      `}</style>
    </main>
  );
}

function LoadingMessage({ text }: { text: string }) {
  return <div className="inline-state">{text}</div>;
}

function ErrorMessage({ text }: { text: string }) {
  return <div className="inline-state inline-error">{text}</div>;
}

function EmptyMessage({ text }: { text: string }) {
  return <div className="inline-state">{text}</div>;
}

export default function TraderProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="profile-page">
          <div className="state-panel">
            <span className="loading-dot" />
            <p>Loading trader profile…</p>
          </div>
        </main>
      }
    >
      <TraderProfileContent />
    </Suspense>
  );
}
