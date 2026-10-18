
import { supabase } from "../../lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const trades = Array.isArray(body) ? body : body.trades;

    if (!Array.isArray(trades) || trades.length === 0) {
      return Response.json(
        { success: false, error: "Expected a non-empty trades array" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      "save_trades_batch",
      { p_trades: trades }
    );

    if (error) {
      console.error("Batch trade save error:", error.message);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return Response.json(data);
  } catch (error) {
    console.error("Invalid trade request:", error);
    return Response.json(
      { success: false, error: "Invalid trade request" },
      { status: 400 }
    );
  }
}
