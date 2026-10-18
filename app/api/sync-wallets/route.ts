
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const requestedLimit = Number(searchParams.get("limit") ?? 500);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 1000)
    : 500;

  const requestedOffset = Number(searchParams.get("offset") ?? 0);
  const offset = Number.isFinite(requestedOffset)
    ? Math.max(Math.floor(requestedOffset), 0)
    : 0;

  const { data, error } = await supabaseAdmin
    .from("trader_wallet_index")
    .select("wallet")
    .order("wallet", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Sync wallet list error:", error.message);

    return Response.json(
      { success: false, error: "Unable to load trader wallets." },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    count: data?.length ?? 0,
    offset,
    limit,
    wallets: (data ?? []).map((row) => row.wallet),
    nextOffset: (data?.length ?? 0) === limit ? offset + limit : null,
  });
}
