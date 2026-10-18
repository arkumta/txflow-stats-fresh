import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const wallet = String(body.wallet || "").trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return Response.json(
        { error: "Please provide a valid wallet address." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);

    const rawHours = body.hours ?? searchParams.get("hours") ?? 24;
    const requestedHours = Number(rawHours);

    if (![24, 168, 720].includes(requestedHours)) {
      return Response.json(
        { error: "Hours must be 24, 168, or 720." },
        { status: 400 }
      );
    }

    const hasStartTime =
      body.startTimeMs !== undefined &&
      body.startTimeMs !== null &&
      body.startTimeMs !== "";

    const hasEndTime =
      body.endTimeMs !== undefined &&
      body.endTimeMs !== null &&
      body.endTimeMs !== "";

    const requestedStartTime = hasStartTime
      ? Number(body.startTimeMs)
      : null;

    const requestedEndTime = hasEndTime
      ? Number(body.endTimeMs)
      : null;

    if (
      (hasStartTime &&
        (!Number.isFinite(requestedStartTime) ||
          !Number.isSafeInteger(requestedStartTime))) ||
      (hasEndTime &&
        (!Number.isFinite(requestedEndTime) ||
          !Number.isSafeInteger(requestedEndTime)))
    ) {
      return Response.json(
        { error: "startTimeMs and endTimeMs must be valid millisecond timestamps." },
        { status: 400 }
      );
    }

    const endTimeMs = hasEndTime
      ? requestedEndTime!
      : Date.now();

    const startTimeMs = hasStartTime
      ? requestedStartTime!
      : endTimeMs - requestedHours * 60 * 60 * 1000;

    if (endTimeMs <= startTimeMs) {
      return Response.json(
        { error: "endTimeMs must be greater than startTimeMs." },
        { status: 400 }
      );
    }

const apiUrl = "https://testnet-api.txflow-testnet.xyz/info";
const pageSize = 2000;

// Default production behavior remains 25 pages per request.
// Tests may request fewer pages using maxPages in the request body.
const requestedMaxPages = Number(body.maxPages ?? 25);

if (
  !Number.isInteger(requestedMaxPages) ||
  requestedMaxPages < 1 ||
  requestedMaxPages > 25
) {
  return Response.json(
    { error: "maxPages must be an integer between 1 and 25." },
    { status: 400 }
  );
}

const maxPages = requestedMaxPages;

    let offset = Math.max(0, Math.floor(Number(body.offset) || 0));

    if (offset > 200000) {
      return Response.json(
        { error: "Offset cannot exceed 200000." },
        { status: 400 }
      );
    }

    let pagesFetched = 0;
    let hasMore = true;
    let fillsSaved = 0;

    while (hasMore && pagesFetched < maxPages) {
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
        console.error(
          "TxFlow API request failed:",
          response.status,
          await response.text()
        );

        return Response.json(
          { error: "Could not fetch fills from TxFlow." },
          { status: 502 }
        );
      }

      const result = await response.json();

      if (
        result.success !== true ||
        !result.data ||
        !Array.isArray(result.data.data)
      ) {
        console.error("Unexpected TxFlow response:", result);

        return Response.json(
          { error: "Unexpected response from TxFlow." },
          { status: 502 }
        );
      }

      const fills = result.data.data;

      if (fills.length === 0) {
        hasMore = false;
        break;
      }

      const rows = fills.map((fill: any) => ({
        wallet: wallet.toLowerCase(),
        trade_id: String(fill.tid),
        coin: fill.coin ?? null,
        price: Number(fill.px) || 0,
        size: Number(fill.sz) || 0,
        side: fill.side ?? null,
        closed_pnl: Number(fill.closedPnl) || 0,
        fee: fill.fee == null ? null : Number(fill.fee),
        trade_time: Number(fill.time),
      }));

      const { error } = await supabaseAdmin
        .from("trader_fills")
        .upsert(rows, {
          onConflict: "wallet,trade_id",
          ignoreDuplicates: true,
        });

      if (error) {
        console.error("Saving trader fills failed:", error);

        return Response.json(
          {
            error: "Could not save fills to the database.",
            details: error.message,
            code: error.code,
          },
          { status: 500 }
        );
      }

      fillsSaved += rows.length;
      pagesFetched++;
      offset += fills.length;
      hasMore = result.data.hasMore === true;
    }

    return Response.json({
      success: true,
      wallet,
      hoursRequested: requestedHours,
      startTimeMs,
      endTimeMs,
      startTime: new Date(startTimeMs).toISOString(),
      endTime: new Date(endTimeMs).toISOString(),
      pagesFetched,
      fillsSaved,
      offset,
      nextOffset: hasMore ? offset : null,
      complete: !hasMore,
      note: hasStartTime || hasEndTime
        ? "Sync used the explicitly supplied time range."
        : `Sync used the last ${requestedHours} hours.`,
    });
  } catch (error) {
    console.error("Trader fills sync error:", error);

    return Response.json(
      { error: "Something went wrong while syncing trader fills." },
      { status: 500 }
    );
  }
}