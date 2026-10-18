
const WebSocket = require("ws");

const API_BASE = "http://localhost:3000";
const WS_URL = "wss://testnet-api.txflow-testnet.xyz/api-ws";

const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 500;
const MAX_BUFFER_SIZE = 50000;
const HISTORY_CUTOFF_MS = 24 * 60 * 60 * 1000;
const RECONNECT_DELAY_MS = 3000;

const tradeBuffer = new Map();
const processedTradeIds = new Map();

let flushInProgress = false;
let droppedTrades = 0;
let lastCleanupTime = 0;
let reconnectTimer = null;
let collectorStarted = false;

async function getMarkets() {
  const response = await fetch(`${API_BASE}/api/market-list`);

  if (!response.ok) {
    throw new Error("Failed to get market list");
  }

  return response.json();
}

function enqueueTrade(trade) {
  const tradeTime = Number(trade.time);
  const cutoffTime = Date.now() - HISTORY_CUTOFF_MS;

  if (!Number.isFinite(tradeTime) || tradeTime < cutoffTime) {
    return;
  }

  if (trade.tid === undefined || trade.tid === null) {
    return;
  }

  const tradeId = String(trade.tid);

  if (Date.now() - lastCleanupTime > 60000) {
    for (const [id, time] of processedTradeIds) {
      if (time < cutoffTime) {
        processedTradeIds.delete(id);
      }
    }

    lastCleanupTime = Date.now();
  }

  const existing = tradeBuffer.get(tradeId);

  if (existing) {
    existing.users = [
      ...new Set([
        ...(Array.isArray(existing.users) ? existing.users : []),
        ...(Array.isArray(trade.users) ? trade.users : []),
      ]),
    ];
    return;
  }

  if (processedTradeIds.has(tradeId)) {
    return;
  }

  if (tradeBuffer.size >= MAX_BUFFER_SIZE) {
    droppedTrades++;

    if (droppedTrades % 100 === 1) {
      console.error(`Buffer full. Dropped trades: ${droppedTrades}`);
    }

    return;
  }

  tradeBuffer.set(tradeId, trade);
}

async function flushBatch() {
  if (flushInProgress || tradeBuffer.size === 0) {
    return;
  }

  flushInProgress = true;

  const batch = [];

  for (const [tradeId, trade] of tradeBuffer) {
    batch.push(trade);
    tradeBuffer.delete(tradeId);
    processedTradeIds.set(tradeId, Number(trade.time));

    if (batch.length >= BATCH_SIZE) {
      break;
    }
  }

  try {
    const response = await fetch(`${API_BASE}/api/save-trade`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trades: batch }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Batch save failed");
    }

    console.log(
      `Batch saved: ${result.processed} processed, ` +
      `${result.new} new, ${result.duplicates} duplicates`
    );
  } catch (error) {
    for (const trade of batch) {
      const tradeId = String(trade.tid);
      processedTradeIds.delete(tradeId);

      const existing = tradeBuffer.get(tradeId);

      if (existing) {
        existing.users = [
          ...new Set([
            ...(Array.isArray(existing.users) ? existing.users : []),
            ...(Array.isArray(trade.users) ? trade.users : []),
          ]),
        ];
      } else {
        tradeBuffer.set(tradeId, trade);
      }
    }

    console.error("Batch save failed:", error.message);
  } finally {
    flushInProgress = false;
  }
}

function connectWebSocket(activeMarkets) {
  console.log("Connecting to TxFlow WebSocket...");

  const ws = new WebSocket(WS_URL);
  let reconnectScheduled = false;

  function scheduleReconnect() {
    if (reconnectScheduled) return;

    reconnectScheduled = true;
    console.log(`Reconnecting in ${RECONNECT_DELAY_MS / 1000} seconds...`);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket(activeMarkets);
    }, RECONNECT_DELAY_MS);
  }

  ws.on("open", () => {
    console.log("Connected to TxFlow WebSocket");

    for (const market of activeMarkets) {
      ws.send(
        JSON.stringify({
          method: "subscribe",
          subscription: {
            type: "trades",
            coin: market.name,
            instrumentId: market.index,
          },
        })
      );
    }

    console.log(`Subscribed to ${activeMarkets.length} markets`);
  });

  ws.on("message", message => {
    try {
      const data = JSON.parse(message.toString());

      if (data.channel !== "trades" || !data.data) {
        return;
      }

      const trades = Array.isArray(data.data) ? data.data : [data.data];

      for (const trade of trades) {
        enqueueTrade(trade);
      }
    } catch (error) {
      console.error("WebSocket message error:", error.message);
    }
  });

  ws.on("error", error => {
    console.error("WebSocket error:", error.message);

    // Closing the socket will trigger the close handler.
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    } else if (ws.readyState === WebSocket.CONNECTING) {
      ws.terminate();
    }
  });

  ws.on("close", () => {
    console.log("WebSocket disconnected");
    scheduleReconnect();
  });
}

async function start() {
  if (collectorStarted) return;
  collectorStarted = true;

  console.log("Getting TxFlow markets...");

  const markets = await getMarkets();

  const activeMarkets = markets.filter(
    market =>
      market.haltTrading === false &&
      market.delisted === false
  );

  console.log(`Found ${activeMarkets.length} active markets`);

  connectWebSocket(activeMarkets);

  setInterval(() => {
    console.log(
      `Buffer: ${tradeBuffer.size} waiting | ` +
      `Saving: ${flushInProgress} | ` +
      `Dropped: ${droppedTrades}`
    );

    if (!flushInProgress && tradeBuffer.size > 0) {
      flushBatch();
    }
  }, FLUSH_INTERVAL_MS);
}

start().catch(error => {
  console.error("Collector failed:", error.message);
  process.exitCode = 1;
});
