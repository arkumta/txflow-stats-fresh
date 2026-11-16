
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const MAX_WALLETS_PER_RUN = 5;
const MAX_PAGES_PER_WALLET = 1;
const INITIAL_LOOKBACK_HOURS = 24;
const OVERLAP_MS = 5 * 60 * 1000;
const DB_PAGE_SIZE = 500;

type WalletRow = {
  wallet: string;
};

type SyncState = {
  wallet: string;
  last_synced_at: string | null;
  window_start_ms: number | null;
  window_end_ms: number | null;
  next_offset: number;
  updated_at: string;
};

async function fetchAllWallets(): Promise<WalletRow[]> {
  const rows: WalletRow[] = [];

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("trader_wallet_index")
      .select("wallet")
      .order("wallet", { ascending: true })
      .range(from, from + DB_PAGE_SIZE - 1);

    if (error) throw error;

    rows.push(...(data ?? []));

    if (!data || data.length < DB_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllSyncStates(): Promise<SyncState[]> {
  const rows: SyncState[] = [];

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("trader_sync_state")
      .select(
        "wallet,last_synced_at,window_start_ms,window_end_ms,next_offset,updated_at"
      )
      .order("updated_at", { ascending: true })
      .range(from, from + DB_PAGE_SIZE - 1);

    if (error) throw error;

    rows.push(...((data ?? []) as SyncState[]));

    if (!data || data.length < DB_PAGE_SIZE) break;
  }

  return rows;
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || MAX_WALLETS_PER_RUN);

    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > MAX_WALLETS_PER_RUN
    ) {
      return Response.json(
        { success: false, error: `Limit must be between 1 and ${MAX_WALLETS_PER_RUN}` },
        { status: 400 }
      );
    }

    const [walletRows, stateRows] = await Promise.all([
      fetchAllWallets(),
      fetchAllSyncStates(),
    ]);

    const stateMap = new Map(stateRows.map((row) => [row.wallet, row]));

    const pending = stateRows.filter(
      (row) =>
        row.window_start_ms !== null &&
        row.window_end_ms !== null
    );

    const neverSynced = walletRows
      .filter((row) => !stateMap.has(row.wallet))
      .map((row) => row.wallet);

    const alreadySynced = stateRows
      .filter(
        (row) =>
          row.window_start_ms === null ||
          row.window_end_ms === null
      )
      .sort((a, b) => {
        const aTime = a.last_synced_at
          ? new Date(a.last_synced_at).getTime()
          : 0;
        const bTime = b.last_synced_at
          ? new Date(b.last_synced_at).getTime()
          : 0;

        return aTime - bTime;
      });

    const selectedWallets: string[] = [];
    const addWallet = (wallet: string) => {
      if (
        selectedWallets.length < requestedLimit &&
        !selectedWallets.includes(wallet)
      ) {
        selectedWallets.push(wallet);
      }
    };

    // Finish interrupted pagination windows first.
    for (const row of pending) addWallet(row.wallet);

    // Then process wallets that have never been synced.
    for (const wallet of neverSynced) addWallet(wallet);

    // Finally revisit previously synced wallets, oldest first.
    for (const row of alreadySynced) addWallet(row.wallet);

    const results = [];

    for (const wallet of selectedWallets) {
      let startTimeMs: number | null = null;
      let endTimeMs: number | null = null;
      let offset = 0;

      try {
        const existing = stateMap.get(wallet);

        if (
          existing?.window_start_ms !== null &&
          existing?.window_start_ms !== undefined &&
          existing?.window_end_ms !== null &&
          existing?.window_end_ms !== undefined
        ) {
          startTimeMs = Number(existing.window_start_ms);
          endTimeMs = Number(existing.window_end_ms);
          offset = Number(existing.next_offset || 0);
        } else {
          endTimeMs = Date.now();

          const { data: latestFill, error: latestFillError } =
            await supabaseAdmin
              .from("trader_fills")
              .select("trade_time")
              .eq("wallet", wallet)
              .order("trade_time", { ascending: false })
              .limit(1)
              .maybeSingle();

          if (latestFillError) throw latestFillError;

          if (latestFill?.trade_time) {
            startTimeMs =
              new Date(latestFill.trade_time).getTime() - OVERLAP_MS;
          } else {
            startTimeMs =
              endTimeMs - INITIAL_LOOKBACK_HOURS * 60 * 60 * 1000;
          }
        }

        if (
          startTimeMs === null ||
          endTimeMs === null ||
          !Number.isFinite(startTimeMs) ||
          !Number.isFinite(endTimeMs) ||
          startTimeMs >= endTimeMs
        ) {
          throw new Error("Invalid sync time window");
        }

        // Save the checkpoint before fetching, so interrupted runs can resume.
        const { error: checkpointError } = await supabaseAdmin
          .from("trader_sync_state")
          .upsert(
            {
              wallet,
              window_start_ms: startTimeMs,
              window_end_ms: endTimeMs,
              next_offset: offset,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "wallet" }
          );

        if (checkpointError) throw checkpointError;

        const syncUrl = new URL(
          "/api/sync-trader-fills",
          request.url
        );

        const syncResponse = await fetch(syncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet,
            hours: 720,
            startTimeMs,
            endTimeMs,
            offset,
            maxPages: MAX_PAGES_PER_WALLET,
          }),
          cache: "no-store",
        });

        const syncData = await syncResponse.json();

        if (!syncResponse.ok || syncData.success === false) {
          throw new Error(
            syncData.error || `Fill sync failed: ${syncResponse.status}`
          );
        }

        const complete = Boolean(syncData.complete);
        const nextOffset = Number(syncData.nextOffset ?? 0);

        if (!complete && (!Number.isInteger(nextOffset) || nextOffset < 0)) {
          throw new Error("Sync returned an invalid next offset");
        }

        if (complete) {
          const { error } = await supabaseAdmin
            .from("trader_sync_state")
            .upsert(
              {
                wallet,
                last_synced_at: new Date(endTimeMs).toISOString(),
                window_start_ms: null,
                window_end_ms: null,
                next_offset: 0,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "wallet" }
            );

          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from("trader_sync_state")
            .upsert(
              {
                wallet,
                window_start_ms: startTimeMs,
                window_end_ms: endTimeMs,
                next_offset: nextOffset,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "wallet" }
            );

          if (error) throw error;
        }

        results.push({
          wallet,
          success: true,
          complete,
          fillsReported: Number(
            syncData.fillsSaved ?? syncData.fillsReported ?? 0
          ),
          nextOffset: complete ? null : nextOffset,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown sync error";

        // Keep the existing window and offset so the next run can retry.
        await supabaseAdmin.from("trader_sync_state").upsert(
          {
            wallet,
            window_start_ms: startTimeMs,
            window_end_ms: endTimeMs,
            next_offset: offset,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "wallet" }
        );

        results.push({
          wallet,
          success: false,
          error: message,
        });
      }
    }

    const successfulWallets = results.filter((row) => row.success).length;

    return Response.json({
      success: true,
      totalTrackedWallets: walletRows.length,
      walletsSelected: selectedWallets.length,
      successfulWallets,
      failedWallets: results.length - successfulWallets,
      results,
    });
  } catch (error) {
    console.error("Cron trader sync error:", error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
