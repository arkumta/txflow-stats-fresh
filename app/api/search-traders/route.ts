
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();

  if (!/^0x[a-f0-9]{4,40}$/.test(query)) {
    return Response.json({ success: true, traders: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("trader_wallet_index")
    .select("wallet")
    .ilike("wallet", `${query}%`)
    .limit(20);

  if (error) {
    console.error("Trader search error:", error.message);

    return Response.json(
      {
        success: false,
        error: "Unable to search traders.",
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    traders: (data ?? []).map((row) => row.wallet),
  });
}
