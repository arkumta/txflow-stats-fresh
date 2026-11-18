"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Period = "24H" | "7D" | "30D";

type FundingSnapshot = {
  recorded_at: string;
  funding_rate: number | string | null;
};

const LIME = "#c7f36b";
const MUTED = "#92998a";

function formatRate(value: number | null, digits = 4) {
  return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatTime(value: string, period: Period) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return period === "24H"
    ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(period === "30D" ? { year: "2-digit" } : {}),
      });
}

function formatFullTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FundingRateChart({ coin }: { coin: string }) {
  const [period, setPeriod] = useState<Period>("7D");
  const [snapshots, setSnapshots] = useState<FundingSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/market-history?coin=${encodeURIComponent(coin)}&period=${period}`,
          { cache: "no-store", signal: controller.signal }
        );
        const result = await response.json();

        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.error || "Unable to load funding history.");
        }

        setSnapshots(result.data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load funding history.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [coin, period, reloadKey]);

  const chartData = useMemo(() => snapshots
    .filter((item) => item.funding_rate !== null && item.funding_rate !== undefined)
    .map((item) => ({
      recorded_at: item.recorded_at,
      timeLabel: formatTime(item.recorded_at, period),
      // The API stores funding as a decimal fraction; convert to percent for display.
      rate: Number(item.funding_rate) * 100,
    }))
    .filter((item) => Number.isFinite(item.rate) && Number.isFinite(new Date(item.recorded_at).getTime()))
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()),
  [snapshots, period]);

  const values = chartData.map((item) => item.rate);
  const latest = values.length ? values[values.length - 1] : null;
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const highest = values.length ? Math.max(...values) : null;
  const lowest = values.length ? Math.min(...values) : null;
  const firstTime = chartData[0]?.recorded_at;
  const lastTime = chartData[chartData.length - 1]?.recorded_at;

  const statStyle: React.CSSProperties = {
    background: "#11140f",
    border: "1px solid #292f23",
    borderRadius: 12,
    padding: 16,
    minWidth: 0,
  };

  return (
    <section className="funding-rate-panel" style={{
      marginTop: 22,
      marginBottom: 22,
      background: "#0d0f0b",
      border: "1px solid #292f23",
      borderRadius: 16,
      padding: 24,
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
      }}>
        <div>
          <div style={{ color: LIME, fontSize: 10, fontWeight: 850, letterSpacing: 1.5 }}>
            FUNDING INTELLIGENCE
          </div>
          <h2 style={{ color: "#f2f4ed", fontSize: 21, margin: "8px 0 6px" }}>
            {coin} funding rate history
          </h2>
          <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>
            Historical funding snapshots recorded by Txflow Stats.
          </p>
        </div>

        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as Period)}
          aria-label="Funding history period"
          style={{
            background: "#151915",
            color: "#f2f4ed",
            border: "1px solid #39412f",
            borderRadius: 8,
            padding: "10px 12px",
            minHeight: 38,
          }}
        >
          <option value="24H">Last 24 hours</option>
          <option value="7D">Last 7 days</option>
          <option value="30D">Last 30 days</option>
        </select>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
        gap: 10,
        marginBottom: 20,
      }}>
        {[
          { label: "LATEST FUNDING", value: formatRate(latest), color: latest === null ? "#f2f4ed" : latest >= 0 ? LIME : "#ff7777" },
          { label: "PERIOD AVERAGE", value: formatRate(average), color: "#f2f4ed" },
          { label: "HIGHEST RECORDED", value: formatRate(highest), color: LIME },
          { label: "LOWEST RECORDED", value: formatRate(lowest), color: "#ff7777" },
        ].map((item) => (
          <div key={item.label} style={statStyle}>
            <div style={{ color: MUTED, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>
              {item.label}
            </div>
            <div style={{ color: item.color, fontSize: 21, fontWeight: 800, marginTop: 10 }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", height: 300 }}>
        {loading ? (
          <div style={messageStyle}>Loading funding history…</div>
        ) : error ? (
          <div style={messageStyle}>
            <div>
              <p style={{ color: "#ff9990" }}>{error}</p>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} style={retryStyle}>
                Retry
              </button>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div style={messageStyle}>
            No funding snapshots found for this period. The chart will populate as new snapshots are collected.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 14, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="#252a21" strokeDasharray="3 3" vertical={false} />
              <ReferenceLine y={0} stroke="#72796a" strokeDasharray="5 5" />
              <XAxis
                dataKey="timeLabel"
                stroke="#555"
                tick={{ fill: "#92998a", fontSize: 11 }}
                minTickGap={24}
                tickLine={false}
                axisLine={{ stroke: "#343a2e" }}
              />
              <YAxis
                stroke="#555"
                tick={{ fill: "#92998a", fontSize: 11 }}
                tickFormatter={(value) => `${Number(value).toFixed(3)}%`}
                width={76}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                labelFormatter={(_label, payload) => {
                  const timestamp = payload?.[0]?.payload?.recorded_at;
                  return timestamp ? formatFullTime(timestamp) : _label;
                }}
                formatter={(value) => [formatRate(Number(value), 5), "Funding rate"]}
                contentStyle={{
                  background: "#111",
                  border: "1px solid #39412f",
                  borderRadius: 8,
                  color: "#f2f4ed",
                }}
                labelStyle={{ color: "#ddd", marginBottom: 6 }}
              />
              <Line
                type="linear"
                dataKey="rate"
                name="Funding rate"
                stroke={LIME}
                strokeWidth={2}
                dot={chartData.length <= 20 ? { r: 2, fill: LIME } : false}
                activeDot={{ r: 4, fill: LIME }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {chartData.length > 0 && !loading && !error && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          borderTop: "1px solid #252a21",
          paddingTop: 13,
          marginTop: 12,
          color: MUTED,
          fontSize: 11,
        }}>
          <span>{firstTime ? `From ${formatFullTime(firstTime)}` : ""}</span>
          <span>{chartData.length.toLocaleString()} funding snapshots</span>
          <span>{lastTime ? `To ${formatFullTime(lastTime)}` : ""}</span>
        </div>
      )}

      <p style={{ color: "#737b6b", fontSize: 11, lineHeight: 1.6, margin: "14px 0 0" }}>
        Funding values are stored as decimal rates and displayed as percentages. The period average is the arithmetic mean of recorded snapshots, not a time-weighted or annualized rate. Txflow's funding settlement interval is not inferred here.
      </p>
    </section>
  );
}

const messageStyle: React.CSSProperties = {
  height: "100%",
  minHeight: 180,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: MUTED,
  fontSize: 13,
  padding: 20,
};

const retryStyle: React.CSSProperties = {
  background: "#20271b",
  color: LIME,
  border: "1px solid #39452a",
  borderRadius: 7,
  padding: "9px 13px",
  cursor: "pointer",
};
