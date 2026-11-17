import { supabaseAdmin } from "../../lib/supabaseAdmin";

const TXFLOW_INFO_URL = "https://rpc.txflow-testnet.xyz/info";

async function getPositions(wallet: string) {
  const response = await fetch(TXFLOW_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-version": "2026-08-16" },
    body: JSON.stringify({ type: "clearinghouseState", user: wallet, accountType: "perp" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return [];
  const result = await response.json();
  if (result.success !== true || !result.data) return [];
  return (result.data.assetPositions ?? [])
    .map((item: any) => item.position ?? item)
    .filter((p: any) => Number(p.szi) !== 0)
    .map((p: any) => ({
      wallet,
      coin: String(p.coin ?? p.asset ?? "Unknown"),
      size: Number(p.szi) || 0,
      direction: Number(p.szi) > 0 ? "Long" : "Short",
      entryPrice: Number(p.entryPx) || 0,
      markPrice: Number(p.markPx) || 0,
      positionValue: Number(p.positionValue) || 0,
      unrealizedPnl: Number(p.unrealizedPnl) || 0,
    }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coin = (searchParams.get("coin") ?? "").trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("trader_wallet_index")
    .select("wallet")
    .limit(20);

  if (error) {
    console.error("Position discovery wallet query failed:", error.message);
    return Response.json({ success: false, error: "Unable to load indexed wallets." }, { status: 500 });
  }

  const wallets = [...new Set((data ?? []).map((row: any) => String(row.wallet).toLowerCase()))]
    .filter((wallet) => /^0x[a-f0-9]{40}$/.test(wallet));

  const results: any[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < wallets.length) {
      const index = cursor++;
      try {
        const positions = await getPositions(wallets[index]);
        results.push(...positions.filter((p: any) => !coin || p.coin.toLowerCase().includes(coin)));
      } catch {
        // Skip wallets whose position endpoint times out; continue the bounded scan.
      }
    }
  }

  await Promise.all([worker(), worker()]);
  results.sort((a, b) => Math.abs(b.positionValue) - Math.abs(a.positionValue));

  return Response.json({
    success: true,
    coin: coin || null,
    walletsScanned: wallets.length,
    scanLimit: 20,
    positions: results,
    note: "Discovery scans up to 20 wallets already present in the trader index. It is not a complete market-wide wallet scan.",
  }, { headers: { "Cache-Control": "no-store" } });
}
