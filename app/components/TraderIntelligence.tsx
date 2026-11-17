"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Position = {
  coin: string; size: number; direction: string; entryPrice: number; markPrice: number;
  positionValue: number; unrealizedPnl: number; liquidationPrice: number; leverage: unknown;
};
type Fill = {
  id: string; coin: string; side: string; direction: string; size: number; price: number;
  startPosition: number; entryPrice: number; closedPnl: number; time: number;
};

const panel: React.CSSProperties = { background: "#101410", border: "1px solid #252d25", borderRadius: 12, overflow: "hidden" };
const muted: React.CSSProperties = { color: "#8e9a8c", fontSize: 12 };
const cell: React.CSSProperties = { padding: "12px 14px", borderTop: "1px solid #252d25", fontSize: 12, whiteSpace: "nowrap" };

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value || 0);
}
function number(value: number) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export default function TraderIntelligence({ wallet }: { wallet: string }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const positionsInFlight = useRef(false);
  const positionsRequestId = useRef(0);
  const positionsController = useRef<AbortController | null>(null);

  const loadPositions = useCallback(async () => {
    if (positionsInFlight.current) return;

    positionsInFlight.current = true;
    const requestId = ++positionsRequestId.current;
    const controller = new AbortController();
    positionsController.current = controller;
    if (updatedAt) setRefreshing(true);

    try {
      const response = await fetch(`/api/trader-positions?wallet=${encodeURIComponent(wallet)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load positions.");
      if (requestId === positionsRequestId.current) {
        setPositions(data.positions || []);
        setUpdatedAt(data.updatedAt || "");
        setError("");
      }
    } catch (e) {
      if (requestId === positionsRequestId.current && !controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Unable to load positions.");
      }
    } finally {
      if (requestId === positionsRequestId.current) {
        positionsInFlight.current = false;
        positionsController.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [wallet, updatedAt]);

  useEffect(() => {
    let active = true;
    const historyController = new AbortController();
    async function loadHistory() {
      try {
        const response = await fetch(`/api/trader-position-history?wallet=${encodeURIComponent(wallet)}&limit=100`, { signal: historyController.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Unable to load position history.");
        if (active) setFills(data.fills || []);
      } catch (e) {
        if (active) setHistoryError(e instanceof Error ? e.message : "Unable to load history.");
      } finally { if (active) setHistoryLoading(false); }
    }
    loadPositions();
    loadHistory();
    const timer = window.setInterval(loadPositions, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      historyController.abort();
      positionsRequestId.current += 1;
      positionsController.current?.abort();
      positionsController.current = null;
      positionsInFlight.current = false;
    };
  }, [loadPositions, wallet]);

  return (
    <div style={{ display: "grid", gap: 26 }}>
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <div><h2 style={{ color: "#f3f7f1", margin: 0, fontSize: 20 }}>Open positions</h2><p style={muted}>Current testnet positions · refreshes every 30 seconds</p></div>
          <button onClick={loadPositions} style={{ background: "#1a2410", border: "1px solid #526d2b", color: "#b8f34a", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
        <div style={panel}>
          {loading ? <p style={{ padding: 18, ...muted }}>Loading live positions…</p> : error && positions.length === 0 ? <p style={{ padding: 18, color: "#ff9292" }}>{error} <button onClick={loadPositions} style={{ marginLeft: 8, color: "#b8f34a", background: "transparent", border: 0, cursor: "pointer" }}>Retry</button></p> : positions.length === 0 ? <p style={{ padding: 18, ...muted }}>No open positions found for this wallet.</p> : (
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr>{["Market","Direction","Size","Entry","Mark","Position value","Unrealized PnL","Liquidation"].map(x => <th key={x} style={{ ...cell, color: "#8e9a8c", borderTop: 0 }}>{x}</th>)}</tr></thead>
              <tbody>{positions.map((p, i) => <tr key={`${p.coin}-${i}`}><td style={cell}>{p.coin}</td><td style={{ ...cell, color: p.direction === "Long" ? "#b8f34a" : "#ff9292" }}>{p.direction}</td><td style={cell}>{number(p.size)}</td><td style={cell}>{number(p.entryPrice)}</td><td style={cell}>{number(p.markPrice)}</td><td style={cell}>{money(p.positionValue)}</td><td style={{ ...cell, color: p.unrealizedPnl >= 0 ? "#b8f34a" : "#ff9292" }}>{money(p.unrealizedPnl)}</td><td style={cell}>{p.liquidationPrice ? number(p.liquidationPrice) : "—"}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>
        {error && positions.length > 0 && <p role="status" style={{ color: "#ffb3a8", fontSize: 11 }}>Refresh failed; showing the last successful positions. {error}</p>}
        {updatedAt && <p style={muted}>{refreshing ? "Refreshing positions…" : "Last updated: " + new Date(updatedAt).toLocaleTimeString()}</p>}
      </section>

      <section>
        <div style={{ marginBottom: 12 }}><h2 style={{ color: "#f3f7f1", margin: 0, fontSize: 20 }}>Position & fill history</h2><p style={muted}>Exchange fills include open, increase, reduce and close direction labels when supplied by TxFlow.</p></div>
        <div style={panel}>
          {historyLoading ? <p style={{ padding: 18, ...muted }}>Loading fill history…</p> : historyError ? <p style={{ padding: 18, color: "#ff9292" }}>{historyError}</p> : fills.length === 0 ? <p style={{ padding: 18, ...muted }}>No fill history returned by TxFlow.</p> : (
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr>{["Time","Market","Action","Side","Size","Price","Starting position","Entry price","Realized PnL"].map(x => <th key={x} style={{ ...cell, color: "#8e9a8c", borderTop: 0 }}>{x}</th>)}</tr></thead>
              <tbody>{fills.map((f, i) => <tr key={`${f.id}-${i}`}><td style={cell}>{f.time ? new Date(f.time).toLocaleString() : "—"}</td><td style={cell}>{f.coin}</td><td style={cell}>{f.direction}</td><td style={cell}>{f.side}</td><td style={cell}>{number(f.size)}</td><td style={cell}>{number(f.price)}</td><td style={cell}>{number(f.startPosition)}</td><td style={cell}>{f.entryPrice ? number(f.entryPrice) : "—"}</td><td style={{ ...cell, color: f.closedPnl >= 0 ? "#b8f34a" : "#ff9292" }}>{money(f.closedPnl)}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>
        <p style={muted}>Fill history is not a perfect historical position ledger: the exchange provides executions, not a full sequence of saved position snapshots.</p>
      </section>
    </div>
  );
}
