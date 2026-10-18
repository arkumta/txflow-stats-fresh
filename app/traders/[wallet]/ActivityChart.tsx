
"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
} from "recharts";

type Activity = {
  activity_date: string;
  trade_count: number;
  trading_volume: number;
};

export default function ActivityChart({
  data,
}: {
  data: Activity[];
}) {
  const chartData = data.map((item) => ({
    ...item,
    dateLabel: item.activity_date.slice(5),
    trade_count: Number(item.trade_count),
    trading_volume: Number(item.trading_volume),
  }));

  if (chartData.length === 0) {
    return (
      <p style={{ color: "#888", padding: 24 }}>
        No trading activity recorded in this period.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 12, right: 20, left: 0, bottom: 8 }}
        >
          <CartesianGrid stroke="#252525" strokeDasharray="3 3" />

          <XAxis
            dataKey="dateLabel"
            stroke="#888"
            tick={{ fill: "#aaa", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />

          <YAxis
            yAxisId="trades"
            stroke="#888"
            tick={{ fill: "#aaa", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />

          <YAxis
            yAxisId="volume"
            orientation="right"
            stroke="#888"
            tick={{ fill: "#aaa", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              `$${Number(value).toLocaleString("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
              })}`
            }
          />

          <Tooltip
            contentStyle={{
              background: "#151515",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#fff",
            }}
            labelStyle={{ color: "#fff" }}
            formatter={(value, name) => [
              name === "Volume"
                ? `$${Number(value).toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}`
                : Number(value).toLocaleString("en-US"),
              name,
            ]}
            labelFormatter={(label) => `Date: ${label}`}
          />

          <Bar
            yAxisId="trades"
            dataKey="trade_count"
            name="Trades"
            fill="#34d399"
            radius={[3, 3, 0, 0]}
          />

          <Line
            yAxisId="volume"
            type="monotone"
            dataKey="trading_volume"
            name="Volume"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
