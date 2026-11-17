
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

type MarketRow = Market & {
  data?: MarketData;
  lastPrice: number;
  markPrice: number;
  volume: number;
  openInterest: number;
  funding: number;
  change: number | null;
  high: number;
  low: number;
};

const LIME = "#c7f36b";
const MUTED = "#8b9085";

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

function MarketMoverPanel({
  title,
  markets,
  positive,
  loading,
}: {
  title: string;
  markets: MarketRow[];
  positive: boolean;
  loading: boolean;
}) {
  const accent = positive ? LIME : "#ff8177";

  return (
    <section
      style={{
        background: "#10120f",
        border: "1px solid #292d25",
        borderRadius: 16,
        padding: 20,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 17, margin: 0, fontWeight: 750 }}>
          {title}
        </h2>
        <span
          style={{
            color: accent,
            background: positive ? "#20271b" : "#2a1b19",
            borderRadius: 8,
            padding: "6px 9px",
            fontSize: 11,
            fontWeight: 750,
          }}
        >
          {positive ? "▲ GAINERS" : "▼ LOSERS"}
        </span>
      </div>

      {loading ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Loading market data...</p>
      ) : markets.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 13 }}>
          No price change data available.
        </p>
      ) : (
        markets.map((market, index) => (
          <Link
            key={market.name}
            href={`/markets/${encodeURIComponent(market.name)}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 0",
              borderTop: "1px solid #292d25",
              textDecoration: "none",
              color: "#f5f6f2",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: MUTED,
                  fontSize: 11,
                  width: 15,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              <MarketIcon name={market.name} />
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 13 }}>
                  {market.name}
                </strong>
                <span
                  style={{
                    display: "block",
                    color: MUTED,
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  {price(market.lastPrice)}
                </span>
              </span>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <strong style={{ color: accent, fontSize: 14 }}>
                {percent(market.change ?? 0)}
              </strong>
              <span
                style={{
                  display: "block",
                  color: MUTED,
                  fontSize: 10,
                  marginTop: 4,
                }}
              >
                Vol. {compactMoney(market.volume)}
              </span>
            </div>
          </Link>
        ))
      )}
    </section>
  );
}

function FundingRatePanel({
  title,
  markets,
  positive,
  loading,
}: {
  title: string;
  markets: MarketRow[];
  positive: boolean;
  loading: boolean;
}) {
  const accent = positive ? LIME : "#ff8177";

  return (
    <section
      style={{
        background: "#10120f",
        border: "1px solid #292d25",
        borderRadius: 16,
        padding: 20,
        minWidth: 0,
      }}
    >
      <h2 style={{ fontSize: 17, margin: "0 0 8px", fontWeight: 750 }}>
        {title}
      </h2>
      <p style={{ color: MUTED, fontSize: 11, margin: "0 0 12px" }}>
        {positive
          ? "Long positions pay short positions."
          : "Short positions pay long positions."}
      </p>

      {loading ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Loading funding rates...</p>
      ) : markets.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 13 }}>
          No non-zero funding rates available.
        </p>
      ) : (
        markets.map((market, index) => (
          <Link
            key={market.name}
            href={`/markets/${encodeURIComponent(market.name)}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              borderTop: "1px solid #292d25",
              textDecoration: "none",
              color: "#f5f6f2",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ color: MUTED, fontSize: 11 }}>{index + 1}</span>
              <MarketIcon name={market.name} />
              <div>
                <strong style={{ display: "block", fontSize: 13 }}>
                  {market.name}
                </strong>
                <span style={{ color: MUTED, fontSize: 11 }}>
                  Est. ${Math.abs(market.funding) * 1000 < 0.01
                    ? (Math.abs(market.funding) * 1000).toFixed(6)
                    : (Math.abs(market.funding) * 1000).toFixed(4)} per $1,000
                </span>
              </div>
            </div>

            <strong style={{ color: accent, fontSize: 14 }}>
              {percent(market.funding * 100, 4)}
            </strong>
          </Link>
        ))
      )}
    </section>
  );
}


function MarketVolumePanel({
  markets,
  loading,
}: {
  markets: MarketRow[];
  loading: boolean;
}) {
  const totalVolume = markets.reduce((sum, market) => sum + market.volume, 0);

  return (
    <section
      style={{
        background: "#10120f",
        border: "1px solid #292d25",
        borderRadius: 16,
        padding: 20,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 17, margin: 0, fontWeight: 750 }}>
          Top Markets by Volume
        </h2>
        <span
          style={{
            color: LIME,
            background: "#20271b",
            borderRadius: 8,
            padding: "6px 9px",
            fontSize: 11,
            fontWeight: 750,
            whiteSpace: "nowrap",
          }}
        >
          24H VOLUME
        </span>
      </div>
      <p style={{ color: MUTED, fontSize: 11, margin: "0 0 12px" }}>
        Top 10 markets ranked by trading volume over the last 24 hours.
      </p>

      {loading ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Loading volume data...</p>
      ) : markets.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 13 }}>No volume data available.</p>
      ) : (
        markets.map((market, index) => {
          const volumeShare = totalVolume > 0
            ? (market.volume / totalVolume) * 100
            : 0;

          return (
            <Link
              key={market.name}
              href={`/markets/${encodeURIComponent(market.name)}`}
              style={{
                display: "block",
                padding: "13px 0",
                borderTop: "1px solid #292d25",
                textDecoration: "none",
                color: "#f5f6f2",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: MUTED, fontSize: 11, width: 16, flexShrink: 0 }}>
                    {index + 1}
                  </span>
                  <MarketIcon name={market.name} />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 13 }}>
                      {market.name}
                    </strong>
                    <span
                      style={{
                        display: "block",
                        color: MUTED,
                        fontSize: 11,
                        marginTop: 4,
                      }}
                    >
                      Price {price(market.lastPrice)} · OI {compactMoney(market.openInterest)}
                    </span>
                  </span>
                </div>
                <strong style={{ fontSize: 14, whiteSpace: "nowrap" }}>
                  {compactMoney(market.volume)}
                </strong>
              </div>
              <div
                style={{
                  height: 5,
                  background: "#252a20",
                  borderRadius: 99,
                  overflow: "hidden",
                  margin: "10px 0 0 26px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, volumeShare)}%`,
                    background: LIME,
                    borderRadius: 99,
                  }}
                />
              </div>
              <div
                style={{
                  color: MUTED,
                  fontSize: 10,
                  textAlign: "right",
                  marginTop: 5,
                }}
              >
                {volumeShare.toFixed(2)}% of top 10 volume
              </div>
            </Link>
          );
        })
      )}
    </section>
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

  const dataByCoin = useMemo(
    () => new Map(marketData.map((item) => [item.coin, item])),
    [marketData]
  );

  const rows = useMemo<MarketRow[]>(() => {
    return markets
      .filter((market) => {
        if (!showInactive && (market.haltTrading || market.delisted)) {
          return false;
        }

        return market.name
          .toLowerCase()
          .includes(search.trim().toLowerCase());
      })
      .map((market) => {
        const data = dataByCoin.get(market.name);
        const lastPrice = number(data?.lastPrice ?? data?.nodeCtx?.lastPrice);
        const markPrice = number(data?.markPx ?? data?.nodeCtx?.markPx);
        const effectivePrice = lastPrice || markPrice;
        const previousPrice = number(data?.prevDayPx);
        const volume = number(data?.dayNtlVlm);
        const openInterest =
          number(data?.openInterest) * (markPrice || effectivePrice);
        const funding = number(data?.nodeCtx?.funding);

        const change =
          previousPrice > 0 && effectivePrice > 0
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
  }, [
    markets,
    dataByCoin,
    search,
    sortBy,
    sortDirection,
    showInactive,
  ]);

  // Market Movers use all active markets, independently of the table search.
  const activeMarketRows = useMemo(
    () =>
      rows.filter(
        (market) => !market.haltTrading && !market.delisted
      ),
    [rows]
  );

  const topGainers = useMemo(
    () =>
      [...activeMarketRows]
        .filter((market) => market.change !== null && market.change > 0)
        .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
        .slice(0, 5),
    [activeMarketRows]
  );

  const topLosers = useMemo(
    () =>
      [...activeMarketRows]
        .filter((market) => market.change !== null && market.change < 0)
        .sort((a, b) => (a.change ?? 0) - (b.change ?? 0))
        .slice(0, 5),
    [activeMarketRows]
  );

const topPositiveFunding = useMemo(
  () =>
    [...activeMarketRows]
      .filter((market) => market.funding > 0)
      .sort((a, b) => b.funding - a.funding)
      .slice(0, 5),
  [activeMarketRows]
);

const topNegativeFunding = useMemo(
  () =>
    [...activeMarketRows]
      .filter((market) => market.funding < 0)
      .sort((a, b) => a.funding - b.funding)
      .slice(0, 5),
  [activeMarketRows]
);

  const topVolumeMarkets = useMemo(
    () =>
      [...activeMarketRows]
        .filter((market) => market.data && market.volume > 0)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10),
    [activeMarketRows]
  );

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

  function changeSort(key: SortKey) {
    if (sortBy === key) {
      setSortDirection((previous) =>
        previous === "desc" ? "asc" : "desc"
      );
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
          color: sortBy === key ? LIME : MUTED,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
          padding: "12px 10px",
          textAlign: "right",
        }}
      >
        {label}{" "}
        {sortBy === key
          ? sortDirection === "desc"
            ? "↓"
            : "↑"
          : ""}
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
            color: MUTED,
            fontSize: 12,
            marginBottom: 22,
          }}
        >
          <Link href="/" style={{ color: MUTED, textDecoration: "none" }}>
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
            <p style={{ color: MUTED, margin: 0, fontSize: 14 }}>
              Explore prices, trading volume, open interest and funding rates.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadMarkets(true)}
            disabled={refreshing}
            style={{
              background: LIME,
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
            <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              24H TRADING VOLUME
            </div>
            <div style={{ fontSize: 29, fontWeight: 750, marginTop: 15 }}>
              {loading && !marketData.length
                ? "Loading..."
                : compactMoney(totals.totalVolume)}
            </div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 9 }}>
              Across available markets
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              OPEN INTEREST
            </div>
            <div style={{ fontSize: 29, fontWeight: 750, marginTop: 15 }}>
              {loading && !marketData.length
                ? "Loading..."
                : compactMoney(totals.totalOpenInterest)}
            </div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 9 }}>
              Estimated USD value of open positions
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              ACTIVE MARKETS
            </div>
            <div style={{ fontSize: 29, fontWeight: 750, marginTop: 15 }}>
              {loading && !markets.length
                ? "Loading..."
                : totals.activeMarkets.toLocaleString("en-US")}
            </div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 9 }}>
              {totals.listedMarkets} listed markets
            </div>
          </div>
        </div>

        {/* NEW: Top Gainers and Top Losers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <MarketMoverPanel
            title="Top Gainers"
            markets={topGainers}
            positive
            loading={loading}
          />
          <MarketMoverPanel
            title="Top Losers"
            markets={topLosers}
            positive={false}
            loading={loading}
          />
        </div>

{/* Funding Rate Leaderboard */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
    marginBottom: 12,
  }}
>
  <FundingRatePanel
    title="Highest Positive Funding"
    markets={topPositiveFunding}
    positive
    loading={loading}
  />

  <FundingRatePanel
    title="Highest Negative Funding"
    markets={topNegativeFunding}
    positive={false}
    loading={loading}
  />
</div>

<p
  style={{
    color: MUTED,
    fontSize: 11,
    lineHeight: 1.6,
    margin: "0 2px 24px",
  }}
>
  Estimated payment assumes a $1,000 notional position and the current
  funding rate. The API response does not specify the settlement interval.
  This is an estimate per funding event, not an hourly or annualized
  projection. Actual payments may vary.
</p>

        <div style={{ marginBottom: 28 }}>
          <MarketVolumePanel markets={topVolumeMarkets} loading={loading} />
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
              <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>
                {rows.length} markets shown · Sorted by{" "}
                {sortBy === "openInterest"
                  ? "open interest"
                  : sortBy === "change"
                    ? "24H change"
                    : sortBy}
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
                  color: MUTED,
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
                      color: MUTED,
                      textAlign: "left",
                      fontSize: 11,
                      padding: "0 20px",
                      fontWeight: 700,
                    }}
                  >
                    MARKET
                  </th>
                  <th style={{ textAlign: "right" }}>
                    {sortLabel("price", "LAST PRICE")}
                  </th>
                  <th style={{ textAlign: "right" }}>
                    {sortLabel("change", "24H CHANGE")}
                  </th>
                  <th style={{ textAlign: "right" }}>
                    {sortLabel("volume", "24H VOLUME")}
                  </th>
                  <th style={{ textAlign: "right" }}>
                    {sortLabel("openInterest", "OPEN INTEREST")}
                  </th>
                  <th style={{ textAlign: "right" }}>
                    {sortLabel("funding", "FUNDING RATE")}
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 20px",
                      color: MUTED,
                      fontSize: 11,
                    }}
                  >
                    24H RANGE
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && !markets.length ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 50, textAlign: "center", color: MUTED }}>
                      Loading Txflow markets...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 50, textAlign: "center", color: MUTED }}>
                      {error
                        ? "Market data could not be loaded."
                        : "No markets match your search."}
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
                              <span
                                style={{
                                  display: "block",
                                  color: MUTED,
                                  fontSize: 11,
                                  marginTop: 4,
                                }}
                              >
                                Perpetual
                                {market.maxLeverage
                                  ? ` · Up to ${market.maxLeverage}x`
                                  : ""}
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
                            color:
                              change === null
                                ? MUTED
                                : change >= 0
                                  ? LIME
                                  : "#ff8177",
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
                            color:
                              fundingPercent > 0
                                ? LIME
                                : fundingPercent < 0
                                  ? "#ff8177"
                                  : MUTED,
                          }}
                        >
                          {market.data ? percent(fundingPercent, 4) : "—"}
                        </td>

                        <td style={{ textAlign: "right", padding: "15px 20px" }}>
                          <span style={{ display: "block", fontSize: 12 }}>
                            {market.high ? price(market.high) : "—"}
                          </span>
                          <span
                            style={{
                              display: "block",
                              color: MUTED,
                              fontSize: 11,
                              marginTop: 4,
                            }}
                          >
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
              color: MUTED,
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
