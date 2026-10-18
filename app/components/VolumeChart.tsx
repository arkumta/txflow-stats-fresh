
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Period = "24H" | "7D" | "30D";
type Metric = "volume_24h" | "open_interest";

type Snapshot = {
  recorded_at: string;
  volume_24h: number | string | null;
  open_interest: number | string | null;
};

const metricOptions: { value: Metric; label: string }[] = [
  { value: "volume_24h", label: "24H Volume" },
  { value: "open_interest", label: "Open Interest" },
];

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimestamp(value: string, period: Period) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  if (period === "24H") {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(period === "30D" ? { year: "2-digit" } : {}),
  });
}

function formatTooltipTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VolumeChart() {
  const [period, setPeriod] = useState<Period>("7D");
  const [metric, setMetric] = useState<Metric>("volume_24h");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/market-history?period=${period}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to load historical market data."
          );
        }

        if (!Array.isArray(result.data)) {
          throw new Error("The historical API returned invalid data.");
        }

        setSnapshots(result.data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load historical market data."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => controller.abort();
  }, [period, reloadKey]);

  const chartData = useMemo(() => {
    return snapshots
      .filter((snapshot) =>
        Number.isFinite(new Date(snapshot.recorded_at).getTime())
      )
      .map((snapshot) => {
        const rawValue = snapshot[metric];
        const parsedValue =
          rawValue === null || rawValue === undefined
            ? null
            : Number(rawValue);

        return {
          recorded_at: snapshot.recorded_at,
          timeLabel: formatTimestamp(snapshot.recorded_at, period),
          value:
            parsedValue !== null && Number.isFinite(parsedValue)
              ? parsedValue
              : null,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() -
          new Date(b.recorded_at).getTime()
      );
  }, [snapshots, metric, period]);

  const selectedMetric = metricOptions.find(
    (option) => option.value === metric
  );

  const values = chartData
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  const latestValue = values.length > 0 ? values[values.length - 1] : null;

  const oldestTimestamp =
    chartData.length > 0 ? chartData[0].recorded_at : null;

  const latestTimestamp =
    chartData.length > 0
      ? chartData[chartData.length - 1].recorded_at
      : null;

  const hasSparseData =
    period === "30D" ? chartData.length < 10 : chartData.length < 5;

  function formatValue(value: number) {
    return formatCompactMoney(value);
  }

  return (
    <section
      style={{
        marginTop: "30px",
        background: "#0d0d0d",
        border: "1px solid #222",
        borderRadius: "8px",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "22px",
        }}
      >
        <div>
          <p
            style={{
              color: "#A3E635",
              fontSize: "11px",
              letterSpacing: "1.4px",
              margin: 0,
            }}
          >
            HISTORICAL MARKET ANALYTICS
          </p>

          <h2
            style={{
              fontSize: "22px",
              fontWeight: 600,
              margin: "8px 0",
              color: "#f5f5f5",
            }}
          >
            {selectedMetric?.label ?? "Market History"}
          </h2>

          <p style={{ color: "#777", fontSize: "12px", margin: 0 }}>
            Explore how market metrics have changed over time.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
            aria-label="Select chart metric"
            style={selectStyle}
          >
            {metricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            aria-label="Select chart time range"
            style={selectStyle}
          >
            <option value="24H">Last 24 hours</option>
            <option value="7D">Last 7 days</option>
            <option value="30D">Last 30 days</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <div>
          <p
            style={{
              color: "#777",
              fontSize: "11px",
              margin: "0 0 6px",
            }}
          >
            LATEST RECORDED VALUE
          </p>

          <h3
            style={{
              fontSize: "28px",
              lineHeight: 1.2,
              fontWeight: 600,
              color: "#A3E635",
              margin: 0,
            }}
          >
            {latestValue === null ? "—" : formatValue(latestValue)}
          </h3>
        </div>

        <p style={{ color: "#777", fontSize: "12px", margin: 0 }}>
          {chartData.length.toLocaleString()} snapshots
        </p>
      </div>

      <div style={{ width: "100%", height: "320px" }}>
        {loading ? (
          <div style={messageStyle}>Loading historical data...</div>
        ) : error ? (
          <div style={messageStyle}>
            <div>
              <p style={{ color: "#f87171" }}>{error}</p>
              <button
                onClick={() => setReloadKey((key) => key + 1)}
                style={selectStyle}
              >
                Retry loading data
              </button>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div style={messageStyle}>
            No historical snapshots found for this period. The chart will
            populate as snapshots are recorded in your database.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                stroke="#222"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="timeLabel"
                stroke="#555"
                tick={{ fill: "#888", fontSize: 11 }}
                minTickGap={24}
                tickLine={false}
                axisLine={{ stroke: "#333" }}
              />

              <YAxis
                stroke="#555"
                tick={{ fill: "#888", fontSize: 11 }}
                tickFormatter={(value) =>
                  formatCompactMoney(Number(value))
                }
                width={82}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
              />

              <Tooltip
                labelFormatter={(_label, payload) => {
                  const timestamp = payload?.[0]?.payload?.recorded_at;

                  return timestamp
                    ? formatTooltipTimestamp(timestamp)
                    : _label;
                }}
                labelStyle={{
                  color: "#ddd",
                  marginBottom: "6px",
                }}
                contentStyle={{
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "6px",
                }}
                itemStyle={{ color: "#A3E635" }}
                formatter={(value) => [
                  value === null || value === undefined
                    ? "No value"
                    : formatValue(Number(value)),
                  selectedMetric?.label ?? "Value",
                ]}
              />

              <Line
                type="linear"
                dataKey="value"
                name={selectedMetric?.label ?? "Value"}
                stroke="#A3E635"
                strokeWidth={2}
                dot={chartData.length <= 20 ? { r: 2, fill: "#A3E635" } : false}
                activeDot={{ r: 4, fill: "#A3E635" }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {!loading && !error && chartData.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "10px",
            marginTop: "14px",
            paddingTop: "14px",
            borderTop: "1px solid #222",
          }}
        >
          <p style={{ color: "#777", fontSize: "11px", margin: 0 }}>
            {oldestTimestamp
              ? `From ${formatTooltipTimestamp(oldestTimestamp)}`
              : ""}
          </p>

          <p style={{ color: "#777", fontSize: "11px", margin: 0 }}>
            {latestTimestamp
              ? `To ${formatTooltipTimestamp(latestTimestamp)}`
              : ""}
          </p>
        </div>
      )}

      {!loading && !error && hasSparseData && chartData.length > 0 && (
        <p
          style={{
            color: "#D4A84F",
            fontSize: "12px",
            lineHeight: 1.6,
            margin: "14px 0 0",
          }}
        >
          Historical coverage is limited for this range. Gaps indicate times
          when no market snapshot was recorded.
        </p>
      )}

      <p style={{ color: "#666", fontSize: "12px", margin: "14px 0 0" }}>
        Volume is the recorded rolling 24-hour trading volume. Open Interest
        is the recorded market open interest. Values reflect stored snapshots,
        not reconstructed historical trades.
      </p>
    </section>
  );
}

const selectStyle: React.CSSProperties = {
  background: "#151515",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: "6px",
  padding: "9px 10px",
  minHeight: "38px",
  maxWidth: "100%",
};

const messageStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#999",
  fontSize: "13px",
  padding: "20px",
};
