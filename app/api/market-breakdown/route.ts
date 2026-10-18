
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const wallet = searchParams.get("wallet");
    const daysParam = Number(searchParams.get("days") ?? "30");

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        { success: false, error: "A valid wallet address is required." },
        { status: 400 }
      );
    }

    const days = Number.isFinite(daysParam)
      ? Math.min(Math.max(Math.floor(daysParam), 1), 365)
      : 30;

    const { data, error } = await supabase.rpc(
      "get_trader_market_breakdown",
      {
        target_wallet: wallet,
        period_days: days,
      }
    );

    if (error) {
      console.error("Market breakdown error:", error.message);

      return NextResponse.json(
        { success: false, error: "Failed to fetch market breakdown." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      wallet,
      period_days: days,
      count: data?.length ?? 0,
      markets: data ?? [],
    });
  } catch (error) {
    console.error("Market breakdown API error:", error);

    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
