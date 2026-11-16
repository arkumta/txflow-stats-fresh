const TXFLOW_INFO_URL = "https://rpc.txflow-testnet.xyz/info";
const CONCURRENCY = 4;
const BATCH_PAUSE_MS = 150;
const REQUEST_TIMEOUT_MS = 12_000;

type MarketMeta = {
  name: string;
  haltTrading?: boolean;
  delisted?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMarketContext(coin: string) {
  const response = await fetch(TXFLOW_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "activeAssetCtx", coin }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Txflow returned ${response.status} for ${coin}`);
  }

  const data = await response.json();

  if (data?.message) {
    throw new Error(`${coin}: ${data.message}`);
  }

  return data;
}

export async function GET() {
  try {
    const metaResponse = await fetch(TXFLOW_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "perpMeta" }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!metaResponse.ok) {
      console.error("Txflow market metadata error:", metaResponse.status);
      return Response.json(
        { success: false, error: "Txflow market data is temporarily unavailable." },
        { status: 502 }
      );
    }

    const metaData = await metaResponse.json();

    if (!Array.isArray(metaData?.universe)) {
      console.error("Unexpected Txflow metadata response:", metaData);
      return Response.json(
        { success: false, error: "Unexpected response from Txflow." },
        { status: 502 }
      );
    }

    const activeMarkets = (metaData.universe as MarketMeta[]).filter(
      (market) => market?.name && !market.haltTrading && !market.delisted
    );

    const results: unknown[] = [];
    let failed = 0;

    // Fetch a small group concurrently instead of waiting 500ms after every
    // market. With 72 markets, the old serial loop imposed at least 36 seconds
    // of artificial delay on every page load/refresh.
    for (let i = 0; i < activeMarkets.length; i += CONCURRENCY) {
      const batch = activeMarkets.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((market) => fetchMarketContext(market.name))
      );

      for (let j = 0; j < settled.length; j += 1) {
        const item = settled[j];
        if (item.status === "fulfilled") {
          results.push(item.value);
        } else {
          failed += 1;
          console.error(
            `Failed to fetch market ${batch[j].name}:`,
            item.reason instanceof Error ? item.reason.message : item.reason
          );
        }
      }

      if (i + CONCURRENCY < activeMarkets.length) {
        await sleep(BATCH_PAUSE_MS);
      }
    }

    return Response.json(results, {
      headers: {
        "Cache-Control": "no-store",
        "X-Txflow-Markets-Requested": String(activeMarkets.length),
        "X-Txflow-Markets-Returned": String(results.length),
        "X-Txflow-Markets-Failed": String(failed),
      },
    });
  } catch (error) {
    console.error("Market-data API failed:", error);
    return Response.json(
      { success: false, error: "Unable to load market data." },
      { status: 500 }
    );
  }
}
