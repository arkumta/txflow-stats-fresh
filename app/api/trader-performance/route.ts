
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const wallet = searchParams.get("wallet")?.trim().toLowerCase();
    const requestedDays = Number(searchParams.get("days") || 365);

    if (!wallet || !/^0x[a-f0-9]{40}$/i.test(wallet)) {
      return Response.json(
        { success: false, error: "A valid wallet address is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(requestedDays) ||
      requestedDays < 1 ||
      requestedDays > 365
    ) {
      return Response.json(
        { success: false, error: "Days must be between 1 and 365." },
        { status: 400 }
      );
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - requestedDays);

    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from("trader_daily_stats")
      .select("trade_date, fill_count, closed_pnl_total, trading_volume")
      .eq("wallet", wallet)
      .gte("trade_date", cutoffDate)
      .order("trade_date", { ascending: true });

    if (error) {
      console.error("Trader performance API error:", error.message);

      return Response.json(
        { success: false, error: "Unable to load trader performance." },
        { status: 500 }
      );
    }

    const dailyPerformance = (data || []).map((row) => ({
      trade_date: row.trade_date,
      trade_count: Number(row.fill_count || 0),
      realized_pnl: Number(row.closed_pnl_total || 0),
      trading_volume: Number(row.trading_volume || 0),
    }));

    const winningDays = dailyPerformance.filter(
      (day) => day.realized_pnl > 0
    );

    const losingDays = dailyPerformance.filter(
      (day) => day.realized_pnl < 0
    );

    const breakevenDays = dailyPerformance.filter(
      (day) => day.realized_pnl === 0
    );

    const totalPnl = dailyPerformance.reduce(
      (total, day) => total + day.realized_pnl,
      0
    );

    const rankedDays = [...dailyPerformance].sort(
      (a, b) => a.realized_pnl - b.realized_pnl
    );

    const activePnlDays = winningDays.length + losingDays.length;

    return Response.json({
      success: true,
      wallet,
      days: requestedDays,
      summary: {
        total_pnl: totalPnl,
        winning_days: winningDays.length,
        losing_days: losingDays.length,
        breakeven_days: breakevenDays.length,
        win_rate:
          activePnlDays > 0
            ? (winningDays.length / activePnlDays) * 100
            : 0,
        average_daily_pnl:
          dailyPerformance.length > 0
            ? totalPnl / dailyPerformance.length
            : 0,
        best_day: rankedDays.length
          ? rankedDays[rankedDays.length - 1]
          : null,
        worst_day: rankedDays.length ? rankedDays[0] : null,
        total_active_days: dailyPerformance.length,
      },
      daily_performance: dailyPerformance,
    });
  } catch (error) {
    console.error("Trader performance API error:", error);

    return Response.json(
      { success: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}
