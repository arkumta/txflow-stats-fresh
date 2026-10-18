
export async function GET() {
  try {
    const metaResponse = await fetch(
      "https://rpc.txflow-testnet.xyz/info",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "perpMeta",
        }),
        cache: "no-store",
      }
    );

    if (!metaResponse.ok) {
      console.error("Txflow metadata error:", metaResponse.status);

      return Response.json(
        { success: false, error: "Txflow market data is temporarily unavailable." },
        { status: 502 }
      );
    }

    const metaData = await metaResponse.json();

    if (!Array.isArray(metaData.universe)) {
      console.error("Unexpected Txflow metadata response:", metaData);

      return Response.json(
        { success: false, error: "Unexpected response from Txflow." },
        { status: 502 }
      );
    }

    const activeMarkets = metaData.universe.filter(
      (market: any) => !market.haltTrading && !market.delisted
    );

    const results: any[] = [];

    for (const market of activeMarkets) {
      try {
        const response = await fetch(
          "https://rpc.txflow-testnet.xyz/info",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "activeAssetCtx",
              coin: market.name,
            }),
            cache: "no-store",
          }
        );

        if (!response.ok) {
          console.error(
            `Failed to fetch ${market.name}: ${response.status}`
          );

          if (response.status === 429) {
            console.error("Txflow rate limit reached. Stopping market requests.");
            break;
          }

          continue;
        }

        const data = await response.json();

        if (!data.message) {
          results.push(data);
        } else {
          console.error(`${market.name}: ${data.message}`);
        }

        // Wait longer between requests to reduce rate limiting.
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching ${market.name}:`, error);
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error("Market-data API failed:", error);

    return Response.json(
      { success: false, error: "Unable to load market data." },
      { status: 500 }
    );
  }
}
