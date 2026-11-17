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
    // Match the request format already used by this project's working trader-fill sync route.
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - 365 * 24 * 60 * 60 * 1000;
    const response = await fetch(TXFLOW_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-version": "2026-08-16" },
      body: JSON.stringify({ type: "userFills", user: wallet, startTimeMs, endTimeMs, offset, limit }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("TxFlow history HTTP error:", response.status, responseText.slice(0, 500));
      return Response.json({ success: false, error: "TxFlow history service is temporarily unavailable." }, { status: 502 });
    }

    let result: any;
    try { result = JSON.parse(responseText); }
    catch {
      console.error("TxFlow history returned non-JSON:", responseText.slice(0, 500));
      return Response.json({ success: false, error: "TxFlow returned an unreadable history response." }, { status: 502 });
    }

    // The Info API normally wraps fills in data.data. Accept a direct data array too,
    // since the provider has returned more than one response envelope across endpoints.
    const rawFills = Array.isArray(result?.data?.data)
      ? result.data.data
      : Array.isArray(result?.data)
        ? result.data
        : null;

    if (result?.success !== true || !rawFills) {
      console.error("Unexpected TxFlow userFills response:", JSON.stringify(result).slice(0, 1000));
      return Response.json({
        success: false,
        error: result?.message || result?.error || "TxFlow did not return a recognized fills response.",
      }, { status: 502 });
    }

    const fills = rawFills
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

    const hasMore = result.data?.hasMore === true;
    return Response.json({
      success: true,
      wallet: wallet.toLowerCase(),
      fills,
      count: fills.length,
      hasMore,
      nextOffset: hasMore ? offset + rawFills.length : null,
      note: "History is reconstructed from exchange fills over the last 365 days, not periodic position snapshots. Older data may be unavailable.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trader position history API error:", error);
    return Response.json({ success: false, error: "Unable to retrieve position history. Please retry." }, { status: 502 });
  }
}
