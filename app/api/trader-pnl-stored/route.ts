
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const wallet = searchParams.get("wallet");
    const hours = Number(searchParams.get("hours") || 24);

    if (!wallet) {
      return Response.json(
        { error: "Please provide a wallet address." },
        { status: 400 }
      );
    }

    if (![24, 168, 720].includes(hours)) {
      return Response.json(
        { error: "Hours must be 24, 168, or 720." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "get_trader_realized_pnl",
      {
        target_wallet: wallet,
        period_hours: hours,
      }
    );

    if (error) {
      console.error("Stored trader PnL error:", error.message);

      return Response.json(
        { error: "Unable to calculate stored PnL." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      wallet,
      hours,
      pnl: data?.[0] ?? {
        wallet,
        fills_count: 0,
        realized_pnl: 0,
        total_fees: 0,
      },
    });
  } catch (error) {
    console.error("Stored trader PnL API error:", error);

    return Response.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
