"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Position = { wallet: string; coin: string; size: number; direction: string; entryPrice: number; markPrice: number; positionValue: number; unrealizedPnl: number };
type Fill = { id: string; wallet: string; coin: string; direction: string; side: string; size: number; price: number; closedPnl: number; time: number };
type TraderSnapshot = { wallet: string; positions: Position[]; fills: Fill[]; error?: string };
const STORAGE_KEY = "txflow-stats-wallet-watchlist";
const panel: React.CSSProperties = { background: "#101410", border: "1px solid #252d25", borderRadius: 14, padding: 18 };
const muted: React.CSSProperties = { color: "#8e9a8c", fontSize: 12 };
const lime = "#b8f34a";
const red = "#ff9292";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
const number = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 6 });
const short = (s: string) => s.length > 22 ? `${s.slice(0, 9)}…${s.slice(-7)}` : s;

async function getJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Request failed");
  return data;
}

export default function PositionsPage() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [walletInput, setWalletInput] = useState("");
  const [snapshots, setSnapshots] = useState<TraderSnapshot[]>([]);
  const snapshotsRef = useRef<TraderSnapshot[]>([]);
  const [previous, setPrevious] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const refreshInFlight = useRef(false);
  const refreshQueued = useRef(false);
  const requestVersion = useRef(0);
  const watchlistRef = useRef<string[]>([]);
  watchlistRef.current = watchlist;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setWatchlist(saved.filter((x): x is string => typeof x === "string" && /^0x[a-fA-F0-9]{40}$/.test(x)));
    } catch { setWatchlist([]); }
    setLoaded(true);
  }, []);

  const saveWatchlist = useCallback((next: string[]) => {
    const clean = Array.from(new Set(next.map(w => w.toLowerCase())));
    setWatchlist(clean);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      setError("");
    } catch {
      setError("Your watchlist changed for this session, but the browser could not save it. Check your browser storage settings.");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) {
      refreshQueued.current = true;
      return;
    }

    const currentWatchlist = [...watchlistRef.current];
    const version = ++requestVersion.current;
    refreshInFlight.current = true;
    setLoading(true);
    setError("");

    if (currentWatchlist.length === 0) {
      snapshotsRef.current = [];
      setSnapshots([]);
      setPrevious({});
      setLastUpdated(new Date().toISOString());
      setLoading(false);
      refreshInFlight.current = false;
      return;
    }

    const oldSnapshots = snapshotsRef.current;
    const oldValues: Record<string, number> = {};
    oldSnapshots.forEach(s => s.positions.forEach(p => { oldValues[`${s.wallet}:${p.coin}`] = p.positionValue; }));
    const results: TraderSnapshot[] = [];
    let cursor = 0;

    try {
      const workers = Array.from({ length: Math.min(3, currentWatchlist.length) }, async () => {
        while (cursor < currentWatchlist.length) {
          const wallet = currentWatchlist[cursor++];
          try {
            const [positionData, historyData] = await Promise.all([
              getJson(`/api/trader-positions?wallet=${encodeURIComponent(wallet)}`),
              getJson(`/api/trader-position-history?wallet=${encodeURIComponent(wallet)}&limit=12`),
            ]);
            results.push({
              wallet,
              positions: (positionData.positions || []).map((p: Omit<Position, "wallet">) => ({ ...p, wallet })),
              fills: (historyData.fills || []).map((f: Omit<Fill, "wallet">) => ({ ...f, wallet })),
            });
          } catch (e) {
            const prior = oldSnapshots.find(s => s.wallet === wallet);
            results.push({
              wallet,
              positions: prior?.positions ?? [],
              fills: prior?.fills ?? [],
              error: e instanceof Error ? e.message : "Unable to load trader.",
            });
          }
        }
      });
      await Promise.all(workers);

      const latestWatchlist = watchlistRef.current;
      const sameWatchlist = latestWatchlist.length === currentWatchlist.length &&
        latestWatchlist.every((wallet, index) => wallet === currentWatchlist[index]);
      if (version === requestVersion.current && sameWatchlist) {
        const ordered = currentWatchlist.map(w => results.find(r => r.wallet === w)).filter((x): x is TraderSnapshot => Boolean(x));
        setPrevious(oldValues);
        snapshotsRef.current = ordered;
        setSnapshots(ordered);
        setLastUpdated(new Date().toISOString());
        if (ordered.every(x => x.error)) setError("Could not refresh any watched traders. Previous data is retained where available.");
        else if (ordered.some(x => x.error)) setError("Some traders could not be refreshed. Their last available data is being shown.");
      }
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
      if (refreshQueued.current) {
        refreshQueued.current = false;
        Promise.resolve().then(() => refresh());
      }
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => {
      window.clearInterval(timer);
      requestVersion.current += 1;
    };
  }, [loaded, refresh, watchlist]);

  const allPositions = useMemo(() => snapshots.flatMap(s => s.positions), [snapshots]);
  const allFills = useMemo(() => snapshots.flatMap(s => s.fills).sort((a, b) => b.time - a.time).slice(0, 12), [snapshots]);
  const totalExposure = allPositions.reduce((sum, p) => sum + Math.abs(p.positionValue), 0);
  const totalPnl = allPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const longExposure = allPositions.filter(p => p.direction === "Long").reduce((sum, p) => sum + Math.abs(p.positionValue), 0);
  const shortExposure = allPositions.filter(p => p.direction === "Short").reduce((sum, p) => sum + Math.abs(p.positionValue), 0);
  const traderRows = snapshots.map(s => ({
    ...s,
    exposure: s.positions.reduce((sum, p) => sum + Math.abs(p.positionValue), 0),
    pnl: s.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
  })).sort((a, b) => b.exposure - a.exposure);

  function addWallet() {
    const wallet = walletInput.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) { setError("Enter a valid 0x wallet address."); return; }
    if (!watchlist.includes(wallet)) saveWatchlist([...watchlist, wallet]);
    setWalletInput("");
    setError("");
  }

  const cell: React.CSSProperties = { padding: "11px 10px", borderTop: "1px solid #252d25", fontSize: 12, whiteSpace: "nowrap" };
  const inputStyle: React.CSSProperties = { minWidth: 0, background: "#080a08", color: "#f3f7f1", border: "1px solid #344033", borderRadius: 8, padding: 11 };

  return (
    <main style={{ minHeight: "70vh", maxWidth: 1320, margin: "0 auto", padding: "34px 22px 70px", color: "#f3f7f1" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 25 }}>
        <div><div style={{ color: lime, fontSize: 10, letterSpacing: 2, fontWeight: 800 }}>TXFLOW / TRADER INTELLIGENCE</div><h1 style={{ fontSize: 34, margin: "9px 0" }}>Watchlist monitor</h1><p style={muted}>Track live exposure, unrealized PnL and recent fills across your saved traders.</p></div>
        <button onClick={refresh} disabled={loading || !loaded} style={{ background: "#1a2410", border: "1px solid #526d2b", color: lime, borderRadius: 8, padding: "10px 15px", fontWeight: 750, cursor: "pointer" }}>{loading ? "Refreshing…" : "↻ Refresh now"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["WATCHED TRADERS", String(watchlist.length), "Saved in this browser"],
          ["OPEN POSITIONS", String(allPositions.length), "Across watched wallets"],
          ["TOTAL EXPOSURE", money(totalExposure), `Long ${money(longExposure)} · Short ${money(shortExposure)}`],
          ["UNREALIZED PNL", money(totalPnl), "Current open positions"],
        ].map(([label, value, detail]) => <div key={label} style={{ ...panel, padding: 16 }}><div style={{ color: "#8e9a8c", fontSize: 10, letterSpacing: 1 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 750, margin: "12px 0 6px", color: label === "UNREALIZED PNL" ? (totalPnl >= 0 ? lime : red) : "#f3f7f1", overflowWrap: "anywhere" }}>{value}</div><div style={muted}>{detail}</div></div>)}
      </div>

      <section style={{ ...panel, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}><div><h2 style={{ margin: 0, fontSize: 18 }}>Watched traders</h2><p style={muted}>Ranked by current open-position exposure · auto-refresh every 30 seconds</p></div>{lastUpdated && <span style={muted}>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>}</div>
        {error && <p style={{ color: red, fontSize: 12 }}>{error}</p>}
        {watchlist.length === 0 ? <p style={muted}>Add a wallet below to start monitoring its positions and fills.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["#","TRADER","OPEN POSITIONS","EXPOSURE","UNREALIZED PNL","STATUS"].map(x => <th key={x} style={{ padding: 10, color: "#8e9a8c", fontSize: 10 }}>{x}</th>)}</tr></thead><tbody>{traderRows.map((s, i) => <tr key={s.wallet}><td style={cell}>{i + 1}</td><td style={cell}><a href={`/traders/${s.wallet}`} style={{ color: lime }}>{short(s.wallet)}</a></td><td style={cell}>{s.positions.length}</td><td style={cell}>{money(s.exposure)}</td><td style={{ ...cell, color: s.pnl >= 0 ? lime : red }}>{money(s.pnl)}</td><td style={cell}>{s.error ? <span style={{ color: red }}>Refresh failed · showing saved data</span> : s.positions.length ? <span style={{ color: lime }}>In position</span> : <span style={{ color: "#8e9a8c" }}>No open positions</span>}</td></tr>)}</tbody></table></div>}
      </section>

      <section style={{ ...panel, marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Open positions across watchlist</h2><p style={muted}>Position size changes are highlighted against the previous successful refresh.</p>
        {loading && snapshots.length === 0 ? <p style={muted}>Loading watched traders…</p> : allPositions.length === 0 ? <p style={muted}>{watchlist.length === 0 ? "Add a wallet to see its open positions." : error ? "Position data is temporarily unavailable. Retry to try again." : "No open positions found for the current watchlist."}</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["TRADER","MARKET","SIDE","SIZE","ENTRY","MARK","EXPOSURE","UNREALIZED PNL","CHANGE"].map(x => <th key={x} style={{ padding: 10, color: "#8e9a8c", fontSize: 10 }}>{x}</th>)}</tr></thead><tbody>{[...allPositions].sort((a,b) => Math.abs(b.positionValue)-Math.abs(a.positionValue)).map((p, i) => { const old = previous[`${p.wallet}:${p.coin}`]; const delta = old === undefined ? null : Math.abs(p.positionValue) - Math.abs(old); return <tr key={p.wallet+p.coin+i}><td style={cell}><a href={`/traders/${p.wallet}`} style={{ color: lime }}>{short(p.wallet)}</a></td><td style={cell}>{p.coin}</td><td style={{ ...cell, color: p.direction === "Long" ? lime : red }}>{p.direction}</td><td style={cell}>{number(p.size)}</td><td style={cell}>{number(p.entryPrice)}</td><td style={cell}>{number(p.markPrice)}</td><td style={cell}>{money(Math.abs(p.positionValue))}</td><td style={{ ...cell, color: p.unrealizedPnl >= 0 ? lime : red }}>{money(p.unrealizedPnl)}</td><td style={{ ...cell, color: delta === null ? "#8e9a8c" : delta >= 0 ? lime : red }}>{delta === null ? "New" : `${delta >= 0 ? "+" : ""}${money(delta)}`}</td></tr>; })}</tbody></table></div>}
      </section>

      <section style={{ ...panel, marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Latest trading activity</h2><p style={muted}>Most recent fills returned by TxFlow for watched wallets.</p>
        {allFills.length === 0 ? <p style={muted}>No recent fills available for the watchlist.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["TIME","TRADER","MARKET","ACTION","SIZE","PRICE","REALIZED PNL"].map(x => <th key={x} style={{ padding: 10, color: "#8e9a8c", fontSize: 10 }}>{x}</th>)}</tr></thead><tbody>{allFills.map((f, i) => <tr key={f.wallet+f.id+i}><td style={cell}>{f.time ? new Date(f.time).toLocaleString() : "—"}</td><td style={cell}><a href={`/traders/${f.wallet}`} style={{ color: lime }}>{short(f.wallet)}</a></td><td style={cell}>{f.coin}</td><td style={cell}>{f.direction || f.side}</td><td style={cell}>{number(f.size)}</td><td style={cell}>{number(f.price)}</td><td style={{ ...cell, color: f.closedPnl >= 0 ? lime : red }}>{money(f.closedPnl)}</td></tr>)}</tbody></table></div>}
      </section>

      <section style={{ ...panel, marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Manage watchlist</h2><p style={muted}>Wallets are saved in this browser only. Your list is stored locally in this browser.</p>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", margin: "14px 0" }}><input value={walletInput} onChange={e => setWalletInput(e.target.value)} placeholder="Paste 0x wallet address" style={{ ...inputStyle, flex: "1 1 300px" }} /><button onClick={addWallet} style={{ background: lime, color: "#10150b", border: 0, borderRadius: 8, padding: "0 18px", fontWeight: 800 }}>Add trader</button></div>
        {watchlist.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{watchlist.map(w => <div key={w} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #30392a", borderRadius: 8, padding: "7px 9px", fontSize: 11 }}><a href={`/traders/${w}`} style={{ color: lime }}>{short(w)}</a><button onClick={() => saveWatchlist(watchlist.filter(x => x !== w))} aria-label={`Remove ${w}`} style={{ background: "transparent", border: 0, color: red, cursor: "pointer" }}>×</button></div>)}</div>}
      </section>

      <section style={panel}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Trader discovery</h2>
        <p style={muted}>Discovery will be added in a later phase. For now, add wallet addresses directly to your watchlist. This page does not query the Supabase wallet index.</p>
      </section>

      <p style={{ ...muted, marginTop: 18 }}>Read-only analytics · Data is from TxFlow testnet APIs · Watchlist is stored locally in this browser · No wallet connection or trade execution.</p>
    </main>
  );
}
