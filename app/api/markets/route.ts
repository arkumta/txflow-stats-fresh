export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const coin = searchParams.get("coin") || "BTC-USDC";

  const response = await fetch(
    "https://rpc.txflow-testnet.xyz/info",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "activeAssetCtx",
        coin,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  return Response.json(data);
}