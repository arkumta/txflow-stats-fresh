
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type Trader = {
  wallet: string;
  [key: string]: unknown;
};

type PnlRow = {
  wallet: string;
  realized_pnl: number | string | null;
};

type PnlPeriodKey = "pnl24h" | "pnl7d" | "pnl30d";

type TraderPnl = {
  pnl24h: number | null;
  pnl7d: number | null;
  pnl30d: number | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const requestedHours = Number(searchParams.get("hours") ?? 24);
  const requestedLimit = Number(searchParams.get("limit") ?? 100);
  const requestedSort = searchParams.get("sort") ?? "trades";

  const hours = [24, 168, 720].includes(requestedHours)
    ? requestedHours
    : 24;

  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 50;

  const sort = requestedSort === "volume" ? "volume" : "trades";

  const { data, error } = await supabase.rpc(
    "get_trader_leaderboard",
    {
      period_hours: hours,
      result_limit: limit,
      sort_by: sort,
    }
  );

  if (error) {
    console.error("Trader leaderboard API error:", error.message);

    return Response.json(
      {
        success: false,
        error: "Unable to load trader leaderboard.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  const traders = (data ?? []) as Trader[];

  const wallets = traders.map((trader) => trader.wallet);

  const pnlByWallet: Record<string, TraderPnl> = {};

  for (const trader of traders) {
    pnlByWallet[String(trader.wallet).toLowerCase()] = {
      pnl24h: null,
      pnl7d: null,
      pnl30d: null,
    };
  }

  const periods: {
    hours: number;
    key: PnlPeriodKey;
  }[] = [
    { hours: 24, key: "pnl24h" },
    { hours: 168, key: "pnl7d" },
    { hours: 720, key: "pnl30d" },
  ];

  for (const period of periods) {
    if (wallets.length === 0) continue;

    const { data: pnlData, error: pnlError } =
      await supabaseAdmin.rpc("get_traders_realized_pnl", {
        target_wallets: wallets,
        period_hours: period.hours,
      });

    if (pnlError) {
      console.error(
        `Trader PnL lookup error (${period.hours}h):`,
        pnlError.message
      );
      continue;
    }

    const pnlRows = (pnlData ?? []) as PnlRow[];

    for (const row of pnlRows) {
      const key = String(row.wallet).toLowerCase();

      if (pnlByWallet[key]) {
        pnlByWallet[key][period.key] =
          Number(row.realized_pnl) || 0;
      }
    }
  }

  return Response.json({
    success: true,
    period_hours: hours,
    sort,
    count: traders.length,
    traders: traders.map((trader) => ({
      ...trader,
      pnl: pnlByWallet[String(trader.wallet).toLowerCase()] ?? null,
    })),
  });
}
