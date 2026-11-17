
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DailyPerformance = {
  trade_date: string;
  trade_count: number;
  realized_pnl: number;
  trading_volume: number;
};

type TraderResult = {
  wallet: string;
  days: number;
  summary: {
    total_pnl: number;
    winning_days: number;
    losing_days: number;
    breakeven_days: number;
    win_rate: number;
    average_daily_pnl: number;
    total_active_days: number;
  };
  daily_performance: DailyPerformance[];
};

type TraderSlot = {
  id: number;
  wallet: string;
};

const COLORS = ["#b8f34a", "#56b4ff", "#c084fc"];

const emptySlots: TraderSlot[] = [
  { id: 1, wallet: "" },
  { id: 2, wallet: "" },
  { id: 3, wallet: "" },
];

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 8)}...${wallet.slice(-6)}`;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function number(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function ComparisonContent() {
  const searchParams = useSearchParams();

  const [slots, setSlots] = useState<TraderSlot[]>(emptySlots);
  const [results, setResults] = useState<TraderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const compareInFlight = useRef(false);
  const compareVersion = useRef(0);
  const compareController = useRef<AbortController | null>(null);

  useEffect(() => {
    const initialWallet = searchParams.get("wallet") || "";

    if (/^0x[a-f0-9]{40}$/i.test(initialWallet)) {
      setSlots([
        { id: 1, wallet: initialWallet },
        { id: 2, wallet: "" },
        { id: 3, wallet: "" },
      ]);
    }
  }, [searchParams]);

  function updateWallet(id: number, wallet: string) {
    setSlots((current) =>
      current.map((slot) =>
        slot.id === id ? { ...slot, wallet } : slot
      )
    );
  }

  async function compareTraders() {
    if (compareInFlight.current) return;
    const wallets = slots
      .map((slot) => slot.wallet.trim().toLowerCase())
      .filter(Boolean);

    setError("");

    if (wallets.length < 2) {
      setError("Enter at least two wallet addresses to compare.");
      return;
    }

    if (wallets.length > 3) {
      setError("You can compare up to three wallets.");
      return;
    }

    if (wallets.some((wallet) => !/^0x[a-f0-9]{40}$/i.test(wallet))) {
      setError("One or more wallet addresses are invalid.");
      return;
    }

    if (new Set(wallets).size !== wallets.length) {
      setError("Please enter different wallet addresses.");
      return;
    }

    setLoading(true);

    try {
      const responses = await Promise.all(
        wallets.map(async (wallet) => {
          const response = await fetch(
            `/api/trader-performance?wallet=${encodeURIComponent(wallet)}&days=365`,
            { cache: "no-store", signal: controller.signal }
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(
              data.error || `Unable to load ${shortWallet(wallet)}`
            );
          }

          return data as TraderResult;
        })
      );

      setResults(responses);
      setHasCompared(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to compare these wallets."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => () => {
    compareVersion.current += 1;
    compareController.current?.abort();
    compareController.current = null;
    compareInFlight.current = false;
  }, []);

  const chartData = useMemo(() => {
    const dates = new Set<string>();

    results.forEach((trader) => {
      trader.daily_performance.forEach((day) => {
        dates.add(day.trade_date);
      });
    });

    const sortedDates = Array.from(dates).sort();

    const cumulative = results.map((trader) => {
      let runningTotal = 0;
      const values = new Map<string, number>();

      trader.daily_performance.forEach((day) => {
        values.set(day.trade_date, day.realized_pnl);
      });

      return {
        wallet: trader.wallet,
        values: sortedDates.map((date) => {
          runningTotal += values.get(date) || 0;
          return runningTotal;
        }),
      };
    });

    return sortedDates.map((date, index) => {
      const point: Record<string, string | number> = {
        date,
      };

      cumulative.forEach((trader, traderIndex) => {
        point[`trader${traderIndex}`] = trader.values[index];
      });

      return point;
    });
  }, [results]);

  const leader = useMemo(() => {
    if (!results.length) return null;

    return [...results].sort(
      (a, b) => b.summary.total_pnl - a.summary.total_pnl
    )[0];
  }, [results]);

  return (
    <main className="comparison-page">
      <div className="comparison-shell">
        <a href="/traders" className="back-link">
          ← Back to Traders
        </a>

        <header className="comparison-header">
          <div className="eyebrow">
            <span className="live-dot" />
            TXFLOW / TRADER INTELLIGENCE
          </div>

          <h1>
            Trader <span>Comparison</span>
          </h1>

          <p>
            Compare trading performance, realized PnL, volume and activity
            across multiple wallets.
          </p>
        </header>

        <section className="compare-input-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">SELECT TRADERS</span>
              <h2>Choose wallets to compare</h2>
            </div>
            <span className="period-tag">365 DAYS</span>
          </div>

          <div className="wallet-input-grid">
            {slots.map((slot, index) => (
              <label className="wallet-input-card" key={slot.id}>
                <span style={{ color: COLORS[index] }}>
                  TRADER {index + 1}
                </span>
                <input
                  value={slot.wallet}
                  onChange={(event) =>
                    updateWallet(slot.id, event.target.value)
                  }
                  placeholder="0x..."
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            className="compare-button"
            onClick={compareTraders}
            disabled={loading}
          >
            {loading ? "Comparing wallets..." : "Compare Traders →"}
          </button>

          <p className="input-note">
            Enter two or three valid EVM wallet addresses. Data is taken
            from the existing trader performance records.
          </p>
        </section>

        {loading && (
          <div className="state-panel">
            <span className="loading-spinner" />
            Loading trader performance...
          </div>
        )}

        {results.length > 0 && (
          <>
            <section className="leader-panel">
              <div>
                <span className="section-kicker">TOP PERFORMER</span>
                <h2>{shortWallet(leader!.wallet)}</h2>
                <p>Highest realized PnL in the selected period</p>
              </div>
              <strong>{money(leader!.summary.total_pnl)}</strong>
            </section>

            <section className="comparison-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">
                    PERFORMANCE OVERVIEW
                  </span>
                  <h2>Side-by-side comparison</h2>
                  <p>Key trading metrics for each selected wallet</p>
                </div>
              </div>

              <div className="results-grid">
                {results.map((trader, index) => (
                  <article className="result-card" key={trader.wallet}>
                    <div className="result-card-top">
                      <span
                        className="trader-indicator"
                        style={{ background: COLORS[index] }}
                      />
                      <span>TRADER {index + 1}</span>
                    </div>

                    <div className="result-wallet">
                      {shortWallet(trader.wallet)}
                    </div>

                    <div
                      className={`main-pnl ${
                        trader.summary.total_pnl >= 0 ? "positive" : "negative"
                      }`}
                    >
                      {money(trader.summary.total_pnl)}
                    </div>
                    <span className="metric-caption">REALIZED PNL</span>

                    <div className="result-metrics">
                      <Metric
                        label="Trading volume"
                        value={money(
                          trader.daily_performance.reduce(
                            (sum, day) => sum + day.trading_volume,
                            0
                          )
                        )}
                      />
                      <Metric
                        label="Recorded fills"
                        value={number(
                          trader.daily_performance.reduce(
                            (sum, day) => sum + day.trade_count,
                            0
                          )
                        )}
                      />
                      <Metric
                        label="Active days"
                        value={number(trader.summary.total_active_days)}
                      />
                      <Metric
                        label="Win rate"
                        value={`${number(trader.summary.win_rate)}%`}
                      />
                      <Metric
                        label="Winning days"
                        value={number(trader.summary.winning_days)}
                      />
                      <Metric
                        label="Losing days"
                        value={number(trader.summary.losing_days)}
                      />
                      <Metric
                        label="Average daily PnL"
                        value={money(trader.summary.average_daily_pnl)}
                      />
                    </div>

                    <a
                      className="profile-link"
                      href={`/traders/${trader.wallet}`}
                    >
                      View trader profile ↗
                    </a>
                  </article>
                ))}
              </div>
            </section>

            <section className="comparison-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">CUMULATIVE PERFORMANCE</span>
                  <h2>PnL comparison</h2>
                  <p>Running total of daily realized PnL over time</p>
                </div>
                <span className="period-tag">USD</span>
              </div>

              <div className="chart-panel">
                {chartData.length === 0 ? (
                  <div className="empty-state">
                    No daily performance data is available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 12, right: 20, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid
                        stroke="#273027"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#879184"
                        tick={{ fontSize: 10 }}
                        minTickGap={35}
                      />
                      <YAxis
                        stroke="#879184"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) =>
                          `$${Number(value).toLocaleString("en-US", {
                            notation: "compact",
                          })}`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#111811",
                          border: "1px solid #303b2c",
                          borderRadius: 9,
                          color: "#f3f7f1",
                        }}
                        formatter={(value) => money(Number(value))}
                      />
                      <Legend />
                      {results.map((trader, index) => (
                        <Line
                          key={trader.wallet}
                          type="monotone"
                          dataKey={`trader${index}`}
                          name={shortWallet(trader.wallet)}
                          stroke={COLORS[index]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="comparison-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">DAILY STATISTICS</span>
                  <h2>Performance breakdown</h2>
                  <p>Winning, losing and breakeven days</p>
                </div>
              </div>

              <div className="table-panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        {results.map((trader) => (
                          <th key={trader.wallet}>
                            {shortWallet(trader.wallet)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          label: "Total realized PnL",
                          value: (r: TraderResult) =>
                            money(r.summary.total_pnl),
                        },
                        {
                          label: "Winning days",
                          value: (r: TraderResult) =>
                            number(r.summary.winning_days),
                        },
                        {
                          label: "Losing days",
                          value: (r: TraderResult) =>
                            number(r.summary.losing_days),
                        },
                        {
                          label: "Breakeven days",
                          value: (r: TraderResult) =>
                            number(r.summary.breakeven_days),
                        },
                        {
                          label: "Win rate",
                          value: (r: TraderResult) =>
                            `${number(r.summary.win_rate)}%`,
                        },
                        {
                          label: "Active days",
                          value: (r: TraderResult) =>
                            number(r.summary.total_active_days),
                        },
                      ].map((metric) => (
                        <tr key={metric.label}>
                          <td>{metric.label}</td>
                          {results.map((trader) => (
                            <td key={trader.wallet}>
                              {metric.value(trader)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <div className="method-note">
              <strong>Data methodology:</strong> PnL and win rate are based
              on daily realized PnL from trader_daily_stats. Trading volume
              and fill counts are summed from the same daily records.
              Unrealized PnL, open positions and account equity are not
              included. The comparison uses the last 365 days.
            </div>
          </>
        )}

        <footer className="comparison-footer">
          <span className="footer-mark">T</span>
          TXFLOW STATS
          <span>/</span>
          Trader comparison
          <a href="/traders">All traders ↗</a>
        </footer>
      </div>

      <style jsx global>{`
        .comparison-page {
          min-height: 100vh;
          padding: 34px 24px 55px;
          background: #080a08;
          color: #f3f7f1;
          font-family: Arial, Helvetica, sans-serif;
        }

        .comparison-shell {
          max-width: 1240px;
          margin: 0 auto;
        }

        .comparison-page .back-link {
          color: #8e9a8c;
          text-decoration: none;
          font-size: 13px;
        }

        .comparison-page .back-link:hover,
        .profile-link:hover {
          color: #b8f34a;
        }

        .comparison-header {
          margin: 35px 0 30px;
        }

        .eyebrow,
        .section-kicker {
          color: #b8f34a;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }

        .live-dot,
        .trader-indicator {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #b8f34a;
          margin-right: 8px;
        }

        .comparison-header h1 {
          margin: 13px 0 10px;
          font-size: clamp(32px, 5vw, 48px);
          letter-spacing: -2px;
        }

        .comparison-header h1 span {
          color: #b8f34a;
        }

        .comparison-header p,
        .section-heading p {
          color: #8e9a8c;
          font-size: 13px;
          line-height: 1.7;
        }

        .compare-input-panel,
        .result-card,
        .chart-panel,
        .table-panel {
          border: 1px solid #252d25;
          border-radius: 14px;
          background: #101410;
        }

        .compare-input-panel {
          padding: 23px;
        }

        .panel-heading,
        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 15px;
          margin-bottom: 20px;
        }

        .panel-heading h2,
        .section-heading h2 {
          margin: 7px 0 0;
          font-size: 21px;
        }

        .period-tag {
          padding: 7px 10px;
          border: 1px solid #303b2c;
          border-radius: 6px;
          color: #b8f34a;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .wallet-input-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .wallet-input-card {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 10px;
          padding: 14px;
          border: 1px solid #293329;
          border-radius: 10px;
          background: #0b0f0b;
          color: #9aa697;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .wallet-input-card input {
          width: 100%;
          min-width: 0;
          padding: 10px 0;
          border: 0;
          outline: none;
          background: transparent;
          color: #f3f7f1;
          font: 11px ui-monospace, monospace;
        }

        .wallet-input-card input::placeholder {
          color: #586356;
        }

        .compare-button {
          margin-top: 17px;
          padding: 13px 19px;
          border: 1px solid #b8f34a;
          border-radius: 8px;
          background: #b8f34a;
          color: #10150b;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .compare-button:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        .input-note,
        .method-note {
          color: #748071;
          font-size: 11px;
          line-height: 1.7;
        }

        .input-note {
          margin: 12px 0 0;
        }

        .error-message {
          margin-top: 14px;
          color: #ff8585;
          font-size: 12px;
        }

        .state-panel,
        .empty-state {
          padding: 35px 20px;
          color: #8e9a8c;
          text-align: center;
          font-size: 13px;
        }

        .loading-spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          margin-right: 9px;
          vertical-align: middle;
          border: 2px solid #303b2c;
          border-top-color: #b8f34a;
          border-radius: 50%;
          animation: compare-spin 0.8s linear infinite;
        }

        @keyframes compare-spin {
          to { transform: rotate(360deg); }
        }

        .leader-panel {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-top: 28px;
          padding: 22px;
          border: 1px solid rgba(184,243,74,.3);
          border-radius: 13px;
          background: linear-gradient(110deg, rgba(184,243,74,.09), #101410);
        }

        .leader-panel h2 {
          margin: 8px 0 5px;
          font-size: 19px;
        }

        .leader-panel p {
          margin: 0;
          color: #8e9a8c;
          font-size: 11px;
        }

        .leader-panel strong {
          color: #b8f34a;
          font-size: clamp(20px, 3vw, 28px);
        }

        .comparison-section {
          margin-top: 38px;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .result-card {
          min-width: 0;
          padding: 19px;
        }

        .result-card-top {
          display: flex;
          align-items: center;
          color: #8e9a8c;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .result-card-top .trader-indicator {
          margin-right: 8px;
        }

        .result-wallet {
          margin-top: 17px;
          color: #dce3d8;
          font: 12px ui-monospace, monospace;
        }

        .main-pnl {
          margin-top: 17px;
          font-size: clamp(22px, 3vw, 29px);
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .main-pnl.positive {
          color: #b8f34a;
        }

        .main-pnl.negative {
          color: #ff8585;
        }

        .metric-caption {
          display: block;
          margin-top: 5px;
          color: #758170;
          font-size: 9px;
          letter-spacing: 1px;
        }

        .result-metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px 10px;
          margin-top: 23px;
          padding-top: 17px;
          border-top: 1px solid #273027;
        }

        .metric-label {
          color: #778273;
          font-size: 10px;
        }

        .metric-value {
          margin-top: 6px;
          color: #e6ece2;
          font-size: 13px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .profile-link {
          display: inline-block;
          margin-top: 22px;
          color: #a9b5a4;
          text-decoration: none;
          font-size: 11px;
        }

        .chart-panel {
          min-height: 360px;
          padding: 20px 14px;
        }

        .table-panel {
          overflow: hidden;
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .table-panel table {
          width: 100%;
          min-width: 550px;
          border-collapse: collapse;
          text-align: left;
        }

        .table-panel th,
        .table-panel td {
          padding: 15px 18px;
          border-bottom: 1px solid #273027;
          white-space: nowrap;
          font-size: 11px;
        }

        .table-panel th {
          background: #151b14;
          color: #899486;
          font-size: 9px;
          letter-spacing: 1px;
        }

        .table-panel td {
          color: #dce3d8;
        }

        .table-panel tr:last-child td {
          border-bottom: 0;
        }

        .method-note {
          margin-top: 24px;
          padding: 16px;
          border: 1px solid #252d25;
          border-radius: 9px;
          background: #101410;
        }

        .method-note strong {
          color: #b8f34a;
        }

        .comparison-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 45px;
          padding-top: 20px;
          border-top: 1px solid #252d25;
          color: #778273;
          font-size: 10px;
        }

        .footer-mark {
          display: grid;
          width: 23px;
          height: 23px;
          place-items: center;
          border-radius: 6px;
          background: #b8f34a;
          color: #10150b;
          font-weight: 900;
        }

        .comparison-footer a {
          margin-left: auto;
          color: #a9b5a4;
          text-decoration: none;
        }

        @media (max-width: 850px) {
          .results-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 650px) {
          .comparison-page {
            padding: 24px 13px 40px;
          }

          .wallet-input-grid,
          .results-grid {
            grid-template-columns: 1fr;
          }

          .compare-input-panel {
            padding: 16px;
          }

          .leader-panel {
            align-items: flex-start;
            flex-direction: column;
          }

          .chart-panel {
            padding: 12px 5px;
          }

          .panel-heading,
          .section-heading {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export default function TraderComparisonPage() {
  return (
    <Suspense
      fallback={
        <main className="comparison-page">
          <div className="state-panel">Loading comparison...</div>
        </main>
      }
    >
      <ComparisonContent />
    </Suspense>
  );
}
