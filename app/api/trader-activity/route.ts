
import { supabase } from "../../lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.trim().toLowerCase();

  if (!wallet || !/^0x[a-f0-9]{40}$/i.test(wallet)) {
    return Response.json(
      { success: false, error: "A valid wallet address is required." },
      { status: 400 }
    );
  }


const { data, error } = await supabase.rpc("get_trader_daily_activity", {
  target_wallet: wallet,
  period_days: 30,
});

  if (error) {
    console.error("Trader activity API error:", error.message);

return Response.json(
  {
    success: false,
    error: "Unable to load trading activity.",
    details: error.message,
    code: error.code,
  },
  { status: 500 }
);
  }

  return Response.json({
    success: true,
    wallet,
    activity: data ?? [],
  });
}
