const TXFLOW_INFO_URL = "https://rpc.txflow-testnet.xyz/info";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = (searchParams.get("wallet") ?? "").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return Response.json({ success: false, error: "A valid wallet address is required." }, { status: 400 });
  }

  try {
    const response = await fetch(TXFLOW_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-version": "2026-08-16" },
      body: JSON.stringify({ type: "clearinghouseState", user: wallet, accountType: "perp" }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return Response.json({ success: false, error: "TxFlow position service is temporarily unavailable." }, { status: 502 });
    }

    const result = await response.json();
    if (result.success !== true || !result.data) {
      return Response.json({ success: false, error: "Unexpected response from TxFlow position service." }, { status: 502 });
    }

    const positions = (result.data.assetPositions ?? [])
      .map((item: any) => item.position ?? item)
      .filter((p: any) => Number(p.szi) !== 0)
      .map((p: any) => ({
        coin: String(p.coin ?? p.asset ?? "Unknown"),
        size: Number(p.szi) || 0,
        direction: Number(p.szi) > 0 ? "Long" : "Short",
        entryPrice: Number(p.entryPx) || 0,
        markPrice: Number(p.markPx) || 0,
        positionValue: Number(p.positionValue) || 0,
        unrealizedPnl: Number(p.unrealizedPnl) || 0,
        liquidationPrice: Number(p.liquidationPx) || 0,
        leverage: p.leverage?.value ?? null,
        marginUsed: Number(p.marginUsed) || 0,
        updateTime: Number(p.updateTime) || null,
      }));

    return Response.json({
      success: true,
      wallet: wallet.toLowerCase(),
      positions,
      marginSummary: result.data.marginSummary ?? null,
      updatedAt: new Date().toISOString(),
      source: "TxFlow testnet clearinghouseState",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trader positions API error:", error);
    return Response.json({ success: false, error: "Unable to retrieve live positions. Please retry." }, { status: 502 });
  }
}
