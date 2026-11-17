
"use client";

import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

type Candle = {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  n: number;
};

export default function PriceChart({ coin }: { coin: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [selectedInterval, setSelectedInterval] = useState("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // Fetch candle data for the selected timeframe.
  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/candles?coin=${encodeURIComponent(
            coin
          )}&interval=${selectedInterval}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`Candle API returned ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid candle data returned by API.");
        }

        if (!cancelled) {
          setCandles(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Candle API error:", error);
          setCandles([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCandles();

    return () => {
      cancelled = true;
    };
  }, [coin, selectedInterval, refresh]);

  // Refresh chart data every 10 seconds.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRefresh((value) => value + 1);
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  // Create and update the chart.
  useEffect(() => {
    const container = chartContainerRef.current;

    if (!container || candles.length === 0) {
      return;
    }

    const chart = createChart(container, {
      layout: {
        background: { color: "#10150e" },
        textColor: "#929b88",
      },
      grid: {
        vertLines: { color: "#20271a" },
        horzLines: { color: "#20271a" },
      },
      width: container.clientWidth,
      height: 500,
      timeScale: {
        borderColor: "#35422a",
      },
      rightPriceScale: {
        borderColor: "#222",
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#c5f66b",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#c5f66b",
      wickDownColor: "#ef4444",
    });

    candlestickSeries.setData(
      candles.map((candle) => ({
        time: Math.floor(candle.t / 1000) as any,
        open: Number(candle.o),
        high: Number(candle.h),
        low: Number(candle.l),
        close: Number(candle.c),
      }))
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    volumeSeries.setData(
      candles.map((candle) => ({
        time: Math.floor(candle.t / 1000) as any,
        value: Number(candle.v),
        color:
          Number(candle.c) >= Number(candle.o)
            ? "#22c55e"
            : "#ef4444",
      }))
    );

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles]);

  return (
    <div
      className="price-chart-card"
      style={{
        marginTop: "40px",
        background: "#10150e",
        border: "1px solid rgba(151,177,112,.18)",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <p
          style={{
            color: "#929b88",
            fontSize: "12px",
            letterSpacing: "1px",
            margin: 0,
          }}
        >
          PRICE
        </p>

        <h2
          style={{
            fontSize: "22px",
            fontWeight: "700",
            margin: "8px 0 0",
          }}
        >
          {coin}
        </h2>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "20px",
            flexWrap: "wrap",
          }}
        >
          {["1h", "4h", "12h", "1d"].map((value) => (
            <button
              key={value}
              onClick={() => setSelectedInterval(value)}
              style={{
                background:
                  selectedInterval === value ? "#c5f66b" : "#151b11",
                color:
                  selectedInterval === value ? "#11160c" : "#a9b995",
                border: "1px solid #35422a",
                borderRadius: "8px",
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#666" }}>Loading chart...</p>
      ) : candles.length === 0 ? (
        <p style={{ color: "#929b88" }}>
          No candle data available for this timeframe. Please try again later.
        </p>
      ) : (
        <div
          ref={chartContainerRef}
          className="price-chart-canvas"
          style={{
            width: "100%",
            height: "440px",
          }}
        />
      )}
    </div>
  );
}
