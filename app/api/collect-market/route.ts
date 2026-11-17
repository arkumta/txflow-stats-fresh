import { supabase } from "../../lib/supabase";

const TXFLOW_INFO_URL = "https://rpc.txflow-testnet.xyz/info";
const CONCURRENCY = 4;
const BATCH_PAUSE_MS = 150;
const REQUEST_TIMEOUT_MS = 12_000;

type MarketMeta = {
  name: string;
  haltTrading?: boolean;
  delisted?: boolean;
};

type Snapshot = {
  coin: string;
  price: number | null;
  volume_24h: number | null;
  open_interest: number | null;
  funding_rate: number | null;
  mark_price: number | null;
  oracle_price: number | null;
  recorded_at: string;
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function postTxflow(body: Record<string, unknown>) {
  const response = await fetch(TXFLOW_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Txflow returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data?.message) throw new Error(data.message);
  return data;
}

async function collectOneMarket(coin: string, recordedAt: string): Promise<Snapshot> {
  const market = await postTxflow({ type: "activeAssetCtx", coin });
  const lastPrice = numericOrNull(market?.lastPrice);
  const openInterestContracts = numericOrNull(market?.openInterest);
  const funding = numericOrNull(market?.nodeCtx?.funding);

  return {
    coin,
    price: lastPrice,
    volume_24h: numericOrNull(market?.dayNtlVlm),
    // Txflow reports open interest in contracts; store its estimated USD value.
    open_interest:
      openInterestContracts !== null && lastPrice !== null
        ? openInterestContracts * lastPrice
        : null,
    funding_rate: funding,
    mark_price: numericOrNull(market?.nodeCtx?.markPx),
    oracle_price: numericOrNull(market?.nodeCtx?.oraclePx),
    recorded_at: recordedAt,
  };
}

export async function GET() {
  try {
    const metadata = await postTxflow({ type: "perpMeta" });

    if (!Array.isArray(metadata?.universe)) {
      return Response.json(
        { success: false, error: "Unexpected Txflow market metadata response." },
        { status: 502 }
      );
    }

    const activeMarkets = (metadata.universe as MarketMeta[]).filter(
      (market) => market?.name && !market.haltTrading && !market.delisted
    );

    if (activeMarkets.length === 0) {
      return Response.json(
        { success: false, error: "Txflow returned no active markets." },
        { status: 502 }
      );
    }

    const recordedAt = new Date().toISOString();
    const snapshots: Snapshot[] = [];
    const failures: { coin: string; error: string }[] = [];

    for (let i = 0; i < activeMarkets.length; i += CONCURRENCY) {
      const batch = activeMarkets.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((market) => collectOneMarket(market.name, recordedAt))
      );

      settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
          snapshots.push(result.value);
        } else {
          failures.push({
            coin: batch[index].name,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Unknown market collection error",
          });
        }
      });

      if (i + CONCURRENCY < activeMarkets.length) {
        await sleep(BATCH_PAUSE_MS);
      }
    }

    if (snapshots.length === 0) {
      return Response.json(
        {
          success: false,
          error: "No market snapshots could be collected.",
          requested: activeMarkets.length,
          failed: failures.length,
          failures,
        },
        { status: 502 }
      );
    }

    const { error: insertError } = await supabase
      .from("market_snapshots")
      .insert(snapshots);

    if (insertError) {
      console.error("Market snapshot insert failed:", insertError);
      return Response.json(
        {
          success: false,
          error: insertError.message,
          collected: snapshots.length,
          requested: activeMarkets.length,
        },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        partial: failures.length > 0,
        message:
          failures.length === 0
            ? "Snapshots saved for all active markets."
            : "Snapshots saved, but some markets failed.",
        requested: activeMarkets.length,
        saved: snapshots.length,
        failed: failures.length,
        recordedAt,
        failures,
      },
      {
        headers: { "Cache-Control": "no-store" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Market collection failed:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown market collection error",
      },
      { status: 500 }
    );
  }
}
