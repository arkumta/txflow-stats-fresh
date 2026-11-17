import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "24H").toUpperCase();
    const limit = Number(searchParams.get("limit") || 100);

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

    const pnlRows = data ?? [];
    const volumeByWallet: Record<string, number> = {};

    // The existing activity RPC supplies trading volume for rolling periods.
    // Historical PnL starts on Oct 10 and has no matching volume period.
    if (period === "24H" || period === "7D") {
      const periodHours = period === "24H" ? 24 : 168;
      const { data: volumeRows, error: volumeError } =
        await supabaseAdmin.rpc("get_trader_leaderboard", {
          period_hours: periodHours,
          result_limit: 100,
          sort_by: "volume",
        });

      if (volumeError) {
        console.error("Trader volume lookup failed:", volumeError.message);
      } else {
        for (const row of volumeRows ?? []) {
          const wallet = String(row.wallet ?? "").toLowerCase();
          const volume = Number(row.trading_volume);
          if (wallet && Number.isFinite(volume)) {
            volumeByWallet[wallet] = volume;
          }
        }
      }
    }

    const traders = pnlRows.map((row: any) => {
      const tradeCount = Number(row.trade_count ?? 0);
      const netRealizedPnl = Number(row.net_realized_pnl ?? 0);
      const wallet = String(row.wallet ?? "");

      return {
        wallet,
        grossRealizedPnl: Number(row.gross_realized_pnl ?? 0),
        fees: Number(row.fees ?? 0),
        netRealizedPnl,
        tradeCount,
        fillsWithFee: Number(row.fills_with_fee ?? 0),
        lastActive: row.last_active,
        tradingVolume: volumeByWallet[wallet.toLowerCase()] ?? null,
        averageNetPnlPerFill:
          tradeCount > 0 ? netRealizedPnl / tradeCount : null,
      };
    });

    return Response.json({
      success: true,
      period,
      traders,
      volumeAvailable: period !== "SINCE_OCT_10",
      note:
        "Rankings use stored fills only. Results may be incomplete if historical data has not been fully ingested. Trading volume is available for 24H and 7D periods only.",
    });
  } catch (error) {
    console.error("PnL leaderboard API error:", error);

    return Response.json(
      { success: false, error: "Could not load the PnL leaderboard." },
      { status: 500 }
    );
  }
}
