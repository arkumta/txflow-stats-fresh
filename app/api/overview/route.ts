import { supabase } from "../../lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("market_snapshots")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1);

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
    data,
  });
}