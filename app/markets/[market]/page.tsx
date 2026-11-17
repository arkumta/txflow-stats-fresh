
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PriceChart from "../../components/PriceChart";
import VolumeChart from "../../components/VolumeChart";
import { Suspense } from "react";

type MarketMeta = {
  name: string;
  maxLeverage?: number;
  haltTrading?: boolean;
  delisted?: boolean;
};

type MarketContext = {
  lastPrice?: number | string;
  markPx?: number | string;
  oraclePx?: number | string;
  prevDayPx?: number | string;
  dayNtlVlm?: number | string;
  dayHighPx?: number | string;
  dayLowPx?: number | string;
  openInterest?: number | string;
  nodeCtx?: {
    funding?: number | string;
    markPx?: number | string;
    lastPrice?: number | string;
  };
};

const LIME = "#c7f36b";
const MUTED = "#92998a";
const BORDER = "#292f23";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null, compact = false): string {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : value >= 100 ? 2 : 6,
  }).format(value);
}

function MarketMark({ name }: { name: string }) {
  const symbol = name.split("-")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 4);

  return (
    <div
      style={{
        width: 52,
        height: 52,
        flexShrink: 0,
        borderRadius: 15,
        display: "grid",
        placeItems: "center",
        background: "#20271b",
        border: "1px solid #39452a",
        color: LIME,
        fontSize: 13,
        fontWeight: 850,
      }}
    >
      {symbol.toUpperCase()}
    </div>
  );
}

function MarketDetailContent() {
  const params = useParams<{ market: string }>();

  const marketName = useMemo(() => {
    const value = params?.market;
    if (!value) return "";

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }, [params]);

  const [market, setMarket] = useState<MarketMeta | null>(null);
  const [context, setContext] = useState<MarketContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadMarket = useCallback(async (manual = false) => {
    if (!marketName) return;

    if (manual) setRefreshing(true);
    setError("");

    try {
      const [metaResponse, contextResponse] = await Promise.all([
        fetch("/api/market-list", { cache: "no-store" }),
        fetch(
          `/api/markets?coin=${encodeURIComponent(marketName)}`,
          { cache: "no-store" }
        ),
      ]);

      if (!metaResponse.ok || !contextResponse.ok) {
        throw new Error("Market data is temporarily unavailable.");
      }

      const [metaResult, contextResult] = await Promise.all([
        metaResponse.json(),
        contextResponse.json(),
      ]);

      if (!Array.isArray(metaResult)) {
        throw new Error("Unexpected market list response.");
      }

      const foundMarket =
        metaResult.find((item: MarketMeta) => item.name === marketName) ?? null;

      if (!foundMarket) {
        setMarket(null);
        setContext(null);
        throw new Error(
          `${marketName} was not found in the current Txflow market list.`
        );
      }

      setMarket(foundMarket);
      setContext(contextResult);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load this market."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [marketName]);

  useEffect(() => {
    void loadMarket();

    const timer = window.setInterval(() => {
      void loadMarket();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadMarket]);

  const stats = useMemo(() => {
    const last = toNumber(context?.lastPrice ?? context?.nodeCtx?.lastPrice);
    const mark = toNumber(context?.markPx ?? context?.nodeCtx?.markPx);
    const effective = last ?? mark;
    const previous = toNumber(context?.prevDayPx);

    const change =
      effective !== null && previous !== null && previous > 0
        ? ((effective - previous) / previous) * 100
        : null;

    const oiContracts = toNumber(context?.openInterest);
    const oiPrice = mark ?? effective;

    const openInterest =
      oiContracts !== null && oiPrice !== null
        ? oiContracts * oiPrice
        : null;

    return {
      last,
      mark,
      oracle: toNumber(context?.oraclePx),
      change,
      volume: toNumber(context?.dayNtlVlm),
      openInterest,
      funding: toNumber(context?.nodeCtx?.funding),
      high: toNumber(context?.dayHighPx),
      low: toNumber(context?.dayLowPx),
    };
  }, [context]);

  const cardStyle: React.CSSProperties = {
    background: "linear-gradient(145deg, #171d12 0%, #11140f 72%)",
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: 21,
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    color: MUTED,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: "clamp(20px, 3vw, 27px)",
    fontWeight: 800,
    letterSpacing: "-0.7px",
    marginTop: 13,
    overflowWrap: "anywhere",
  };

  if (!marketName) {
    return (
      <main style={{ minHeight: "70vh", padding: 32, color: "#f2f4ed" }}>
        Loading market…
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b08",
        color: "#f2f4ed",
        padding: "28px 0 70px",
      }}
    >
      <div
        style={{
          width: "min(1440px, calc(100% - 40px))",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 9,
            alignItems: "center",
            color: MUTED,
            fontSize: 12,
            marginBottom: 24,
          }}
        >
          <Link href="/" style={{ color: MUTED }}>Dashboard</Link>
          <span>/</span>
          <Link href="/markets" style={{ color: MUTED }}>Markets</Link>
          <span>/</span>
          <span style={{ color: LIME }}>{marketName}</span>
        </div>

        <section
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 26,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <MarketMark name={marketName} />

            <div>
              <div
                style={{
                  color: LIME,
                  fontSize: 10,
                  fontWeight: 850,
                  letterSpacing: 1.7,
                  marginBottom: 7,
                }}
              >
                TXFLOW PERPETUAL MARKET
              </div>

              <h1
                style={{
                  fontSize: "clamp(30px, 5vw, 46px)",
                  lineHeight: 1.05,
                  letterSpacing: -1.5,
                  margin: 0,
                  fontWeight: 850,
                }}
              >
                {marketName}
              </h1>

              <p style={{ color: MUTED, margin: "8px 0 0", fontSize: 13 }}>
                Perpetual contract
                {market?.maxLeverage
                  ? ` · Up to ${market.maxLeverage}x leverage`
                  : ""}
                {market?.haltTrading || market?.delisted
                  ? " · Inactive"
                  : " · Active"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadMarket(true)}
            disabled={refreshing}
            style={{
              background: LIME,
              color: "#11150b",
              border: 0,
              borderRadius: 10,
              padding: "12px 17px",
              fontWeight: 850,
              cursor: refreshing ? "wait" : "pointer",
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? "Refreshing…" : "↻ Refresh market"}
          </button>
        </section>

        {error && (
          <div
            role="alert"
            style={{
              padding: 16,
              marginBottom: 20,
              borderRadius: 12,
              border: "1px solid #66312d",
              background: "#251615",
              color: "#ffb7ad",
              fontSize: 13,
            }}
          >
            {error}
            <button
              type="button"
              onClick={() => void loadMarket(true)}
              style={{
                marginLeft: 12,
                background: "transparent",
                border: 0,
                color: LIME,
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Try again
            </button>
          </div>
        )}

        <section style={{ ...cardStyle, marginBottom: 16, padding: "24px 26px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={labelStyle}>LAST TRADED PRICE</div>

              <div
                style={{
                  fontSize: "clamp(34px, 6vw, 52px)",
                  fontWeight: 850,
                  letterSpacing: -1.8,
                  marginTop: 10,
                }}
              >
                {loading && !context ? "Loading…" : money(stats.last)}
              </div>

              <div
                style={{
                  marginTop: 9,
                  fontSize: 13,
                  color:
                    stats.change === null
                      ? MUTED
                      : stats.change >= 0
                        ? LIME
                        : "#ff7777",
                }}
              >
                {stats.change === null
                  ? "—"
                  : `${stats.change > 0 ? "+" : ""}${stats.change.toFixed(2)}%`}
                <span style={{ color: MUTED }}> 24H change</span>
              </div>
            </div>

            <div style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>
              <div><span style={{ color: "#22c55e" }}>●</span> Txflow market data</div>
              <div style={{ marginTop: 8 }}>
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString()}`
                  : "Waiting for data"}
              </div>
              <div style={{ marginTop: 5 }}>Auto-refreshes every 30 seconds</div>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 205px), 1fr))",
            gap: 13,
            marginBottom: 22,
          }}
        >
          <article style={cardStyle}>
            <div style={labelStyle}>24H TRADING VOLUME</div>
            <div style={valueStyle}>
              {loading && !context ? "Loading…" : money(stats.volume, true)}
            </div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 8 }}>
              Quote volume reported by Txflow
            </div>
          </article>

          <article style={cardStyle}>
            <div style={labelStyle}>OPEN INTEREST</div>
            <div style={valueStyle}>
              {loading && !context ? "Loading…" : money(stats.openInterest, true)}
            </div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 8 }}>
              Estimated USD notional value
            </div>
          </article>

          <article style={cardStyle}>
            <div style={labelStyle}>FUNDING RATE</div>
            <div
              style={{
                ...valueStyle,
                color:
                  stats.funding === null
                    ? "#f2f4ed"
                    : stats.funding >= 0
                      ? LIME
                      : "#ff7777",
              }}
            >
              {stats.funding === null
                ? "—"
                : `${(stats.funding * 100).toFixed(4)}%`}
            </div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 8 }}>
              Current rate from market context
            </div>
          </article>

          <article style={cardStyle}>
            <div style={labelStyle}>24H PRICE RANGE</div>
            <div style={{ ...valueStyle, fontSize: 19 }}>
              {money(stats.low)} – {money(stats.high)}
            </div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 8 }}>
              Reported daily low and high
            </div>
          </article>
        </section>

        <section style={{ ...cardStyle, marginBottom: 22 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 17,
            }}
          >
            <div>
              <div style={{ ...labelStyle, color: LIME }}>PRICE ACTION</div>
              <h2 style={{ margin: "7px 0 0", fontSize: 19 }}>
                Candlestick chart
              </h2>
            </div>

            <span style={{ color: MUTED, fontSize: 11, alignSelf: "center" }}>
              OHLC · Trading volume
            </span>
          </div>

          <PriceChart coin={marketName} />
        </section>

        <VolumeChart coin={marketName} />

        <section style={{ ...cardStyle, marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 16px" }}>
            Market reference prices
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <div style={labelStyle}>MARK PRICE</div>
              <div style={{ fontSize: 17, fontWeight: 750, marginTop: 8 }}>
                {money(stats.mark)}
              </div>
            </div>

            <div>
              <div style={labelStyle}>ORACLE PRICE</div>
              <div style={{ fontSize: 17, fontWeight: 750, marginTop: 8 }}>
                {money(stats.oracle)}
              </div>
            </div>

            <div>
              <div style={labelStyle}>MAX LEVERAGE</div>
              <div style={{ fontSize: 17, fontWeight: 750, marginTop: 8 }}>
                {market?.maxLeverage ? `${market.maxLeverage}x` : "—"}
              </div>
            </div>

            <div>
              <div style={labelStyle}>MARKET STATUS</div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 750,
                  marginTop: 8,
                  color:
                    market?.haltTrading || market?.delisted
                      ? "#ff7777"
                      : LIME,
                }}
              >
                {market?.haltTrading || market?.delisted
                  ? "Inactive"
                  : market
                    ? "Active"
                    : "—"}
              </div>
            </div>
          </div>
        </section>

        <div
          style={{
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
            Market metrics are displayed from the existing Txflow API. Open
            interest is estimated using contracts × mark price.
          </span>

          <Link
            href="/markets"
            style={{ color: LIME, fontWeight: 800 }}
          >
            ← Back to all markets
          </Link>
        </div>
      </div>
    </main>
  );
}
export default function MarketDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading market...</div>}>
      <MarketDetailContent />
    </Suspense>
  );
}