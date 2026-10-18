
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
        background: { color: "#0d0d0d" },
        textColor: "#777",
      },
      grid: {
        vertLines: { color: "#151515" },
        horzLines: { color: "#151515" },
      },
      width: container.clientWidth,
      height: 500,
      timeScale: {
        borderColor: "#222",
      },
      rightPriceScale: {
        borderColor: "#222",
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
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
      style={{
        marginTop: "40px",
        background: "#0d0d0d",
        border: "1px solid #222",
        borderRadius: "8px",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <p
          style={{
            color: "#666",
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
            fontWeight: "500",
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
                  selectedInterval === value ? "#fff" : "#111",
                color:
                  selectedInterval === value ? "#000" : "#777",
                border: "1px solid #333",
                borderRadius: "5px",
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
        <p style={{ color: "#888" }}>
          No candle data available for this timeframe. Please try again later.
        </p>
      ) : (
        <div
          ref={chartContainerRef}
          style={{
            width: "100%",
            height: "500px",
          }}
        />
      )}
    </div>
  );
}
