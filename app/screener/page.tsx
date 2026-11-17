"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Market = {
  name: string;
  maxLeverage?: number;
  haltTrading?: boolean;
  delisted?: boolean;
};

type Context = {
  coin: string;
  lastPrice?: number | string;
  markPx?: number | string;
  prevDayPx?: number | string;
  dayNtlVlm?: number | string;
  openInterest?: number | string;
  nodeCtx?: { funding?: number | string; markPx?: number | string };
};

type Row = {
  name: string;
  price: number;
  change: number | null;
  volume: number;
  oi: number;
  funding: number;
  leverage: number;
};

const LIME = "#c7f36b";
const MUTED = "#929b88";
const panel: React.CSSProperties = {
  background: "#10130f",
  border: "1px solid #2b3326",
  borderRadius: 14,
  padding: 18,
};

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2,
  }).format(value);
}
function pct(value: number | null) {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function ScreenerPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("volume");
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const [minVolume, setMinVolume] = useState("0");
  const [minOi, setMinOi] = useState("0");
  const [minAbsFunding, setMinAbsFunding] = useState("0");
  const [changeFilter, setChangeFilter] = useState("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (inFlight.current) return;

    inFlight.current = true;
    const currentRequest = ++requestId.current;
    setLoading(true);

    try {
      const [metaRes, dataRes] = await Promise.all([
        fetch("/api/market-list", { cache: "no-store" }),
        fetch("/api/market-data", { cache: "no-store" }),
      ]);
      if (!metaRes.ok || !dataRes.ok) throw new Error("Market data is temporarily unavailable.");

      const [meta, data] = await Promise.all([metaRes.json(), dataRes.json()]);
      if (!Array.isArray(meta) || !Array.isArray(data)) {
        throw new Error("Unexpected market data response.");
      }

      if (currentRequest === requestId.current) {
        setMarkets(meta);
        setContexts(data);
        setUpdated(new Date());
        setError("");
      }
    } catch (e) {
      if (currentRequest === requestId.current) {
        setError(e instanceof Error ? e.message : "Unable to load markets.");
      }
    } finally {
      inFlight.current = false;
      if (currentRequest === requestId.current) setLoading(false);

    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => {
      window.clearInterval(timer);
      requestId.current += 1;
    };
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    const byCoin = new Map(contexts.map((item) => [item.coin, item]));
    return markets.map((market) => {
      const data = byCoin.get(market.name);
      const last = num(data?.lastPrice);
      const mark = num(data?.markPx ?? data?.nodeCtx?.markPx);
      const previous = num(data?.prevDayPx);
      return {
        name: market.name,
        price: last || mark,
        change: previous > 0 && (last || mark) > 0 ? (((last || mark) - previous) / previous) * 100 : null,
        volume: num(data?.dayNtlVlm),
        oi: num(data?.openInterest) * (mark || last),
        funding: num(data?.nodeCtx?.funding) * 100,
        leverage: num(market.maxLeverage),
      };
    }).filter((row) => {
      const market = markets.find((item) => item.name === row.name);
      if (activeOnly && (market?.haltTrading || market?.delisted)) return false;
      if (!row.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (row.volume < num(minVolume) || row.oi < num(minOi)) return false;
      if (Math.abs(row.funding) < num(minAbsFunding)) return false;
      if (changeFilter === "gainers" && !(row.change !== null && row.change > 0)) return false;
      if (changeFilter === "losers" && !(row.change !== null && row.change < 0)) return false;
      if (changeFilter === "up2" && !(row.change !== null && row.change >= 2)) return false;
      if (changeFilter === "down2" && !(row.change !== null && row.change <= -2)) return false;
      return true;
    }).sort((a, b) => {
      const av = a[sort as keyof Row];
      const bv = b[sort as keyof Row];
      const diff = num(av) - num(bv);
      return direction === "desc" ? -diff : diff;
    });
  }, [markets, contexts, search, minVolume, minOi, minAbsFunding, changeFilter, activeOnly, sort, direction]);

  const totalVolume = rows.reduce((sum, row) => sum + row.volume, 0);
  const totalOi = rows.reduce((sum, row) => sum + row.oi, 0);
  const selectStyle: React.CSSProperties = {
    minHeight: 40, padding: "9px 11px", borderRadius: 8,
    border: "1px solid #343d2d", background: "#090c08", color: "#edf2e6", fontSize: 12,
  };
  const labelStyle: React.CSSProperties = { display: "grid", gap: 6, color: MUTED, fontSize: 10 };

  return (
    <main style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 22px 70px", color: "#f2f5ed" }}>
      <div style={{ marginBottom: 25 }}>
        <div style={{ color: LIME, fontSize: 10, fontWeight: 800, letterSpacing: 2 }}>TXFLOW / MARKET TOOLS</div>
        <h1 style={{ margin: "10px 0 8px", fontSize: "clamp(30px,4vw,42px)", letterSpacing: "-1.5px" }}>Market <span style={{ color: LIME }}>Screener</span></h1>
        <p style={{ color: MUTED, margin: 0, fontSize: 13 }}>Find perpetual markets using volume, open interest, funding and 24-hour price movement.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
        {[["Markets matching", rows.length.toLocaleString()], ["24H volume · filtered", usd(totalVolume)], ["Open interest · filtered", usd(totalOi)], ["Data refresh", "30 seconds"]].map(([label, value]) => (
          <div key={label} style={panel}><div style={{ color: MUTED, fontSize: 10 }}>{label}</div><strong style={{ display: "block", marginTop: 10, color: label === "Markets matching" ? LIME : "#f3f6ee", fontSize: 22 }}>{value}</strong></div>
        ))}
      </div>

      <section style={{ ...panel, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 15 }}>
          <strong style={{ fontSize: 14 }}>Screening filters</strong>
          <button type="button" onClick={() => { setSearch(""); setMinVolume("0"); setMinOi("0"); setMinAbsFunding("0"); setChangeFilter("all"); setActiveOnly(true); }} style={{ ...selectStyle, color: LIME, cursor: "pointer" }}>Reset filters</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
          <label style={labelStyle}>SEARCH MARKET<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="BTC, ETH..." style={selectStyle}/></label>
          <label style={labelStyle}>MIN 24H VOLUME (USD)<input type="number" min="0" value={minVolume} onChange={(e) => setMinVolume(e.target.value)} style={selectStyle}/></label>
          <label style={labelStyle}>MIN OPEN INTEREST (USD)<input type="number" min="0" value={minOi} onChange={(e) => setMinOi(e.target.value)} style={selectStyle}/></label>
          <label style={labelStyle}>MIN ABS. FUNDING (%)<input type="number" min="0" step="0.001" value={minAbsFunding} onChange={(e) => setMinAbsFunding(e.target.value)} style={selectStyle}/></label>
          <label style={labelStyle}>24H PRICE MOVEMENT<select value={changeFilter} onChange={(e) => setChangeFilter(e.target.value)} style={selectStyle}><option value="all">All markets</option><option value="gainers">Positive change</option><option value="losers">Negative change</option><option value="up2">Up 2% or more</option><option value="down2">Down 2% or more</option></select></label>
          <label style={labelStyle}>SORT BY<select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}><option value="volume">24H volume</option><option value="oi">Open interest</option><option value="change">24H change</option><option value="funding">Funding rate</option><option value="price">Last price</option></select></label>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, color: MUTED, fontSize: 11 }}><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Active markets only</label>
      </section>

      <section style={{ ...panel, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid #293126", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Matching markets <span style={{ color: MUTED, fontWeight: 400 }}>({rows.length})</span></strong>
          <button type="button" onClick={() => setDirection((value) => value === "desc" ? "asc" : "desc")} style={{ ...selectStyle, cursor: "pointer" }}>Order: {direction === "desc" ? "Highest first" : "Lowest first"}</button>
        </div>
        {error && <div role="status" style={{ margin: 16, padding: 12, borderRadius: 8, border: "1px solid #75443e", background: "#241613", color: "#ffb0a8", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>{updated ? "Refresh failed. Showing the last successful market data. " : ""}{error}</span>
          <button onClick={() => void load()} disabled={loading} style={{ color: LIME, background: "none", border: 0, cursor: loading ? "wait" : "pointer" }}>{loading ? "Retrying…" : "Retry"}</button>
        </div>}
        {loading && !updated ? <p style={{ padding: 30, color: MUTED, textAlign: "center" }}>Loading market data…</p> : rows.length === 0 ? <p style={{ padding: 30, color: MUTED, textAlign: "center" }}>{markets.length === 0 ? "No market data is available yet." : "No markets match these filters. Try lowering the minimum values."}</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["MARKET","LAST PRICE","24H CHANGE","24H VOLUME","OPEN INTEREST","FUNDING","MAX LEVERAGE"].map((heading) => <th key={heading} style={{ padding: "13px 12px", textAlign: heading === "MARKET" ? "left" : "right", color: MUTED, fontSize: 9, letterSpacing: 1, borderBottom: "1px solid #30382b" }}>{heading}</th>)}</tr></thead>
              <tbody>{rows.map((row) => <tr key={row.name} style={{ borderBottom: "1px solid #22291f" }}>
                <td style={{ padding: "13px 12px" }}><Link href={`/markets/${encodeURIComponent(row.name)}`} style={{ color: "#edf2e6", fontWeight: 750, textDecoration: "none" }}>{row.name}</Link></td>
                <td style={{ textAlign: "right", padding: 12 }}>{row.price ? usd(row.price) : "—"}</td>
                <td style={{ textAlign: "right", padding: 12, color: row.change === null ? MUTED : row.change >= 0 ? LIME : "#ff8177" }}>{pct(row.change)}</td>
                <td style={{ textAlign: "right", padding: 12 }}>{usd(row.volume)}</td>
                <td style={{ textAlign: "right", padding: 12 }}>{usd(row.oi)}</td>
                <td style={{ textAlign: "right", padding: 12, color: row.funding >= 0 ? LIME : "#ff8177" }}>{row.funding.toFixed(4)}%</td>
                <td style={{ textAlign: "right", padding: 12 }}>{row.leverage ? `${row.leverage}x` : "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        <div style={{ padding: "12px 18px", borderTop: "1px solid #293126", color: MUTED, fontSize: 10, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span>Open interest is estimated as contracts × mark price.</span><span>{updated ? `Updated ${updated.toLocaleTimeString()}` : "Waiting for data"} · Auto-refresh 30s</span>
        </div>
      </section>
    </main>
  );
}
