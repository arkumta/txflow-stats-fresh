
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SESSION_DEFINITIONS = [
  { name: "Asian", start_hour: 0, end_hour: 8 },
  { name: "European", start_hour: 7, end_hour: 16 },
  { name: "US", start_hour: 13, end_hour: 22 },
];

type ValidFill = {
  timestamp: number;
  day: string;
  volume: number;
  size: number;
  closedPnl: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function median(values: number[]): number {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function longestStreak(values: ValidFill[], outcome: "win" | "loss") {
  let current = 0;
  let longest = 0;

  for (const fill of values) {
    const matches =
      fill.closedPnl !== null &&
      (outcome === "win" ? fill.closedPnl > 0 : fill.closedPnl < 0);

    current = matches ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  return longest;
}

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
    let offset = 0;
    let totalFills = 0;
    let hasMore = false;

    let totalSize = 0;
    let totalVolume = 0;
    let largestSize = 0;
    let largestTradeVolume = 0;
    let validTimeFills = 0;

    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      trade_count: 0,
      trading_volume: 0,
    }));

    const weekdays = WEEKDAYS.map((day) => ({
      day,
      trade_count: 0,
      trading_volume: 0,
    }));

    const markets = new Map<
      string,
      { market: string; trade_count: number; trading_volume: number }
    >();

    const sides = new Map<string, number>();

    const sessions = SESSION_DEFINITIONS.map((definition) => ({
      session: definition.name,
      start_hour_utc: definition.start_hour,
      end_hour_utc: definition.end_hour,
      trade_count: 0,
      trading_volume: 0,
      gross_realized_pnl: 0,
      realized_pnl_fill_count: 0,
      fees: 0,
      fee_fill_count: 0,
    }));

    const validFills: ValidFill[] = [];
    const dailyCounts = new Map<string, number>();

    while (offset < MAX_ROWS) {
      const end = Math.min(offset + PAGE_SIZE, MAX_ROWS) - 1;

      const { data, error } = await supabaseAdmin
        .from("trader_fills")
        .select("coin, price, size, side, trade_time, closed_pnl, fee")
        .eq("wallet", wallet)
        .order("trade_time", { ascending: true })
        .range(offset, end);

      if (error) {
        console.error("Trader behavior API error:", error.message);

        return Response.json(
          { success: false, error: "Unable to load trading behavior." },
          { status: 500 }
        );
      }

      const rows = data ?? [];
      totalFills += rows.length;

      for (const trade of rows) {
        const coin = String(trade.coin || "Unknown").trim() || "Unknown";
        const price = toFiniteNumber(trade.price) ?? 0;
        const rawSize = toFiniteNumber(trade.size) ?? 0;
        const size = Math.abs(rawSize);
        const volume = Math.abs(price * size);

        totalSize += size;
        totalVolume += volume;
        largestSize = Math.max(largestSize, size);
        largestTradeVolume = Math.max(largestTradeVolume, volume);

        const market = markets.get(coin) ?? {
          market: coin,
          trade_count: 0,
          trading_volume: 0,
        };

        market.trade_count += 1;
        market.trading_volume += volume;
        markets.set(coin, market);

        const side = String(trade.side ?? "Unknown").trim() || "Unknown";
        sides.set(side, (sides.get(side) ?? 0) + 1);

        const rawTime = Number(trade.trade_time);

        if (!Number.isFinite(rawTime) || rawTime <= 0) continue;

        // Txflow timestamps may be in seconds or milliseconds.
        const timestamp =
          rawTime < 1_000_000_000_000 ? rawTime * 1000 : rawTime;

        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) continue;

        validTimeFills += 1;

        const hour = date.getUTCHours();
        const weekday = date.getUTCDay();
        const day = date.toISOString().slice(0, 10);
        const closedPnl = toFiniteNumber(trade.closed_pnl);
        const fee = toFiniteNumber(trade.fee);

        hours[hour].trade_count += 1;
        hours[hour].trading_volume += volume;

        weekdays[weekday].trade_count += 1;
        weekdays[weekday].trading_volume += volume;

        dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);

        validFills.push({
          timestamp,
          day,
          volume,
          size,
          closedPnl,
        });

        // Session windows intentionally overlap.
        for (const session of sessions) {
          if (hour >= session.start_hour_utc && hour < session.end_hour_utc) {
            session.trade_count += 1;
            session.trading_volume += volume;

            if (closedPnl !== null) {
              session.gross_realized_pnl += closedPnl;
              session.realized_pnl_fill_count += 1;
            }

            if (fee !== null) {
              session.fees += Math.abs(fee);
              session.fee_fill_count += 1;
            }
          }
        }
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

    const marketBreakdown = Array.from(markets.values()).sort(
      (a, b) => b.trading_volume - a.trading_volume
    );

    const sideBreakdown = Array.from(sides.entries())
      .map(([side, trade_count]) => ({ side, trade_count }))
      .sort((a, b) => b.trade_count - a.trade_count);

    const busiestHour = [...hours].sort(
      (a, b) => b.trade_count - a.trade_count
    )[0];

    const busiestDay = [...weekdays].sort(
      (a, b) => b.trade_count - a.trade_count
    )[0];

    const busiestSession = [...sessions].sort(
      (a, b) => b.trade_count - a.trade_count
    )[0];

    // Calculate gaps between consecutive valid fills.
    const gaps: number[] = [];
    let longestGap = 0;

    for (let i = 1; i < validFills.length; i++) {
      const gap =
        (validFills[i].timestamp - validFills[i - 1].timestamp) / 60000;

      if (gap >= 0) {
        gaps.push(gap);
        longestGap = Math.max(longestGap, gap);
      }
    }

    const dailyValues = Array.from(dailyCounts.values());
    const activeDays = dailyValues.length;
    const averageDailyFills = average(dailyValues);

    const dailyVariance = average(
      dailyValues.map((count) => (count - averageDailyFills) ** 2)
    );

    const dailyStdDev = Math.sqrt(dailyVariance);
    const dailyCoefficientVariation =
      averageDailyFills > 0 ? dailyStdDev / averageDailyFills : 0;

    // Compare the next fill after a realized winning/losing fill.
    // This is a descriptive association, not proof of emotional behavior.
    const afterWins: { next_volume: number; minutes_to_next: number }[] = [];
    const afterLosses: { next_volume: number; minutes_to_next: number }[] = [];

    for (let i = 0; i < validFills.length - 1; i++) {
      const current = validFills[i];
      const next = validFills[i + 1];

      if (current.closedPnl === null) continue;

      const minutesToNext =
        (next.timestamp - current.timestamp) / 60000;

      if (minutesToNext < 0) continue;

      const observation = {
        next_volume: next.volume,
        minutes_to_next: minutesToNext,
      };

      if (current.closedPnl > 0) afterWins.push(observation);
      if (current.closedPnl < 0) afterLosses.push(observation);
    }

    const averageNextVolumeAfterWin = average(
      afterWins.map((item) => item.next_volume)
    );

    const averageNextVolumeAfterLoss = average(
      afterLosses.map((item) => item.next_volume)
    );

    const averageGapAfterWin = average(
      afterWins.map((item) => item.minutes_to_next)
    );

    const averageGapAfterLoss = average(
      afterLosses.map((item) => item.minutes_to_next)
    );

    const volumeChangeAfterLossPercent =
      averageNextVolumeAfterWin > 0
        ? ((averageNextVolumeAfterLoss -
            averageNextVolumeAfterWin) /
            averageNextVolumeAfterWin) *
          100
        : null;

    const disciplineAnalysis = {
      active_days: activeDays,
      average_fills_per_active_day: averageDailyFills,
      daily_fill_standard_deviation: dailyStdDev,
      daily_fill_coefficient_variation: dailyCoefficientVariation,
      daily_frequency_description:
        dailyCoefficientVariation < 0.5
          ? "Relatively consistent"
          : dailyCoefficientVariation < 1
            ? "Moderately variable"
            : "Highly variable",
      average_time_between_fills_minutes: average(gaps),
      median_time_between_fills_minutes: median(gaps),
      longest_inactivity_minutes: longestGap,
      longest_inactivity_hours: longestGap / 60,
      longest_winning_streak: longestStreak(validFills, "win"),
      longest_losing_streak: longestStreak(validFills, "loss"),
      post_outcome_analysis: {
        next_fill_after_win_count: afterWins.length,
        next_fill_after_loss_count: afterLosses.length,
        average_next_fill_volume_after_win: averageNextVolumeAfterWin,
        average_next_fill_volume_after_loss: averageNextVolumeAfterLoss,
        next_fill_volume_change_after_loss_percent:
          volumeChangeAfterLossPercent,
        average_minutes_to_next_fill_after_win: averageGapAfterWin,
        average_minutes_to_next_fill_after_loss: averageGapAfterLoss,
      },
    };

    return Response.json({
      success: true,
      wallet,
      total_fills_analyzed: totalFills,
      partial_data: hasMore,
      valid_time_fills: validTimeFills,
      summary: {
        total_volume: totalVolume,
        total_size: totalSize,
        average_size: totalFills > 0 ? totalSize / totalFills : 0,
        average_trade_volume: totalFills > 0 ? totalVolume / totalFills : 0,
        largest_size: largestSize,
        largest_trade_volume: largestTradeVolume,
        busiest_hour: busiestHour,
        busiest_day: busiestDay,
      },
      hourly_activity: hours,
      weekday_activity: weekdays,
      market_breakdown: marketBreakdown,
      side_breakdown: sideBreakdown,
      session_analysis: {
        timezone: "UTC",
        windows_overlap: true,
        busiest_session: busiestSession?.session ?? null,
        sessions,
      },
      discipline_analysis: disciplineAnalysis,
    });
  } catch (error) {
    console.error("Trader behavior API error:", error);

    return Response.json(
      { success: false, error: "Unable to calculate trading behavior." },
      { status: 500 }
    );
  }
}
