"use client";

import { useEffect, useState } from "react";

type Position = { wallet: string; coin: string; size: number; direction: string; entryPrice: number; markPrice: number; positionValue: number; unrealizedPnl: number };
const STORAGE_KEY = "txflow-stats-wallet-watchlist";
const card: React.CSSProperties = { background: "#101410", border: "1px solid #252d25", borderRadius: 12, padding: 18 };
const muted: React.CSSProperties = { color: "#8e9a8c", fontSize: 12 };
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
const short = (s: string) => s.length > 24 ? `${s.slice(0, 10)}…${s.slice(-8)}` : s;

export default function PositionsPage() {
  const [coin, setCoin] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [walletInput, setWalletInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanNote, setScanNote] = useState("");

  useEffect(() => {
    try { setWatchlist(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch { setWatchlist([]); }
  }, []);

  function saveWatchlist(next: string[]) {
    setWatchlist(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function scan() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/position-discovery?coin=${encodeURIComponent(coin.trim())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Position discovery failed.");
      setPositions(data.positions || []);
      setScanNote(data.note || `Scanned ${data.walletsScanned} wallets.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Position discovery failed."); }
    finally { setLoading(false); }
  }

  function addWallet() {
    const wallet = walletInput.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) { setError("Enter a valid 0x wallet address."); return; }
    if (!watchlist.includes(wallet)) saveWatchlist([...watchlist, wallet]);
    setWalletInput(""); setError("");
  }

  return (
    <main style={{ minHeight: "70vh", maxWidth: 1240, margin: "0 auto", padding: "36px 22px 70px", color: "#f3f7f1" }}>
      <div style={{ marginBottom: 28 }}><div style={{ color: "#b8f34a", fontSize: 10, letterSpacing: 2, fontWeight: 800 }}>TXFLOW / TRADER INTELLIGENCE</div><h1 style={{ fontSize: 34, margin: "9px 0" }}>Position discovery</h1><p style={muted}>Find indexed wallets with open positions, and keep a personal watchlist of traders to monitor.</p></div>

      <section style={{ ...card, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Discover traders by market</h2>
        <p style={muted}>Search up to 20 wallets from the existing trader index. Leave the market blank to show all positions found.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={coin} onChange={e => setCoin(e.target.value)} placeholder="Market e.g. BTC-USDC (optional)" style={{ flex: "1 1 260px", minWidth: 0, background: "#080a08", color: "#f3f7f1", border: "1px solid #344033", borderRadius: 8, padding: 12 }} />
          <button onClick={scan} disabled={loading} style={{ background: "#b8f34a", color: "#10150b", border: 0, borderRadius: 8, padding: "0 18px", fontWeight: 800, cursor: "pointer" }}>{loading ? "Scanning…" : "Find positions"}</button>
        </div>
        {error && <p style={{ color: "#ff9292", fontSize: 12 }}>{error}</p>}
        {scanNote && <p style={muted}>{scanNote}</p>}
      </section>

      <section style={{ ...card, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Position results <span style={{ color: "#b8f34a" }}>({positions.length})</span></h2>
        {loading ? <p style={muted}>Checking indexed wallets against TxFlow testnet…</p> : positions.length === 0 ? <p style={muted}>Run a scan to find currently open positions.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["Trader","Market","Direction","Size","Entry","Mark","Position value","Unrealized PnL",""].map(x => <th key={x} style={{ padding: 10, color: "#8e9a8c", fontSize: 10 }}>{x}</th>)}</tr></thead><tbody>{positions.map((p,i) => <tr key={p.wallet+p.coin+i} style={{ borderTop: "1px solid #252d25", fontSize: 12 }}><td style={{ padding: 10 }}><a href={`/traders/${p.wallet}`} style={{ color: "#b8f34a" }}>{short(p.wallet)}</a></td><td style={{ padding: 10 }}>{p.coin}</td><td style={{ padding: 10, color: p.direction === "Long" ? "#b8f34a" : "#ff9292" }}>{p.direction}</td><td style={{ padding: 10 }}>{p.size.toLocaleString()}</td><td style={{ padding: 10 }}>{p.entryPrice}</td><td style={{ padding: 10 }}>{p.markPrice}</td><td style={{ padding: 10 }}>{money(p.positionValue)}</td><td style={{ padding: 10, color: p.unrealizedPnl >= 0 ? "#b8f34a" : "#ff9292" }}>{money(p.unrealizedPnl)}</td><td style={{ padding: 10 }}><button onClick={() => !watchlist.includes(p.wallet) && saveWatchlist([...watchlist,p.wallet])} style={{ background: "#1a2410", border: "1px solid #526d2b", color: "#b8f34a", borderRadius: 6, padding: "6px 9px", cursor: "pointer" }}>{watchlist.includes(p.wallet) ? "Saved" : "Watch"}</button></td></tr>)}</tbody></table></div>}
      </section>

      <section style={card}>
        <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>My trader watchlist <span style={{ color: "#b8f34a" }}>({watchlist.length})</span></h2>
        <p style={muted}>Saved in this browser only. Add a wallet manually or save traders from discovery results.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <input value={walletInput} onChange={e => setWalletInput(e.target.value)} placeholder="0x wallet address" style={{ flex: "1 1 300px", minWidth: 0, background: "#080a08", color: "#f3f7f1", border: "1px solid #344033", borderRadius: 8, padding: 12 }} />
          <button onClick={addWallet} style={{ background: "#1a2410", border: "1px solid #526d2b", color: "#b8f34a", borderRadius: 8, padding: "0 16px", cursor: "pointer" }}>Add wallet</button>
        </div>
        {watchlist.length === 0 ? <p style={muted}>Your watchlist is empty.</p> : <div style={{ display: "grid", gap: 8 }}>{watchlist.map(wallet => <div key={wallet} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 10, border: "1px solid #252d25", borderRadius: 8 }}><a href={`/traders/${wallet}`} style={{ color: "#b8f34a", fontSize: 12 }}>{wallet}</a><button onClick={() => saveWatchlist(watchlist.filter(w => w !== wallet))} style={{ color: "#ff9292", background: "transparent", border: "1px solid #543333", borderRadius: 6, padding: "6px 9px", cursor: "pointer" }}>Remove</button></div>)}</div>}
      </section>
      <p style={{ ...muted, marginTop: 20 }}>Read-only analytics. No wallet connection or trade execution. Position discovery is limited to indexed wallets and does not represent every TxFlow trader.</p>
    </main>
  );
}
