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

  const [interval, setInterval] = useState("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setLoading(true);

    fetch(
      `/api/candles?coin=${encodeURIComponent(
        coin
      )}&interval=${interval}`
    )
      .then((res) => res.json())
      .then((data) => {
        setCandles(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Candle API error:", error);
        setLoading(false);
      });
  }, [coin, interval, refresh]);
  useEffect(() => {
  const timer = setInterval(() => {
    setRefresh((value) => value + 1);
  }, 10000);

  return () => clearInterval(timer);
}, []);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) {
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#0d0d0d" },
        textColor: "#777",
      },

      grid: {
        vertLines: { color: "#151515" },
        horzLines: { color: "#151515" },
      },

      width: chartContainerRef.current.clientWidth,
      height: 500,

      timeScale: {
        borderColor: "#222",
      },

      rightPriceScale: {
        borderColor: "#222",
      },
    });

    // -----------------------------
    // PRICE CANDLESTICKS
    // -----------------------------

    const candlestickSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      }
    );

    candlestickSeries.setData(
      candles.map((candle) => ({
        time: Math.floor(candle.t / 1000) as any,
        open: Number(candle.o),
        high: Number(candle.h),
        low: Number(candle.l),
        close: Number(candle.c),
      }))
    );

    // -----------------------------
    // VOLUME
    // -----------------------------

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: {
          type: "volume",
        },

        priceScaleId: "volume",
      }
    );

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

    // -----------------------------
    // RESPONSIVE RESIZE
    // -----------------------------

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );

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
          }}
        >
          {["1h", "4h", "12h", "1d"].map(
            (value) => (
              <button
                key={value}
                onClick={() => setInterval(value)}
                style={{
                  background:
                    interval === value
                      ? "#fff"
                      : "#111",

                  color:
                    interval === value
                      ? "#000"
                      : "#777",

                  border: "1px solid #333",
                  borderRadius: "5px",
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                {value.toUpperCase()}
              </button>
            )
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#666" }}>
          Loading chart...
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