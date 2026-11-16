
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.trim().toLowerCase();

  if (!wallet || !/^0x[a-f0-9]{40}$/i.test(wallet)) {
    return Response.json(
      { success: false, error: "A valid wallet address is required." },
      { status: 400 }
    );
  }

  try {
    const markets = new Map<string, {
      market: string;
      trade_count: number;
      trading_volume: number;
      realized_pnl: number;
      fees: number;
      winning_trades: number;
      losing_trades: number;
      breakeven_trades: number;
      pnl_recorded_fills: number;
    }>();

    let offset = 0;
    let fetchedRows = 0;
    let hasMore = false;

    while (offset < MAX_ROWS) {
      const end = Math.min(offset + PAGE_SIZE, MAX_ROWS) - 1;

      const { data, error } = await supabaseAdmin
        .from("trader_fills")
        .select("coin, price, size, closed_pnl, fee")
        .eq("wallet", wallet)
        .order("trade_time", { ascending: true })
        .range(offset, end);

      if (error) {
        console.error("Trader market performance error:", error.message);
        return Response.json(
          { success: false, error: "Unable to load market performance." },
          { status: 500 }
        );
      }

      const rows = data ?? [];
      fetchedRows += rows.length;

      for (const trade of rows) {
        const market = String(trade.coin || "Unknown").trim() || "Unknown";
        const price = Number(trade.price) || 0;
        const size = Number(trade.size) || 0;
        const pnl =
          trade.closed_pnl == null ? null : Number(trade.closed_pnl);
        const fee = trade.fee == null ? 0 : Number(trade.fee) || 0;

        const item = markets.get(market) ?? {
          market,
          trade_count: 0,
          trading_volume: 0,
          realized_pnl: 0,
          fees: 0,
          winning_trades: 0,
          losing_trades: 0,
          breakeven_trades: 0,
          pnl_recorded_fills: 0,
        };

        item.trade_count += 1;
        item.trading_volume += Math.abs(price * size);
        item.fees += fee;

        if (pnl !== null && Number.isFinite(pnl)) {
          item.pnl_recorded_fills += 1;
          item.realized_pnl += pnl;

          if (pnl > 0) item.winning_trades += 1;
          else if (pnl < 0) item.losing_trades += 1;
          else item.breakeven_trades += 1;
        }

        markets.set(market, item);
      }

      if (rows.length < PAGE_SIZE) {
        hasMore = false;
        break;
      }

      offset += rows.length;

      if (offset >= MAX_ROWS) {
        hasMore = true;
        break;
      }
    }

    const marketPerformance = Array.from(markets.values())
      .map((market) => {
        const netPnl = market.realized_pnl - market.fees;
        const decidedTrades =
          market.winning_trades + market.losing_trades;

        return {
          ...market,
          net_pnl: netPnl,
          win_rate:
            decidedTrades > 0
              ? (market.winning_trades / decidedTrades) * 100
              : 0,
          fee_to_volume_percent:
            market.trading_volume > 0
              ? (market.fees / market.trading_volume) * 100
              : 0,
        };
      })
      .sort((a, b) => b.net_pnl - a.net_pnl);

    return Response.json({
      success: true,
      wallet,
      total_fills_analyzed: fetchedRows,
      partial_data: hasMore,
      markets: marketPerformance,
    });
  } catch (error) {
    console.error("Trader market performance error:", error);

    return Response.json(
      { success: false, error: "Unable to calculate market performance." },
      { status: 500 }
    );
  }
}
