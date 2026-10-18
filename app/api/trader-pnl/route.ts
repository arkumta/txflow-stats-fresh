
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const wallet = searchParams.get("wallet");
    const hours = Number(searchParams.get("hours") || 24);

    if (!wallet) {
      return Response.json(
        { error: "Please provide a wallet address." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(hours) || hours <= 0 || hours > 8760) {
      return Response.json(
        { error: "Hours must be between 1 and 8760." },
        { status: 400 }
      );
    }

    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - hours * 60 * 60 * 1000;

    const apiUrl = "https://testnet-api.txflow-testnet.xyz/info";
    const pageSize = 2000;
    const maxPages = 25;
    let pagesFetched = 0;
    let offset = 0;
    let hasMore = true;
    let fillsCount = 0;
    let realizedPnl = 0;
    let totalFees = 0;

    while (hasMore) {
        if (pagesFetched >= maxPages) {
  hasMore = true;
  break;
}
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2026-08-16",
        },
        body: JSON.stringify({
          type: "userFills",
          user: wallet,
          startTimeMs,
          endTimeMs,
          offset,
          limit: pageSize,
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        return Response.json(
          { error: "Could not fetch data from TxFlow." },
          { status: 502 }
        );
      }

      const result = await response.json();

      if (
        result.success !== true ||
        !result.data ||
        !Array.isArray(result.data.data)
      ) {
        return Response.json(
          { error: "Unexpected response from TxFlow." },
          { status: 502 }
        );
      }
if (offset === 0) {
  console.log("TxFlow reported total fills:", result.data.total);
}
const fills = result.data.data;

pagesFetched++;

      for (const fill of fills) {
        const fillTime = Number(fill.time);

        if (fillTime < startTimeMs || fillTime > endTimeMs) {
          continue;
        }

        fillsCount++;
        realizedPnl += Number(fill.closedPnl) || 0;
        totalFees += Number(fill.fee) || 0;
      }

      hasMore = result.data.hasMore === true;
      offset += fills.length;

      if (fills.length === 0) {
        hasMore = false;
      }
    }

    return Response.json({
      wallet,
      hours,
      fillsCount,
      realizedPnl,
      totalFees,
      pagesFetched,
      hasMoreAtEnd: hasMore,
      complete: !hasMore,
      note: "PnL is calculated from the fills returned by TxFlow within the requested time window.",
    });
  } catch (error) {
    console.error("Trader PnL API error:", error);

    return Response.json(
      { error: "Something went wrong while calculating PnL." },
      { status: 500 }
    );
  }
}
