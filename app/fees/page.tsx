
"use client";

import { useMemo, useState } from "react";

const C = {
  bg: "#090b08",
  panel: "#11140f",
  panelSoft: "#151912",
  border: "#292e23",
  text: "#f2f4ed",
  muted: "#92998a",
  lime: "#c5f66b",
  limeDark: "#1a2410",
};

const tiers = [
  { level: 0, min: 0, maker: 0.015, taker: 0.045 },
  { level: 1, min: 5_000_000, maker: 0.012, taker: 0.040 },
  { level: 2, min: 25_000_000, maker: 0.008, taker: 0.035 },
  { level: 3, min: 100_000_000, maker: 0.004, taker: 0.030 },
  { level: 4, min: 500_000_000, maker: 0, taker: 0.028 },
  { level: 5, min: 1_000_000_000, maker: 0, taker: 0.026 },
  { level: 6, min: 2_000_000_000, maker: 0, taker: 0.024 },
];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0b0e09",
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "13px 14px",
  fontSize: 14,
  outline: "none",
  minHeight: 46,
};

const cardStyle: React.CSSProperties = {
  background: `linear-gradient(145deg, ${C.panelSoft}, ${C.panel})`,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 22,
  minWidth: 0,
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function compactMoney(value: number) {
  if (value >= 1_000_000_000)
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)
    return `$${(value / 1_000).toFixed(2)}K`;
  return money(value);
}

function rateLabel(rate: number) {
  return `${rate.toFixed(3)}%`;
}

export default function FeesPage() {
  const [quantity, setQuantity] = useState("0.1");
  const [price, setPrice] = useState("80000");
  const [selectedTier, setSelectedTier] = useState(0);
  const [execution, setExecution] = useState<"maker" | "taker">("taker");
  const [sides, setSides] = useState<"roundtrip" | "single">("roundtrip");

  const qty = Math.max(0, Number(quantity) || 0);
  const fillPrice = Math.max(0, Number(price) || 0);

  const tier = useMemo(
    () => tiers.find((item) => item.level === selectedTier) ?? tiers[0],
    [selectedTier],
  );

  const feeRate = execution === "maker" ? tier.maker : tier.taker;
  const notional = qty * fillPrice;
  const feePerSide = notional * (feeRate / 100);
  const totalFees = sides === "roundtrip" ? feePerSide * 2 : feePerSide;

  const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 8,
    color: C.muted,
    fontSize: 12,
    fontWeight: 700,
  };

  const eyebrow: React.CSSProperties = {
    color: C.muted,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "1px",
    margin: 0,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 22px 64px",
        background: `radial-gradient(ellipse at 50% -15%, #1b2512 0%, ${C.bg} 48%)`,
        color: C.text,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        <section style={{ marginBottom: 30 }}>
          <p
            style={{
              color: C.lime,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "1.8px",
              margin: "0 0 12px",
            }}
          >
            PERPETUALS · FEE TOOLS
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 5vw, 52px)",
              lineHeight: 1.06,
              letterSpacing: "-2px",
              fontWeight: 800,
            }}
          >
            Trading Fee <span style={{ color: C.lime }}>Calculator</span>
          </h1>

          <p
            style={{
              color: C.muted,
              fontSize: 14,
              lineHeight: 1.8,
              maxWidth: 680,
              margin: "14px 0 0",
            }}
          >
            Calculate TxFlow perpetual trading fees, compare maker and
            taker executions, and choose your VIP tier to estimate costs.
          </p>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 290px), 1fr))",
            gap: 18,
            alignItems: "start",
          }}
        >
          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800 }}>
              Trade details
            </h2>

            <p
              style={{
                color: C.muted,
                fontSize: 12,
                lineHeight: 1.6,
                margin: "0 0 24px",
              }}
            >
              Enter your trade details and select your VIP fee tier.
            </p>

            <div style={{ display: "grid", gap: 18 }}>
              <label style={labelStyle}>
                Trade quantity
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={fieldStyle}
                  placeholder="e.g. 0.1"
                />
              </label>

              <label style={labelStyle}>
                Fill price (USD)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  style={fieldStyle}
                  placeholder="e.g. 80000"
                />
              </label>

              <label style={labelStyle}>
                VIP fee tier
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(Number(e.target.value))}
                  style={{ ...fieldStyle, cursor: "pointer" }}
                >
                  {tiers.map((item) => (
                    <option key={item.level} value={item.level}>
                      {`VIP ${item.level} — Maker ${item.maker.toFixed(3)}% / Taker ${item.taker.toFixed(3)}%`}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p style={{ ...labelStyle, margin: "0 0 9px" }}>
                  Execution type
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {(["maker", "taker"] as const).map((type) => {
                    const active = execution === type;

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setExecution(type)}
                        style={{
                          border: `1px solid ${active ? "#789a42" : C.border}`,
                          background: active ? C.limeDark : "#0b0e09",
                          color: active ? C.lime : C.muted,
                          borderRadius: 10,
                          padding: "13px 10px",
                          fontWeight: 800,
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>

                <p
                  style={{
                    color: C.muted,
                    fontSize: 11,
                    lineHeight: 1.6,
                    margin: "8px 0 0",
                  }}
                >
                  Maker/taker classification depends on how your order
                  executes. A limit order is not automatically a maker order.
                </p>
              </div>

              <div>
                <p style={{ ...labelStyle, margin: "0 0 9px" }}>
                  Calculate fees for
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {([
                    ["single", "One side"],
                    ["roundtrip", "Open + close"],
                  ] as const).map(([value, text]) => {
                    const active = sides === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSides(value)}
                        style={{
                          border: `1px solid ${active ? "#789a42" : C.border}`,
                          background: active ? C.limeDark : "#0b0e09",
                          color: active ? C.lime : C.muted,
                          borderRadius: 10,
                          padding: "12px 8px",
                          fontSize: 12,
                          fontWeight: 750,
                          cursor: "pointer",
                        }}
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section
            style={{
              ...cardStyle,
              borderColor: "#465b2c",
              boxShadow: "0 0 40px rgba(197,246,107,0.045)",
            }}
          >
            <p style={eyebrow}>
              ESTIMATED {sides === "single" ? "ONE-SIDE" : "ROUND-TRIP"} FEE
            </p>

            <p
              style={{
                color: C.lime,
                fontSize: "clamp(34px, 5vw, 46px)",
                fontWeight: 850,
                letterSpacing: "-1.8px",
                margin: "14px 0 8px",
                overflowWrap: "anywhere",
              }}
            >
              {money(totalFees)}
            </p>

            <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
              {rateLabel(feeRate)} fee rate · VIP {tier.level} · {execution}
            </p>

            <div
              style={{
                height: 1,
                background: C.border,
                margin: "22px 0",
              }}
            />

            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>Notional value</span>
                <strong>{money(notional)}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>
                  {sides === "single" ? "Fee for one side" : "Opening fee"}
                </span>
                <strong>{money(feePerSide)}</strong>
              </div>

              {sides === "roundtrip" && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: C.muted, fontSize: 13 }}>Closing fee</span>
                  <strong>{money(feePerSide)}</strong>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>Total fees</span>
                <strong style={{ color: C.lime }}>{money(totalFees)}</strong>
              </div>
            </div>

            <div
              style={{
                marginTop: 24,
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: "#0b0e09",
              }}
            >
              <p style={{ ...eyebrow, marginBottom: 12 }}>
                SELECTED VIP RATES
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <span style={{ color: C.muted, fontSize: 13 }}>Maker</span>
                <strong>{rateLabel(tier.maker)}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>Taker</span>
                <strong>{rateLabel(tier.taker)}</strong>
              </div>
            </div>
          </section>
        </div>

        <section style={{ ...cardStyle, marginTop: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800 }}>
              Perpetual fee schedule
            </h2>

            <p
              style={{
                margin: 0,
                color: C.muted,
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              Choose a tier above to highlight its fee schedule. Volume
              thresholds use the rolling 14-day combined spot and perpetual
              volume from the documentation you supplied.
            </p>
          </div>

          <div style={{ width: "100%", overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 580,
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ background: "#1a2113" }}>
                  {["LEVEL", "14D VOLUME", "MAKER FEE", "TAKER FEE"].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "13px 14px",
                          color: C.muted,
                          fontSize: 10,
                          letterSpacing: "0.8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {tiers.map((item) => {
                  const active = item.level === tier.level;

                  return (
                    <tr
                      key={item.level}
                      style={{
                        background: active
                          ? "rgba(197,246,107,0.07)"
                          : "transparent",
                        borderTop: `1px solid ${C.border}`,
                      }}
                    >
                      <td
                        style={{
                          padding: 14,
                          color: active ? C.lime : C.text,
                          fontWeight: 800,
                        }}
                      >
                        VIP {item.level} {active ? "✓" : ""}
                      </td>

                      <td style={{ padding: 14, color: C.muted, fontSize: 13 }}>
                        {item.min === 0
                          ? "< $5M"
                          : `≥ ${compactMoney(item.min)}`}
                      </td>

                      <td style={{ padding: 14, fontSize: 13 }}>
                        {rateLabel(item.maker)}
                      </td>

                      <td style={{ padding: 14, fontSize: 13 }}>
                        {rateLabel(item.taker)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <p
          style={{
            color: "#73796b",
            fontSize: 11,
            lineHeight: 1.8,
            margin: "18px 2px 0",
          }}
        >
          Estimates only. Fees are calculated on notional value and charged
          separately when opening and closing a position. The round-trip
          estimate assumes the same quantity, fill price, execution type, and
          VIP tier on both sides. Actual fees may differ if the closing price,
          quantity, execution type, or tier differs. Funding, slippage,
          liquidation charges, and other costs are excluded. This calculator
          uses the fee schedule supplied by the user and does not fetch live
          account VIP status.
        </p>
      </div>
    </main>
  );
}
