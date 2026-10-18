
import { supabase } from "../../lib/supabase";

export async function GET() {
  const since = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  // Count trades from the last 24 hours
  const { count, error } = await supabase
    .from("trades")
    .select("*", { count: "exact", head: true })
    .gte("trade_time", since);

  if (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  // Count unique active traders directly in Supabase
  const {
    data: activeTraders,
    error: activeTradersError,
  } = await supabase.rpc("get_active_traders_24h");

  if (activeTradersError) {
    return Response.json(
      {
        success: false,
        error: activeTradersError.message,
      },
      { status: 500 }
    );
  }

  // Return the statistics
  return Response.json({
    success: true,
    trades_24h: count ?? 0,
    active_traders_24h: Number(activeTraders) || 0,
  });
}
