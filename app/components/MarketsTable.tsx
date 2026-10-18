
"use client";

import { useEffect, useState } from "react";

type Market = {
  name: string;
  index?: number;
  haltTrading?: boolean;
  delisted?: boolean;
};

type MarketData = {
  coin: string;
  lastPrice?: number | string;
  dayNtlVlm?: number | string;
  openInterest?: number | string;
  nodeCtx?: {
    funding?: number | string;
  };
};

export default function MarketsTable() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMarketData() {
      try {
        const [listResponse, dataResponse] = await Promise.all([
          fetch("/api/market-list"),
          fetch("/api/market-data"),
        ]);

        if (!listResponse.ok || !dataResponse.ok) {
          throw new Error("Unable to load market data.");
        }

        const [listResult, dataResult] = await Promise.all([
          listResponse.json(),
          dataResponse.json(),
        ]);

        if (!Array.isArray(listResult) || !Array.isArray(dataResult)) {
          throw new Error("The market API returned unexpected data.");
        }

        if (!cancelled) {
          setMarkets(listResult);
          setMarketData(dataResult);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load market data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMarketData();

    const interval = setInterval(loadMarketData, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const safeMarkets = Array.isArray(markets) ? markets : [];
  const safeMarketData = Array.isArray(marketData) ? marketData : [];

  const sortedMarkets = [...safeMarkets]
    .filter((market) => !market.haltTrading && !market.delisted)
    .map((market) => ({
      market,
      data: safeMarketData.find((item) => item.coin === market.name),
    }))
    .sort(
      (a, b) =>
        Number(b.data?.dayNtlVlm || 0) -
        Number(a.data?.dayNtlVlm || 0)
    )
    .slice(0, 10);

  function formatPrice(value?: number | string) {
    const number = Number(value);

    if (value == null || value === "" || !Number.isFinite(number)) {
      return "—";
    }

    return `$${number.toLocaleString("en-US", {
      maximumFractionDigits: 8,
    })}`;
  }

  function formatMillions(value?: number | string) {
    const number = Number(value);

    if (value == null || value === "" || !Number.isFinite(number)) {
      return "—";
    }

    return `$${(number / 1_000_000).toFixed(2)}M`;
  }

  function formatFunding(value?: number | string) {
    const number = Number(value);

    if (value == null || value === "" || !Number.isFinite(number)) {
      return "—";
    }

    return `${(number * 100).toFixed(4)}%`;
  }

  return (
    <div
      id="markets"
      style={{
        marginTop: "30px",
        background: "#0d0d0d",
        border: "1px solid #222",
        borderRadius: "12px",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 600, margin: 0 }}>
            Top 10 Markets
          </h2>
          <p style={{ color: "#777", fontSize: "13px", margin: "7px 0 0" }}>
            Ranked by 24-hour trading volume
          </p>
        </div>

        <span
          style={{
            color: "#c7f36b",
            fontSize: "11px",
            border: "1px solid #38432a",
            background: "#171d12",
            padding: "7px 10px",
            borderRadius: "7px",
          }}
        >
          LIVE DATA
        </span>
      </div>

      {loading ? (
        <p style={{ color: "#999", padding: "20px 0" }}>
          Loading markets...
        </p>
      ) : error && sortedMarkets.length === 0 ? (
        <p style={{ color: "#ff8888", padding: "20px 0" }}>{error}</p>
      ) : sortedMarkets.length === 0 ? (
        <p style={{ color: "#999", padding: "20px 0" }}>
          No market data is currently available.
        </p>
      ) : (
        <>
          {error && (
            <p style={{ color: "#ffb36b", fontSize: "12px" }}>{error}</p>
          )}

          <div style={{ width: "100%", overflowX: "auto" }}>
            <div style={{ minWidth: "680px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1.2fr 1fr",
                  gap: "16px",
                  padding: "12px 0",
                  borderBottom: "1px solid #333",
                  color: "#777",
                  fontSize: "11px",
                  letterSpacing: ".06em",
                }}
              >
                <span>MARKET</span>
                <span>PRICE</span>
                <span>24H VOLUME</span>
                <span>OPEN INTEREST</span>
                <span>FUNDING</span>
              </div>

              {sortedMarkets.map(({ market, data }, index) => (
                <div
                  key={market.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1.2fr 1fr",
                    gap: "16px",
                    alignItems: "center",
                    padding: "16px 0",
                    borderBottom:
                      index === sortedMarkets.length - 1
                        ? "none"
                        : "1px solid #1f1f1f",
                    fontSize: "13px",
                  }}
                >
                  <a
                    href={`/markets/${encodeURIComponent(market.name)}`}
                    style={{
                      color: "#f3f6ed",
                      textDecoration: "none",
                      fontWeight: 650,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                    }}
                  >
                    {market.name}
                    <span style={{ color: "#c7f36b", fontSize: "12px" }}>
                      ↗
                    </span>
                  </a>

                  <span style={{ color: "#cfd4c8" }}>
                    {formatPrice(data?.lastPrice)}
                  </span>

                  <span style={{ color: "#c7f36b" }}>
                    {formatMillions(data?.dayNtlVlm)}
                  </span>

                  <span style={{ color: "#cfd4c8" }}>
                    {data
                      ? formatMillions(
                          Number(data.openInterest || 0) *
                            Number(data.lastPrice || 0)
                        )
                      : "—"}
                  </span>

                  <span style={{ color: "#cfd4c8" }}>
                    {formatFunding(data?.nodeCtx?.funding)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
