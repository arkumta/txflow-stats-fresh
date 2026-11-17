import { supabase } from "../../lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedPeriod = searchParams.get("period") ?? "7D";
  const coin = searchParams.get("coin")?.trim() ?? "";

  const periods: Record<string, number> = {
    "24H": 24,
    "7D": 24 * 7,
    "30D": 24 * 30,
  };

  const hours = periods[requestedPeriod];

  if (!hours) {
    return Response.json(
      { success: false, error: "Invalid period. Use 24H, 7D, or 30D." },
      { status: 400 }
    );
  }

  if (coin.length > 64) {
    return Response.json(
      { success: false, error: "Invalid market symbol." },
      { status: 400 }
    );
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("market_snapshots")
    .select("coin, recorded_at, price, volume_24h, open_interest, funding_rate, mark_price, oracle_price")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(coin ? 2000 : 500);

  if (coin) {
    query = query.eq("coin", coin);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return Response.json(
    {
      success: true,
      period: requestedPeriod,
      coin: coin || null,
      data: (data ?? []).reverse(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
