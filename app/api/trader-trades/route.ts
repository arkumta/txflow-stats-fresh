
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.trim().toLowerCase();

  if (!wallet || !/^0x[a-f0-9]{40}$/i.test(wallet)) {
    return Response.json(
      { success: false, error: "A valid wallet address is required." },
      { status: 400 }
    );
  }

  const requestedLimit = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 50;

  const { data, error } = await supabaseAdmin
    .from("trader_fills")
    .select("coin, price, size, side, trade_time, trade_id, closed_pnl, fee")
    .eq("wallet", wallet)
    .order("trade_time", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Trader trades API error:", error.message);

    return Response.json(
      { success: false, error: "Unable to load trading history." },
      { status: 500 }
    );
  }

  const trades = (data ?? []).map((trade) => ({
    ...trade,
    trade_time: Number(trade.trade_time),
    price: Number(trade.price),
    size: Number(trade.size),
    closed_pnl: trade.closed_pnl == null ? null : Number(trade.closed_pnl),
    fee: trade.fee == null ? null : Number(trade.fee),
  }));

  return Response.json({
    success: true,
    wallet,
    count: trades.length,
    trades,
  });
}
