
import { supabaseAdmin } from "../../lib/supabaseAdmin";


export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "get_txflow_pnl_summary"
    );

    if (error) {
      console.error("PnL summary query failed:", error);

      return Response.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    const periods = Object.fromEntries(
      (data ?? []).map((row: any) => [
        row.period,
        {
          grossRealizedPnl: Number(row.gross_realized_pnl ?? 0),
          fees: Number(row.fees ?? 0),
          netRealizedPnl: Number(row.net_realized_pnl ?? 0),
          fillCount: Number(row.fill_count ?? 0),
          fillsWithFee: Number(row.fills_with_fee ?? 0),
        },
      ])
    );

    return Response.json({
      success: true,
      periods,
    });
  } catch (error) {
    console.error("PnL API error:", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error loading PnL.",
      },
      { status: 500 }
    );
  }
}
