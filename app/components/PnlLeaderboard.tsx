
"use client";

import { useEffect, useMemo, useState } from "react";

type Trader = {
  wallet: string;
  grossRealizedPnl: number;
  fees: number;
  netRealizedPnl: number;
  tradeCount: number;
  fillsWithFee: number;
  lastActive: string;
};

type Period = "24H" | "7D" | "SINCE_OCT_10";

type SortOption =
  | "netPnl"
  | "grossPnl"
  | "fees"
  | "fills"
  | "lastActive";

function formatMoney(value: number) {
  const amount = Number(value) || 0;

  return `${amount < 0 ? "-$" : "$"}${Math.abs(amount).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 8)}...${wallet.slice(-6)}`;
}

function formatDate(value: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export default function PnlLeaderboard() {
  const [period, setPeriod] = useState<Period>("SINCE_OCT_10");
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [walletSearch, setWalletSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("netPnl");
  const [copiedWallet, setCopiedWallet] = useState("");
  const [copyError, setCopyError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setTraders([]);

      try {
        const response = await fetch(
          `/api/pnl-leaderboard?period=${period}&limit=100`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(
            result?.error || "Unable to load rankings."
          );
        }

        if (!Array.isArray(result.traders)) {
          throw new Error(
            "Invalid leaderboard data returned by the API."
          );
        }

        setTraders(result.traders);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load rankings."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [period, reloadKey]);

  const displayedTraders = useMemo(() => {
    const query = walletSearch.trim().toLowerCase();

    const filtered = traders.filter((trader) =>
      trader.wallet.toLowerCase().includes(query)
    );

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "grossPnl":
          return b.grossRealizedPnl - a.grossRealizedPnl;

        case "fees":
          return a.fees - b.fees;

        case "fills":
          return b.tradeCount - a.tradeCount;

        case "lastActive":
          return (
            new Date(b.lastActive).getTime() -
            new Date(a.lastActive).getTime()
          );

        case "netPnl":
        default:
          return b.netRealizedPnl - a.netRealizedPnl;
      }
    });
  }, [traders, walletSearch, sortBy]);

  const latestActivity = useMemo(() => {
    const timestamps = traders
      .map((trader) => new Date(trader.lastActive).getTime())
      .filter((timestamp) => Number.isFinite(timestamp));

    if (timestamps.length === 0) {
      return null;
    }

    return new Date(Math.max(...timestamps)).toISOString();
  }, [traders]);

  async function copyWallet(wallet: string) {
    setCopyError("");
    setCopiedWallet("");

    try {
      await navigator.clipboard.writeText(wallet);
      setCopiedWallet(wallet);

      window.setTimeout(() => {
        setCopiedWallet((current) =>
          current === wallet ? "" : current
        );
      }, 2000);
    } catch {
      setCopyError(
        "Copy failed. Open the trader profile to copy the address manually."
      );
    }
  }

  const cellStyle: React.CSSProperties = {
    padding: "15px 12px",
    borderBottom: "1px solid #202020",
    fontSize: "13px",
    whiteSpace: "nowrap",
  };

  const controlStyle: React.CSSProperties = {
    background: "#151515",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "6px",
    padding: "10px 12px",
    minHeight: "40px",
    maxWidth: "100%",
  };

  return (
    <section
      style={{
        marginTop: "32px",
        background: "#0d0d0d",
        border: "1px solid #222",
        borderRadius: "10px",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "10px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "24px" }}>
            Top Traders by Realized PnL
          </h2>

          <p
            style={{
              color: "#777",
              fontSize: "13px",
              margin: "8px 0 0",
            }}
          >
            Ranked by recorded closed PnL minus recorded fees.
          </p>
        </div>

        <select
          value={period}
          onChange={(event) =>
            setPeriod(event.target.value as Period)
          }
          aria-label="PnL leaderboard period"
          style={controlStyle}
        >
          <option value="24H">Last 24 hours</option>
          <option value="7D">Last 7 days</option>
          <option value="SINCE_OCT_10">
            Historical (Since Oct 10)
          </option>
        </select>
      </div>

      {!loading && !error && period === "SINCE_OCT_10" && traders.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            border: "1px solid #66501e",
            background: "#211b0d",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              color: "#facc15",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "7px",
            }}
          >
            Historical rankings
          </div>

          <p
            style={{
              color: "#c5b98e",
              fontSize: "13px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            These rankings use previously indexed trading activity
            since October 10, 2026. They are historical results,
            not live market rankings.
          </p>

          {latestActivity && (
            <p
              style={{
                color: "#aaa17f",
                fontSize: "12px",
                margin: "10px 0 0",
              }}
            >
              Latest activity among returned traders:{" "}
              <strong>{formatDate(latestActivity)}</strong>
            </p>
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginTop: "22px",
          marginBottom: "18px",
        }}
      >
        <input
          type="search"
          value={walletSearch}
          onChange={(event) => setWalletSearch(event.target.value)}
          placeholder="Search wallet address..."
          aria-label="Search wallet address"
          style={{
            ...controlStyle,
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        <select
          value={sortBy}
          onChange={(event) =>
            setSortBy(event.target.value as SortOption)
          }
          aria-label="Sort PnL leaderboard"
          style={controlStyle}
        >
          <option value="netPnl">Highest net PnL</option>
          <option value="grossPnl">Highest gross PnL</option>
          <option value="fees">Lowest fees</option>
          <option value="fills">Most fills</option>
          <option value="lastActive">Recently active</option>
        </select>
      </div>

      <p style={{ color: "#888", fontSize: "12px", marginBottom: "18px" }}>
        {loading
          ? "Loading traders..."
          : `Showing ${displayedTraders.length} of ${traders.length} loaded traders`}
      </p>

      {loading ? (
        <p style={{ color: "#999" }}>Loading PnL rankings...</p>
      ) : error ? (
        <div>
          <p style={{ color: "#f87171" }}>{error}</p>

          <button
            onClick={() => setReloadKey((key) => key + 1)}
            style={{
              ...controlStyle,
              cursor: "pointer",
            }}
          >
            Retry loading rankings
          </button>
        </div>
      ) : displayedTraders.length === 0 ? (
        <div
          style={{
            padding: "24px",
            border: "1px solid #292929",
            borderRadius: "8px",
            background: "#111",
          }}
        >
          <h3 style={{ margin: "0 0 10px", fontSize: "16px" }}>
            {walletSearch.trim()
              ? "No matching traders"
              : "No indexed trading activity"}
          </h3>

          <p
            style={{
              color: "#999",
              fontSize: "13px",
              lineHeight: 1.6,
              margin: "0 0 16px",
            }}
          >
            {walletSearch.trim()
              ? "No loaded traders match that wallet address. Try another address or clear your search."
              : period === "24H"
                ? "No fills are currently recorded for the last 24 hours. Historical rankings are available from October 10."
                : period === "7D"
                  ? "No fills are currently recorded for the last 7 days. Historical rankings are available from October 10."
                  : "No historical trader activity was returned for this period."}
          </p>

          {walletSearch.trim() ? (
            <button
              onClick={() => setWalletSearch("")}
              style={{
                ...controlStyle,
                cursor: "pointer",
              }}
            >
              Clear wallet search
            </button>
          ) : period !== "SINCE_OCT_10" ? (
            <button
              onClick={() => {
                setWalletSearch("");
                setPeriod("SINCE_OCT_10");
              }}
              style={{
                ...controlStyle,
                cursor: "pointer",
                border: "1px solid #a3e635",
                color: "#a3e635",
              }}
            >
              View historical rankings
            </button>
          ) : (
            <button
              onClick={() => setReloadKey((key) => key + 1)}
              style={{
                ...controlStyle,
                cursor: "pointer",
              }}
            >
              Retry loading rankings
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              minWidth: "900px",
            }}
          >
            <thead>
              <tr style={{ color: "#777", fontSize: "11px" }}>
                {[
                  "RANK",
                  "WALLET",
                  "NET REALIZED PNL",
                  "GROSS PNL",
                  "FEES",
                  "FILLS",
                  "LAST ACTIVE",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "14px 12px",
                      borderBottom: "1px solid #292929",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayedTraders.map((trader, index) => (
                <tr key={trader.wallet}>
                  <td style={cellStyle}>{index + 1}</td>

                  <td style={{ ...cellStyle, fontFamily: "monospace" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <a
                        href={`/traders/${encodeURIComponent(trader.wallet)}`}
                        title={`Open profile for ${trader.wallet}`}
                        style={{
                          color: "#ddd",
                          textDecoration: "none",
                        }}
                      >
                        {shortWallet(trader.wallet)}
                      </a>

                      <button
                        onClick={() => copyWallet(trader.wallet)}
                        title="Copy full wallet address"
                        aria-label={`Copy ${trader.wallet}`}
                        style={{
                          background: "#191919",
                          border: "1px solid #333",
                          borderRadius: "5px",
                          padding: "5px 7px",
                          color: "#aaa",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        {copiedWallet === trader.wallet
                          ? "Copied"
                          : "Copy"}
                      </button>
                    </div>
                  </td>

                  <td
                    style={{
                      ...cellStyle,
                      color:
                        trader.netRealizedPnl > 0
                          ? "#4ade80"
                          : trader.netRealizedPnl < 0
                            ? "#f87171"
                            : "#fff",
                      fontWeight: 600,
                    }}
                  >
                    {formatMoney(trader.netRealizedPnl)}
                  </td>

                  <td style={cellStyle}>
                    {formatMoney(trader.grossRealizedPnl)}
                  </td>

                  <td style={cellStyle}>
                    {formatMoney(trader.fees)}
                  </td>

                  <td style={cellStyle}>
                    {Number(trader.tradeCount || 0).toLocaleString("en-US")}
                  </td>

                  <td style={{ ...cellStyle, color: "#999" }}>
                    {formatDate(trader.lastActive)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {copyError && (
        <p style={{ color: "#f87171", fontSize: "12px" }}>
          {copyError}
        </p>
      )}

      <div
        style={{
          borderTop: "1px solid #222",
          marginTop: "20px",
          paddingTop: "15px",
        }}
      >
        <p
          style={{
            color: "#777",
            fontSize: "12px",
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          Rankings use stored fills and may be incomplete if historical
          data has not been fully ingested. Wallet search filters the
          100 traders loaded for the selected period; it does not search
          every wallet in the database.
        </p>

        <p
          style={{
            color: "#777",
            fontSize: "12px",
            lineHeight: 1.7,
            margin: "8px 0 0",
          }}
        >
          Fees reflect recorded database values. A zero fee value should
          not automatically be interpreted as proof that no trading fees
          were charged.
        </p>
      </div>
    </section>
  );
}
