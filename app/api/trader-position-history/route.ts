const TXFLOW_INFO_URL = "https://testnet-api.txflow-testnet.xyz/info";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = (searchParams.get("wallet") ?? "").trim();
  const coin = (searchParams.get("coin") ?? "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 100) || 100, 1), 200);
  const offset = Math.min(Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0), 200000);

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return Response.json({ success: false, error: "A valid wallet address is required." }, { status: 400 });
  }

  try {
    const response = await fetch(TXFLOW_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-version": "2026-08-16" },
      body: JSON.stringify({ type: "userFills", user: wallet, accountType: "perp", limit, offset }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return Response.json({ success: false, error: "TxFlow history service is temporarily unavailable." }, { status: 502 });
    }

    const result = await response.json();
    if (result.success !== true || !Array.isArray(result.data?.data)) {
      return Response.json({ success: false, error: "Unexpected response from TxFlow history service." }, { status: 502 });
    }

    const fills = result.data.data
      .filter((fill: any) => !coin || String(fill.coin ?? "").toLowerCase() === coin.toLowerCase())
      .map((fill: any) => ({
        id: String(fill.tid ?? fill.hash ?? `${fill.time}-${fill.coin}-${fill.side}`),
        coin: String(fill.coin ?? "Unknown"),
        side: String(fill.side ?? ""),
        direction: String(fill.dir ?? "Trade"),
        size: Number(fill.sz) || 0,
        price: Number(fill.px) || 0,
        startPosition: Number(fill.startPosition) || 0,
        entryPrice: Number(fill.entryPrice) || 0,
        closedPnl: Number(fill.closedPnl) || 0,
        time: Number(fill.time) || 0,
      }));

    return Response.json({
      success: true,
      wallet: wallet.toLowerCase(),
      fills,
      count: fills.length,
      hasMore: result.data.hasMore === true,
      nextOffset: result.data.hasMore === true ? offset + result.data.data.length : null,
      note: "History is reconstructed from exchange fills, not periodic position snapshots. Older data may be unavailable.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trader position history API error:", error);
    return Response.json({ success: false, error: "Unable to retrieve position history. Please retry." }, { status: 502 });
  }
}
