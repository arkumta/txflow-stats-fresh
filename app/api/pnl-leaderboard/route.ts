
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "24H").toUpperCase();
    const limit = Number(searchParams.get("limit") || 10);

    if (!["24H", "7D", "SINCE_OCT_10"].includes(period)) {
      return Response.json(
        { success: false, error: "Invalid PnL period." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return Response.json(
        { success: false, error: "Limit must be between 1 and 100." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "get_txflow_pnl_leaderboard",
      {
        p_period: period,
        p_limit: limit,
      }
    );

    if (error) {
      console.error("PnL leaderboard query failed:", error);

      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const traders = (data ?? []).map((row: any) => ({
      wallet: row.wallet,
      grossRealizedPnl: Number(row.gross_realized_pnl ?? 0),
      fees: Number(row.fees ?? 0),
      netRealizedPnl: Number(row.net_realized_pnl ?? 0),
      tradeCount: Number(row.trade_count ?? 0),
      fillsWithFee: Number(row.fills_with_fee ?? 0),
      lastActive: row.last_active,
    }));

    return Response.json({
      success: true,
      period,
      traders,
      note:
        "Rankings use stored fills only. Results may be incomplete if historical data has not been fully ingested.",
    });
  } catch (error) {
    console.error("PnL leaderboard API error:", error);

    return Response.json(
      { success: false, error: "Could not load the PnL leaderboard." },
      { status: 500 }
    );
  }
}
