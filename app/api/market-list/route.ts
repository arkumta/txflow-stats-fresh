
export async function GET() {
  try {
    const response = await fetch("https://rpc.txflow-testnet.xyz/info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "perpMeta",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "Txflow market-list error:",
        response.status,
        response.statusText
      );

      return Response.json(
        { success: false, error: "Txflow market data is temporarily unavailable." },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data.universe)) {
      console.error("Unexpected Txflow market-list response:", data);

      return Response.json(
        { success: false, error: "Unexpected response from Txflow." },
        { status: 502 }
      );
    }

    const markets = data.universe.map((market: any) => ({
      name: market.name,
      index: market.index,
      maxLeverage: market.maxLeverage,
      haltTrading: market.haltTrading,
      delisted: market.delisted,
    }));

    return Response.json(markets);
  } catch (error) {
    console.error("Market-list API failed:", error);

    return Response.json(
      { success: false, error: "Unable to load market data." },
      { status: 500 }
    );
  }
}
