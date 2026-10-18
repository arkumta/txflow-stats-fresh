export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const coin = searchParams.get("coin") || "BTC-USDC";
    const interval = searchParams.get("interval") || "1h";

const endTime = Date.now();

const durations: Record<string, number> = {
  "1h": 24 * 60 * 60 * 1000,
  "4h": 7 * 24 * 60 * 60 * 1000,
  "1d": 30 * 24 * 60 * 60 * 1000,
  "1w": 365 * 24 * 60 * 60 * 1000,
};

const duration = durations[interval] || durations["1h"];
const startTime = endTime - duration;

  const response = await fetch(
    "https://testnet-api.txflow-testnet.xyz/info",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2026-08-16",
      },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: {
          coin,
          interval,
          startTime,
          endTime,
        },
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    return Response.json(
      { error: data.message || "Failed to fetch candles" },
      { status: 500 }
    );
  }

  return Response.json(data.data);
}