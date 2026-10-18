
import { supabase } from "../../lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedPeriod = searchParams.get("period") ?? "7D";

  const periods: Record<string, number> = {
    "24H": 24,
    "7D": 24 * 7,
    "30D": 24 * 30,
  };

  const hours = periods[requestedPeriod];

  if (!hours) {
    return Response.json(
      {
        success: false,
        error: "Invalid period. Use 24H, 7D, or 30D.",
      },
      { status: 400 }
    );
  }

  const since = new Date(
    Date.now() - hours * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("market_snapshots")
    .select(
      "recorded_at, volume_24h, open_interest, funding_rate"
    )
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(500);

  if (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    period: requestedPeriod,
    data: (data ?? []).reverse(),
  });
}
