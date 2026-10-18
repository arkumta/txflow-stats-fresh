import { supabase } from "../../lib/supabase";

export async function GET() {
  const response = await fetch("https://rpc.txflow-testnet.xyz/info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "activeAssetCtx",
      coin: "BTC-USDC",
    }),
    cache: "no-store",
  });

  const market = await response.json();

  if (!response.ok || market.message) {
    return Response.json(
      {
        success: false,
        error: market.message || "Failed to fetch TxFlow data",
      },
      { status: 500 }
    );
  }

  const { error } = await supabase.from("market_snapshots").insert({
    coin: "BTC-USDC",
    price: Number(market.lastPrice),
    volume_24h: Number(market.dayNtlVlm),
    open_interest:
      Number(market.openInterest) * Number(market.lastPrice),
    funding_rate: Number(market.nodeCtx.funding),
    mark_price: Number(market.nodeCtx.markPx),
    oracle_price: Number(market.nodeCtx.oraclePx),
  });

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
    message: "BTC-USDC snapshot saved",
  });
}