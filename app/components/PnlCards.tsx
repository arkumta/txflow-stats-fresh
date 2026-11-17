
"use client";

import { useEffect, useState } from "react";

type PnlPeriod = {
  grossRealizedPnl: number;
  fees: number;
  netRealizedPnl: number;
  fillCount: number;
  fillsWithFee: number;
};

type PnlResponse = {
  success: boolean;
  periods?: Record<string, PnlPeriod>;
  note?: string;
  error?: string;
};

const cards = [
  {
    key: "24H",
    title: "Last 24 hours",
    description: "Net realized PnL",
  },
  {
    key: "7D",
    title: "Last 7 days",
    description: "Net realized PnL",
  },
  {
    key: "SINCE_OCT_10",
    title: "Since Oct 10",
    description: "Net realized PnL · indexed period",
  },
];

function money(value: number) {
  return `${value < 0 ? "-$" : "$"}${Math.abs(value).toLocaleString(
    "en-US",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )}`;
}

export default function PnlCards() {
  const [result, setResult] = useState<PnlResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPnl() {
      try {
        const response = await fetch("/api/pnl", {
          cache: "no-store",
        });
        const data: PnlResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to load PnL.");
        }

        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load PnL."
          );
        }
      }
    }

    loadPnl();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section style={{ marginTop: "28px" }}>
      {error && (
        <p style={{ color: "#f87171", marginBottom: "16px" }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {cards.map((card) => {
          const item = result?.periods?.[card.key];
          const pnl = item?.netRealizedPnl ?? 0;

          return (
            <div
              key={card.key}
              style={{
                background: "#0d0d0d",
                border: "1px solid #222",
                borderRadius: "8px",
                padding: "22px",
              }}
            >
              <div style={{ marginBottom: "14px" }}>
                <p
                  style={{
                    color: "#d7ddcf",
                    fontSize: "13px",
                    fontWeight: 650,
                    margin: "0 0 5px",
                  }}
                >
                  {card.title}
                </p>
                <p
                  style={{
                    color: "#929a88",
                    fontSize: "11px",
                    margin: 0,
                  }}
                >
                  {card.description}
                </p>
              </div>

              <h3
                style={{
                  fontSize: "27px",
                  fontWeight: 500,
                  margin: "0 0 14px",
                  color: item
                    ? pnl > 0
                      ? "#4ade80"
                      : pnl < 0
                        ? "#f87171"
                        : "#fff"
                    : "#999",
                }}
              >
                {item ? money(pnl) : "Loading..."}
              </h3>

              <p style={{ color: "#888", fontSize: "12px", margin: 0 }}>
                {item
                  ? `${item.fillCount.toLocaleString()} fills · ${item.fillsWithFee.toLocaleString()} with fee data`
                  : "Aggregating stored fills..."}
              </p>
            </div>
          );
        })}
      </div>

      <p style={{ color: "#777", fontSize: "12px", marginTop: "14px" }}>
        {result?.note ??
          "PnL reflects stored fills and may not include positions opened before the reporting period."}
      </p>
    </section>
  );
}
