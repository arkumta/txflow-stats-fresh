
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Market = {
  name: string;
  index?: number;
  maxLeverage?: number;
  haltTrading?: boolean;
  delisted?: boolean;
};

type MarketData = {
  coin: string;
  lastPrice?: string | number;
  markPx?: string | number;
  oraclePx?: string | number;
  prevDayPx?: string | number;
  dayNtlVlm?: string | number;
  dayHighPx?: string | number;
  dayLowPx?: string | number;
  openInterest?: string | number;
  nodeCtx?: {
    funding?: string | number;
    markPx?: string | number;
    lastPrice?: string | number;
  };
};

type SortKey = "volume" | "price" | "openInterest" | "funding" | "change";

const LIME = "#c7f36b";

function number(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function compactMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function price(value: number): string {
  if (!value) return "—";

  return money(value, value >= 100 ? 2 : value >= 1 ? 4 : 6);
}

function percent(value: number, decimals = 2): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

function MarketIcon({ name }: { name: string }) {
  const symbol = name.split("-")[0].replace(/[^a-zA-Z0-9]/g, "");

  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        background: "#20271b",
        border: "1px solid #39452a",
        display: "grid",
        placeItems: "center",
        color: LIME,
        fontWeight: 800,
        fontSize: symbol.length > 4 ? 10 : 12,
        flexShrink: 0,
      }}
    >
      {symbol.slice(0, 4).toUpperCase()}
    </div>
  );
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("volume");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadMarkets = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");

    try {
      const [listResponse, dataResponse] = await Promise.all([
        fetch("/api/market-list", { cache: "no-store" }),
        fetch("/api/market-data", { cache: "no-store" }),
      ]);

      if (!listResponse.ok || !dataResponse.ok) {
        throw new Error("Market data is temporarily unavailable.");
      }

      const [listResult, dataResult] = await Promise.all([
        listResponse.json(),
        dataResponse.json(),
      ]);

      if (!Array.isArray(listResult) || !Array.isArray(dataResult)) {
        throw new Error("The market API returned an unexpected response.");
      }

      setMarkets(listResult);
      setMarketData(dataResult);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load markets. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkets();

    const interval = setInterval(() => {
      void loadMarkets();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadMarkets]);

  const dataByCoin = useMemo(() => {
    return new Map(marketData.map((item) => [item.coin, item]));
  }, [marketData]);

  const rows = useMemo(() => {
    return markets
      .filter((market) => {
        if (!showInactive && (market.haltTrading || market.delisted)) {
          return false;
        }

        return market.name.toLowerCase().includes(search.trim().toLowerCase());
      })
      .map((market) => {
        const data = dataByCoin.get(market.name);
        const lastPrice = number(data?.lastPrice ?? data?.nodeCtx?.lastPrice);
        const markPrice = number(data?.markPx ?? data?.nodeCtx?.markPx);
        const effectivePrice = lastPrice || markPrice;
        const previousPrice = number(data?.prevDayPx);
        const volume = number(data?.dayNtlVlm);
        const openInterest = number(data?.openInterest) * (markPrice || effectivePrice);
        const funding = number(data?.nodeCtx?.funding);
        const change =
          previousPrice > 0
            ? ((effectivePrice - previousPrice) / previousPrice) * 100
            : null;

        return {
          ...market,
          data,
          lastPrice: effectivePrice,
          markPrice,
          volume,
          openInterest,
          funding,
          change,
          high: number(data?.dayHighPx),
          low: number(data?.dayLowPx),
        };
      })
      .sort((a, b) => {
        const direction = sortDirection === "desc" ? -1 : 1;

        const aValue =
          sortBy === "volume"
            ? a.volume
            : sortBy === "price"
              ? a.lastPrice
              : sortBy === "openInterest"
                ? a.openInterest
                : sortBy === "funding"
                  ? a.funding
                  : a.change ?? Number.NEGATIVE_INFINITY;

        const bValue =
          sortBy === "volume"
            ? b.volume
            : sortBy === "price"
              ? b.lastPrice
              : sortBy === "openInterest"
                ? b.openInterest
                : sortBy === "funding"
                  ? b.funding
                  : b.change ?? Number.NEGATIVE_INFINITY;

        return (aValue - bValue) * direction;
      });
  }, [markets, dataByCoin, search, sortBy, sortDirection, showInactive]);

  const totals = useMemo(() => {
    const active = markets.filter(
      (market) => !market.haltTrading && !market.delisted
    );

    const totalVolume = marketData.reduce(
      (sum, item) => sum + number(item.dayNtlVlm),
      0
    );

    const totalOpenInterest = marketData.reduce((sum, item) => {
      const mark = number(item.markPx ?? item.nodeCtx?.markPx);
      const last = number(item.lastPrice ?? item.nodeCtx?.lastPrice);
      return sum + number(item.openInterest) * (mark || last);
    }, 0);

    return {
      totalVolume,
      totalOpenInterest,
      activeMarkets: active.length,
      listedMarkets: markets.length,
    };
  }, [markets, marketData]);

  const cardStyle = {
    background: "#11130f",
    border: "1px solid #292d25",
    borderRadius: 16,
    padding: 22,
    minWidth: 0,
  } as const;

  const muted = "#8b9085";

  function changeSort(key: SortKey) {
    if (sortBy === key) {
      setSortDirection((previous) => previous === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      setSortDirection("desc");
    }
  }

  function sortLabel(key: SortKey, label: string) {
    return (
      <button
        type="button"
        onClick={() => changeSort(key)}
        style={{
          border: 0,
          background: "transparent",
          color: sortBy === key ? LIME : muted,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
          padding: "12px 10px",
          textAlign: "right",
        }}
      >
        {label} {sortBy === key ? (sortDirection === "desc" ? "↓" : "↑") : ""}
      </button>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090a08",
        color: "#f5f6f2",
        padding: "30px 0 70px",
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          padding: "0 28px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: muted,
            fontSize: 12,
            marginBottom: 22,
          }}
        >
          <Link href="/" style={{ color: muted, textDecoration: "none" }}>
            Dashboard
          </Link>
          <span>/</span>
          <span style={{ color: LIME }}>Markets</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 30,
          }}
        >
          <div>
            <div
              style={{
                color: LIME,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 2,
                marginBottom: 12,
              }}
            >
              TXFLOW PERPETUALS
            </div>
            <h1
              style={{
                fontSize: "clamp(32px, 5vw, 48px)",
                lineHeight: 1.1,
                letterSpacing: -1.5,
                margin: "0 0 12px",
                fontWeight: 750,
              }}
            >
              Markets
            </h1>
            <p style={{ color: muted, margin: 0, fontSize: 14 }}>
              Explore prices, trading volume, open interest and funding rates.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadMarkets(true)}
            disabled={refreshing}
            style={{
              background: "#c7f36b",
              color: "#11150b",
              border: 0,
              borderRadius: 10,
              padding: "12px 17px",
              fontWeight: 800,
              cursor: refreshing ? "wait" : "pointer",
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh markets"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div style={cardStyle}>
            <div style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              24H TRADING VOLUME
            </div>
            <div style={{ fontSize: 29, fontWeight: 750, marginTop: 15 }}>
              {loading && !marketData.length ? "Loading..." : compactMoney(totals.totalVolume)}
            </div>
            <div style={{ color: muted, fontSize: 12, marginTop: 9 }}>
              Across available markets
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              OPEN INTEREST
            </div>
            <div style={{ fontSize: 29, fontWeight: 750, marginTop: 15 }}>
              {loading && !marketData.length ? "Loading..." : compactMoney(totals.totalOpenInterest)}
            </div>
            <div style={{ color: muted, fontSize: 12, marginTop: 9 }}>
              Estimated USD value of open positions
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              ACTIVE MARKETS
            </div>
            <div style={{ fontSize: 29, fontWeight: 750, marginTop: 15 }}>
              {loading && !markets.length ? "Loading..." : totals.activeMarkets.toLocaleString("en-US")}
            </div>
            <div style={{ color: muted, fontSize: 12, marginTop: 9 }}>
              {totals.listedMarkets} listed markets
            </div>
          </div>
        </div>

        <section
          style={{
            background: "#10120f",
            border: "1px solid #292d25",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              padding: 20,
              borderBottom: "1px solid #292d25",
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, margin: "0 0 7px", fontWeight: 750 }}>
                All markets
              </h2>
              <p style={{ color: muted, fontSize: 12, margin: 0 }}>
                {rows.length} markets shown · Sorted by {sortBy === "openInterest" ? "open interest" : sortBy === "change" ? "24H change" : sortBy}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: muted,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                  style={{ accentColor: LIME }}
                />
                Show inactive
              </label>

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search markets..."
                aria-label="Search markets"
                style={{
                  width: 220,
                  maxWidth: "100%",
                  padding: "12px 14px",
                  border: "1px solid #34392f",
                  borderRadius: 10,
                  outline: "none",
                  background: "#090a08",
                  color: "#f5f6f2",
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                margin: 20,
                padding: 16,
                background: "#251615",
                border: "1px solid #66312d",
                borderRadius: 10,
                color: "#ffb7ad",
                fontSize: 13,
              }}
            >
              {error}
              <button
                type="button"
                onClick={() => void loadMarkets(true)}
                style={{
                  marginLeft: 12,
                  background: "transparent",
                  border: 0,
                  color: LIME,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Try again
              </button>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 1050,
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #292d25" }}>
                  <th
                    style={{
                      color: muted,
                      textAlign: "left",
                      fontSize: 11,
                      padding: "0 20px",
                      fontWeight: 700,
                    }}
                  >
                    MARKET
                  </th>
                  <th style={{ textAlign: "right" }}>{sortLabel("price", "LAST PRICE")}</th>
                  <th style={{ textAlign: "right" }}>{sortLabel("change", "24H CHANGE")}</th>
                  <th style={{ textAlign: "right" }}>{sortLabel("volume", "24H VOLUME")}</th>
                  <th style={{ textAlign: "right" }}>{sortLabel("openInterest", "OPEN INTEREST")}</th>
                  <th style={{ textAlign: "right" }}>{sortLabel("funding", "FUNDING RATE")}</th>
                  <th style={{ textAlign: "right", padding: "12px 20px", color: muted, fontSize: 11 }}>
                    24H RANGE
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && !markets.length ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 50, textAlign: "center", color: muted }}>
                      Loading Txflow markets...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 50, textAlign: "center", color: muted }}>
                      {error ? "Market data could not be loaded." : "No markets match your search."}
                    </td>
                  </tr>
                ) : (
                  rows.map((market) => {
                    const fundingPercent = market.funding * 100;
                    const change = market.change;

                    return (
                      <tr
                        key={market.name}
                        style={{ borderBottom: "1px solid #22251f" }}
                      >
                        <td style={{ padding: "15px 20px" }}>
                          <Link
                            href={`/markets/${encodeURIComponent(market.name)}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              textDecoration: "none",
                              color: "#f5f6f2",
                            }}
                          >
                            <MarketIcon name={market.name} />
                            <span>
                              <span style={{ display: "block", fontWeight: 750 }}>
                                {market.name}
                              </span>
                              <span style={{ display: "block", color: muted, fontSize: 11, marginTop: 4 }}>
                                Perpetual
                                {market.maxLeverage ? ` · Up to ${market.maxLeverage}x` : ""}
                              </span>
                            </span>
                          </Link>
                        </td>

                        <td style={{ textAlign: "right", padding: "15px 10px", fontWeight: 650 }}>
                          {price(market.lastPrice)}
                        </td>

                        <td
                          style={{
                            textAlign: "right",
                            padding: "15px 10px",
                            color: change === null ? muted : change >= 0 ? LIME : "#ff8177",
                          }}
                        >
                          {change === null ? "—" : percent(change)}
                        </td>

                        <td style={{ textAlign: "right", padding: "15px 10px", fontWeight: 650 }}>
                          {market.data ? compactMoney(market.volume) : "—"}
                        </td>

                        <td style={{ textAlign: "right", padding: "15px 10px" }}>
                          {market.data ? compactMoney(market.openInterest) : "—"}
                        </td>

                        <td
                          style={{
                            textAlign: "right",
                            padding: "15px 10px",
                            color: fundingPercent > 0 ? LIME : fundingPercent < 0 ? "#ff8177" : muted,
                          }}
                        >
                          {market.data ? percent(fundingPercent, 4) : "—"}
                        </td>

                        <td style={{ textAlign: "right", padding: "15px 20px" }}>
                          <span style={{ display: "block", fontSize: 12 }}>
                            {market.high ? price(market.high) : "—"}
                          </span>
                          <span style={{ display: "block", color: muted, fontSize: 11, marginTop: 4 }}>
                            Low {market.low ? price(market.low) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #292d25",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              color: muted,
              fontSize: 11,
            }}
          >
            <span>
              Values come from the existing Txflow API. Missing values are shown as dashes.
            </span>
            <span>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}`
                : "Waiting for market data"}
              {" · "}
              Refreshes every 30 seconds
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
