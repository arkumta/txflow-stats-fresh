
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PnlPeriod = "pnl24h" | "pnl7d" | "pnl30d";
type SortOption = "trades" | "volume" | PnlPeriod;

type Trader = {
  wallet: string;
  trade_count: number;
  trading_volume: number;
  pnl?: {
    pnl24h: number | null;
    pnl7d: number | null;
    pnl30d: number | null;
  } | null;
  last_active: string;
};

const colors = {
  background: "#090b08",
  panel: "#11140f",
  panelSoft: "#151912",
  border: "#292e23",
  text: "#f2f4ed",
  muted: "#92998a",
  lime: "#c5f66b",
  limeDark: "#1a2410",
  red: "#ff7777",
};

const controlStyle: React.CSSProperties = {
  background: colors.panel,
  color: colors.text,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  minHeight: 44,
};

const cardStyle: React.CSSProperties = {
  background: `linear-gradient(145deg, #171d12 0%, ${colors.panel} 72%)`,
  border: "1px solid #303a26",
  borderRadius: 18,
  padding: 24,
  minWidth: 0,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.18)",
};

const numberFormat = new Intl.NumberFormat("en-US");

function getPnlValue(trader: Trader, sort: SortOption): number | null {
  if (
    sort !== "pnl24h" &&
    sort !== "pnl7d" &&
    sort !== "pnl30d"
  ) {
    return null;
  }

  const value = trader.pnl?.[sort];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

export default function TradersPage() {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [hours, setHours] = useState(168);
  const [sort, setSort] = useState<SortOption>("trades");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [walletSearch, setWalletSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [walletFilter, setWalletFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadTraders = useCallback(async (signal?: AbortSignal) => {
    setError("");

    try {
      const apiSort = sort === "volume" ? "volume" : "trades";
      const response = await fetch(
        `/api/traders?hours=${hours}&limit=100&sort=${apiSort}`,
        {
          cache: "no-store",
          signal,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to load the trader leaderboard."
        );
      }

      const nextTraders: Trader[] = Array.isArray(data.traders)
        ? data.traders
        : [];

      setTraders(nextTraders);
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the leaderboard. Please try again."
      );
    }
  }, [hours, sort]);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);

      try {
        await loadTraders(controller.signal);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    run();

    return () => controller.abort();
  }, [loadTraders, refreshKey]);

  const handleRefresh = async () => {
    if (refreshing || loading) return;

    setRefreshing(true);
    setError("");

    try {
      await loadTraders();
    } finally {
      setRefreshing(false);
    }
  };

  async function handleWalletSearch() {
    const query = walletSearch.trim();

    if (!query) {
      setSearchError("Please enter a wallet address.");
      return;
    }

    setSearchError("");

    try {
      const response = await fetch(
        `/api/search-traders?q=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Search failed.");
      }

      const matches: string[] = result.traders ?? [];

      if (matches.length === 0) {
        setSearchError("No matching trader found.");
        return;
      }

      if (matches.length > 1) {
        setSearchError(
          "Multiple wallets match. Enter more characters to narrow your search."
        );
        return;
      }

      window.location.href =
        `/traders/${encodeURIComponent(matches[0])}`;
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : "Unable to search traders. Please try again."
      );
    }
  }

  const rankedTraders = useMemo(() => {
    const result = [...traders];

    result.sort((a, b) => {
      if (
        sort === "pnl24h" ||
        sort === "pnl7d" ||
        sort === "pnl30d"
      ) {
        const aPnl = getPnlValue(a, sort);
        const bPnl = getPnlValue(b, sort);

        // Keep unavailable PnL values below known values.
        if (aPnl === null && bPnl !== null) return 1;
        if (aPnl !== null && bPnl === null) return -1;

        if (aPnl !== null && bPnl !== null && aPnl !== bPnl) {
          return bPnl - aPnl;
        }

        // Stable, useful tie-breakers.
        return (
          Number(b.trade_count || 0) - Number(a.trade_count || 0) ||
          Number(b.trading_volume || 0) -
            Number(a.trading_volume || 0)
        );
      }

      if (sort === "volume") {
        return (
          Number(b.trading_volume || 0) -
          Number(a.trading_volume || 0)
        );
      }

      return (
        Number(b.trade_count || 0) -
        Number(a.trade_count || 0)
      );
    });

    return result;
  }, [traders, sort]);

  // Rank is assigned before applying the wallet filter.
  const rankedRows = useMemo(
    () =>
      rankedTraders.map((trader, index) => ({
        trader,
        rank: index + 1,
      })),
    [rankedTraders]
  );

  const filteredRows = useMemo(() => {
    const query = walletFilter.trim().toLowerCase();

    if (!query) return rankedRows;

    return rankedRows.filter(({ trader }) =>
      trader.wallet.toLowerCase().includes(query)
    );
  }, [rankedRows, walletFilter]);

  const totalTrades = traders.reduce(
    (sum, trader) => sum + Number(trader.trade_count || 0),
    0
  );

  const totalVolume = traders.reduce(
    (sum, trader) => sum + Number(trader.trading_volume || 0),
    0
  );

  function shortenWallet(wallet: string) {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  }

  function formatDate(date: string) {
    if (!date) return "—";

    const parsed = new Date(date);

    return Number.isNaN(parsed.getTime())
      ? "—"
      : parsed.toLocaleString();
  }

  function formatVolume(volume: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(Number(volume) || 0);
  }

  function formatPnl(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }

    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);

    return value > 0 ? `+$${formatted}` : value < 0
      ? `-$${new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }).format(Math.abs(value))}`
      : "$0.00";
  }

  function pnlColor(value: number | null | undefined) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value === 0
    ) {
      return colors.muted;
    }

    return value > 0 ? colors.lime : colors.red;
  }

  const sortLabels: Record<SortOption, string> = {
    trades: "Most trades",
    volume: "Highest volume",
    pnl24h: "Highest 24H PnL",
    pnl7d: "Highest 7D PnL",
    pnl30d: "Highest 30D PnL",
  };

  const statCards = [
    {
      label: "ACTIVE TRADERS",
      value: traders.length.toLocaleString(),
      detail: "Wallets in selected period",
      accent: colors.text,
    },
    {
      label: "TOTAL TRADES",
      value: totalTrades.toLocaleString(),
      detail: "Across listed wallets",
      accent: colors.text,
    },
    {
      label: "COMBINED VOLUME",
      value: formatVolume(totalVolume),
      detail: "Volume from listed traders",
      accent: colors.lime,
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse at 50% -18%, #1a2112 0%, ${colors.background} 46%)`,
        color: colors.text,
        padding: "28px 24px 64px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 22,
            marginBottom: 28,
          }}
        >
          <div>
            <a
              href="/"
              style={{
                display: "inline-block",
                color: colors.muted,
                textDecoration: "none",
                fontSize: 13,
                marginBottom: 18,
              }}
            >
              ← Back to dashboard
            </a>

            <p
              style={{
                margin: "0 0 10px",
                color: colors.lime,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "1.8px",
              }}
            >
              TRADER INTELLIGENCE
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(36px, 4.5vw, 54px)",
                lineHeight: 1.05,
                letterSpacing: "-2.2px",
                fontWeight: 800,
                textShadow: "0 0 36px rgba(197, 246, 107, 0.08)",
              }}
            >
              Active <span style={{ color: colors.lime }}>Traders</span>
            </h1>

            <p
              style={{
                margin: "12px 0 0",
                color: colors.muted,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Explore wallet activity, trading volume and PnL across Txflow
              Perpetuals.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <label
              style={{
                display: "grid",
                gap: 6,
                color: colors.muted,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".7px",
              }}
            >
              TIME PERIOD
              <select
                value={hours}
                onChange={(event) => setHours(Number(event.target.value))}
                style={{ ...controlStyle, minWidth: 158, cursor: "pointer" }}
              >
                <option value={24}>Last 24 hours</option>
                <option value={168}>Last 7 days</option>
                <option value={720}>Last 30 days</option>
              </select>
            </label>

            <label
              style={{
                display: "grid",
                gap: 6,
                color: colors.muted,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".7px",
              }}
            >
              RANK BY
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SortOption)
                }
                style={{ ...controlStyle, minWidth: 175, cursor: "pointer" }}
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              style={{
                ...controlStyle,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: loading || refreshing ? "wait" : "pointer",
                opacity: loading || refreshing ? 0.65 : 1,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              <span>{refreshing ? "↻" : "⟳"}</span>
              {refreshing ? "Refreshing..." : "Refresh data"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          {statCards.map((stat, index) => (
            <div key={stat.label} style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: colors.muted,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "1px",
                  }}
                >
                  {stat.label}
                </p>

                <span
                  style={{
                    width: 30,
                    height: 30,
                    border: `1px solid ${
                      index === 2 ? "#3b4b25" : colors.border
                    }`,
                    background: index === 2 ? colors.limeDark : "#1b1f18",
                    color: colors.lime,
                    borderRadius: 9,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {index === 0 ? "↗" : index === 1 ? "≋" : "$"}
                </span>
              </div>

              <p
                style={{
                  margin: "20px 0 8px",
                  fontSize: "clamp(24px, 3vw, 31px)",
                  lineHeight: 1.15,
                  letterSpacing: "-.8px",
                  fontWeight: 750,
                  color: stat.accent,
                  overflowWrap: "anywhere",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {stat.value}
              </p>

              <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>
                {stat.detail}
              </p>
            </div>
          ))}
        </div>

        <section style={{ ...cardStyle, marginBottom: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>
              Find a trader
            </h2>

            <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>
              Look up a wallet address to open its individual profile.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleWalletSearch();
            }}
            style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
          >
            <input
              type="text"
              value={walletSearch}
              onChange={(event) => setWalletSearch(event.target.value)}
              placeholder="Paste a trader wallet address..."
              style={{ ...controlStyle, flex: "1 1 300px", minWidth: 0 }}
            />

            <button
              type="submit"
              style={{
                minHeight: 44,
                padding: "0 20px",
                borderRadius: 10,
                border: "1px solid #d4ff88",
                background: colors.lime,
                color: "#151b0c",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Search wallet ↗
            </button>
          </form>

          {searchError && (
            <p
              role="alert"
              style={{ color: colors.red, margin: "10px 0 0", fontSize: 13 }}
            >
              {searchError}
            </p>
          )}
        </section>

        <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              padding: "20px 22px",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                }}
              >
                Trader leaderboard
              </h2>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#a0a894",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                {sortLabels[sort]} · up to 100 traders
              </p>

              {lastUpdated && (
                <p style={{ margin: "5px 0 0", color: colors.muted, fontSize: 11 }}>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>

            <div style={{ color: colors.muted, fontSize: 12 }}>
              Showing{" "}
              <span style={{ color: colors.text, fontWeight: 750 }}>
                {filteredRows.length}
              </span>{" "}
              of{" "}
              <span style={{ color: colors.text, fontWeight: 750 }}>
                {traders.length}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "16px 22px",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <input
              type="text"
              value={walletFilter}
              onChange={(event) => setWalletFilter(event.target.value)}
              placeholder="Filter the leaderboard by wallet address..."
              aria-label="Filter leaderboard by wallet address"
              style={{
                ...controlStyle,
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          {loading ? (
            <div
              style={{
                padding: "56px 24px",
                textAlign: "center",
                color: colors.muted,
              }}
            >
              <div style={{ color: colors.lime, fontSize: 24, marginBottom: 12 }}>
                ◌
              </div>
              Loading trader activity...
            </div>
          ) : error ? (
            <div style={{ padding: 28, textAlign: "center" }}>
              <p style={{ color: colors.red, fontSize: 14 }}>{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                style={{
                  ...controlStyle,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Try again
              </button>
            </div>
          ) : traders.length === 0 ? (
            <div style={{ padding: "56px 24px", textAlign: "center" }}>
              <p style={{ margin: "0 0 8px", color: colors.text, fontWeight: 700 }}>
                No trader activity found
              </p>

              <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
                Try selecting a different time range.
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div
              style={{
                padding: "44px 24px",
                textAlign: "center",
                color: colors.muted,
                fontSize: 13,
              }}
            >
              No wallets match that filter.
              <div>
                <button
                  type="button"
                  onClick={() => setWalletFilter("")}
                  style={{
                    ...controlStyle,
                    marginTop: 14,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Clear filter
                </button>
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  minWidth: 1040,
                }}
              >
                <thead>
                  <tr style={{ background: "linear-gradient(90deg, #1a2113, #141810)" }}>
                    {[
                      "RANK",
                      "WALLET",
                      "TRADES",
                      "TRADING VOLUME",
                      "24H PNL",
                      "7D PNL",
                      "30D PNL",
                      "LAST ACTIVE",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        style={{
                          padding: "14px 18px",
                          color: colors.muted,
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "1px",
                          whiteSpace: "nowrap",
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map(({ trader, rank }) => (
                    <tr
                      key={trader.wallet}
                      style={{
                        borderBottom: `1px solid ${colors.border}`,
                        transition: "background 180ms ease",
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = "#191e14";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td style={{ padding: "18px 18px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 34,
                            height: 30,
                            padding: "0 7px",
                            borderRadius: 9,
                            background:
                              rank <= 3
                                ? "rgba(197, 246, 107, 0.10)"
                                : "transparent",
                            border: `1px solid ${
                              rank <= 3 ? "#455a2d" : "transparent"
                            }`,
                            color: rank <= 3 ? colors.lime : colors.muted,
                            fontSize: 12,
                            fontWeight: 800,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {String(rank).padStart(2, "0")}
                        </span>
                      </td>

                      <td style={{ padding: "18px 18px", whiteSpace: "nowrap" }}>
                        <a
                          href={`/traders/${encodeURIComponent(trader.wallet)}`}
                          title={trader.wallet}
                          style={{
                            color: "#e7f5d4",
                            textDecoration: "none",
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {shortenWallet(trader.wallet)}{" "}
                          <span style={{ color: colors.lime }}>↗</span>
                        </a>
                      </td>

                      <td
                        style={{
                          padding: "18px",
                          fontSize: 13,
                          fontWeight: 650,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {numberFormat.format(Number(trader.trade_count) || 0)}
                      </td>

                      <td
                        style={{
                          padding: "18px",
                          color: colors.lime,
                          fontSize: 13,
                          fontWeight: 750,
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatVolume(trader.trading_volume)}
                      </td>

                      <td
                        style={{
                          padding: "18px",
                          color: pnlColor(trader.pnl?.pnl24h),
                          fontSize: 13,
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatPnl(trader.pnl?.pnl24h)}
                      </td>

                      <td
                        style={{
                          padding: "18px",
                          color: pnlColor(trader.pnl?.pnl7d),
                          fontSize: 13,
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatPnl(trader.pnl?.pnl7d)}
                      </td>

                      <td
                        style={{
                          padding: "18px",
                          color: pnlColor(trader.pnl?.pnl30d),
                          fontSize: 13,
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatPnl(trader.pnl?.pnl30d)}
                      </td>

                      <td
                        style={{
                          padding: "18px",
                          color: colors.muted,
                          whiteSpace: "nowrap",
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatDate(trader.last_active)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p
          style={{
            color: "#73796b",
            fontSize: 11,
            lineHeight: 1.7,
            margin: "16px 2px 0",
          }}
        >
          Showing up to 100 wallets. PnL sorting uses the realized PnL values
          returned by the API. Unavailable PnL values are shown as dashes and
          placed after known values. Rankings remain unchanged when you filter
          wallet addresses.
        </p>
      </div>
    </main>
  );
}
