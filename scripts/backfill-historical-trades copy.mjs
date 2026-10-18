import { readFile, writeFile } from "node:fs/promises";

const baseUrl = "http://localhost:3000";
const walletPageSize = 100;
const delayMs = 500;

const maxOffset = Number(process.env.BACKFILL_MAX_OFFSET || 200000);
const liveTestLimit = Number(process.env.BACKFILL_LIVE_TEST_LIMIT || 0);
const maxApiRequests = Number(process.env.BACKFILL_MAX_API_REQUESTS || 0);

let apiRequestsMade = 0;
let totalFillsSubmitted = 0;

function printRunSummary(status, reason = "") {
  console.log("\n========== HISTORICAL BACKFILL SUMMARY ==========");
  console.log(`Status: ${status}`);
  console.log(`API requests attempted: ${apiRequestsMade}`);
  console.log(`Fills submitted (reported by API): ${totalFillsSubmitted}`);

  if (maxApiRequests > 0) {
    console.log(`API request limit: ${maxApiRequests}`);
  } else {
    console.log("API request limit: unlimited");
  }

  if (reason) console.log(`Reason: ${reason}`);

  console.log("==================================================\n");
}

if (!Number.isInteger(maxApiRequests) || maxApiRequests < 0) {
  throw new Error(
    "BACKFILL_MAX_API_REQUESTS must be zero or a positive integer."
  );
}

if (!Number.isInteger(liveTestLimit) || liveTestLimit < 0) {
  throw new Error(
    "BACKFILL_LIVE_TEST_LIMIT must be zero or a positive integer."
  );
}

const dryRun = process.env.BACKFILL_DRY_RUN === "1";
const dryRunSplitDepth = Number(
  process.env.BACKFILL_DRY_RUN_SPLIT_DEPTH || 2
);

if (
  !Number.isInteger(dryRunSplitDepth) ||
  dryRunSplitDepth < 1 ||
  dryRunSplitDepth > 10
) {
  throw new Error(
    "BACKFILL_DRY_RUN_SPLIT_DEPTH must be between 1 and 10."
  );
}

const walletLimit = Number(process.env.BACKFILL_WALLET_LIMIT || 0);
const selectedWallet = (process.env.BACKFILL_WALLET || "").toLowerCase();
const startDate = process.env.BACKFILL_START_DATE || "";
const endDate = process.env.BACKFILL_END_DATE || "";

const walletScopeLabel = selectedWallet
  ? selectedWallet
  : `first-${walletLimit}-wallets`;

const runModeLabel = dryRun ? "dry-run" : "live";

const progressPath = new URL(
  `../logs/historical-backfill-progress-${runModeLabel}-${startDate}-${endDate}-${walletScopeLabel}.json`,
  import.meta.url
);

const checkpointPath = new URL(
  `../logs/historical-backfill-checkpoint-${runModeLabel}-${startDate}-${endDate}-${walletScopeLabel}.json`,
  import.meta.url
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }

  const ms = Date.parse(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(ms) ||
    new Date(ms).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} must be a valid calendar date.`);
  }

  return ms;
}

async function fetchJson(url, options, maxAttempts = 4) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(120_000),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success === true) {
        return data;
      }

      const message =
        `Request failed (${response.status}): ${JSON.stringify(data)}`;

      if (response.status === 429 || response.status >= 500) {
        throw new Error(message);
      }

      throw Object.assign(new Error(message), { permanent: true });
    } catch (error) {
      lastError = error;

      if (error.permanent || attempt === maxAttempts) {
        break;
      }

      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);

      console.warn(
        `Request attempt ${attempt}/${maxAttempts} failed: ${error.message}. ` +
        `Retrying in ${delayMs / 1000}s...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Request failed after ${maxAttempts} attempts: ${lastError?.message}`
  );
}

async function saveProgress(state) {
  await writeFile(
    progressPath,
    JSON.stringify(
      {
        version: 4,
        dryRun: state.dryRun,
        startTimeMs: state.startTimeMs,
        endTimeMs: state.endTimeMs,
        walletScope: state.wallets,
        completedWallets: [...state.completedWallets],
        completedWindows: [...state.completedWindows],
        windowOffsets: Object.fromEntries(state.windowOffsets),
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

async function getAllWallets() {
  const wallets = [];
  let offset = 0;

  while (true) {
    const page = await fetchJson(
      `${baseUrl}/api/sync-wallets?limit=${walletPageSize}&offset=${offset}`
    );

    wallets.push(...(page.wallets ?? []));

    if (page.nextOffset === null) break;

    if (
      !Number.isInteger(page.nextOffset) ||
      page.nextOffset <= offset
    ) {
      throw new Error("Wallet pagination did not advance.");
    }

    offset = page.nextOffset;
  }

  return [...new Set(wallets)];
}

function windowKey(wallet, startTimeMs, endTimeMs) {
  return `${wallet.toLowerCase()}:${startTimeMs}:${endTimeMs}`;
}

async function syncWallet(wallet, startTimeMs, endTimeMs, state) {
  const key = windowKey(wallet, startTimeMs, endTimeMs);
  let offset = state.windowOffsets.get(key) ?? 0;
  let totalSubmitted = 0;

  if (offset > 0) {
    console.log(`Resuming ${wallet} at offset ${offset}`);
  }

  while (true) {
    if (maxApiRequests > 0 && apiRequestsMade >= maxApiRequests) {
      await saveProgress(state);

      throw new Error(
        `Safety stop: reached BACKFILL_MAX_API_REQUESTS=${maxApiRequests}.`
      );
    }

    if (
      offset >= maxOffset ||
      (liveTestLimit > 0 && offset >= liveTestLimit)
    ) {
      state.windowOffsets.set(key, offset);
      await saveProgress(state);

      return { splitRequired: true, totalSubmitted };
    }

    apiRequestsMade++;

    const result = await fetchJson(`${baseUrl}/api/sync-trader-fills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        hours: 720,
        startTimeMs,
        endTimeMs,
        offset,
        maxPages: Number(process.env.BACKFILL_API_MAX_PAGES || 1),
      }),
    });

    totalSubmitted += result.fillsSaved ?? 0;
    totalFillsSubmitted += result.fillsSaved ?? 0;

    if (result.complete === true) {
      state.windowOffsets.delete(key);
      state.completedWindows.add(key);
      await saveProgress(state);

      return { splitRequired: false, totalSubmitted };
    }

    if (
      !Number.isInteger(result.nextOffset) ||
      result.nextOffset <= offset ||
      result.nextOffset > maxOffset
    ) {
      state.windowOffsets.set(key, offset);
      await saveProgress(state);

      return { splitRequired: true, totalSubmitted };
    }

    offset = result.nextOffset;
    state.windowOffsets.set(key, offset);

    // Save the latest offset after every successful API request.
    await saveProgress(state);
  }
}

async function syncWalletWithSplitting(
  wallet,
  startTimeMs,
  endTimeMs,
  state
) {
  const key = windowKey(wallet, startTimeMs, endTimeMs);

  if (state.completedWindows.has(key)) {
    console.log(`Skipping completed window: ${key}`);
    return 0;
  }

  if (state.dryRun) {
    const depth = state.dryRunDepth ?? 0;

    if (
      depth >= dryRunSplitDepth ||
      endTimeMs - startTimeMs <= 1
    ) {
      state.completedWindows.add(key);
      await saveProgress(state);
      return 0;
    }

    const midpoint = Math.floor((startTimeMs + endTimeMs) / 2);

    console.log(
      `[DRY RUN depth ${depth + 1}] Would split ${wallet}: ` +
      `${new Date(startTimeMs).toISOString()} – ` +
      `${new Date(endTimeMs).toISOString()}`
    );

    const first = await syncWalletWithSplitting(
      wallet,
      startTimeMs,
      midpoint,
      { ...state, dryRunDepth: depth + 1 }
    );

    const second = await syncWalletWithSplitting(
      wallet,
      midpoint + 1,
      endTimeMs,
      { ...state, dryRunDepth: depth + 1 }
    );

    state.completedWindows.add(key);
    await saveProgress(state);

    return first + second;
  }

  const result = await syncWallet(
    wallet,
    startTimeMs,
    endTimeMs,
    state
  );

  if (!result || typeof result.totalSubmitted !== "number") {
    throw new Error(
      `Invalid sync result for ${wallet}. The wallet will not be marked complete.`
    );
  }

  if (!result.splitRequired) {
    state.completedWindows.add(key);
    await saveProgress(state);
    return result.totalSubmitted;
  }

  if (endTimeMs - startTimeMs <= 1) {
    throw new Error(
      `Cannot split this time window further for ${wallet}: ` +
      `${new Date(startTimeMs).toISOString()} to ` +
      `${new Date(endTimeMs).toISOString()}`
    );
  }

  // The parent window is being replaced by smaller child windows.
  state.windowOffsets.delete(key);
  await saveProgress(state);

  const midpoint = Math.floor((startTimeMs + endTimeMs) / 2);

  console.warn(
    `Splitting busy window for ${wallet}: ` +
    `${new Date(startTimeMs).toISOString()} to ` +
    `${new Date(endTimeMs).toISOString()}`
  );

  const first = await syncWalletWithSplitting(
    wallet,
    startTimeMs,
    midpoint,
    state
  );

  const second = await syncWalletWithSplitting(
    wallet,
    midpoint + 1,
    endTimeMs,
    state
  );

  state.completedWindows.add(key);
  await saveProgress(state);

  return first + second;
}

async function loadProgress(state) {
  let text;

  try {
    text = await readFile(progressPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("No saved progress for this date range. Starting fresh.");
      return;
    }

    throw error;
  }

  let progress;

  try {
    progress = JSON.parse(text);
  } catch {
    throw new Error(`Invalid progress JSON: ${progressPath.pathname}`);
  }

  if (
    ![3, 4].includes(progress.version) ||
    progress.dryRun !== state.dryRun ||
    !Array.isArray(progress.completedWallets) ||
    !Array.isArray(progress.completedWindows) ||
    !Array.isArray(progress.walletScope) ||
    progress.startTimeMs !== state.startTimeMs ||
    progress.endTimeMs !== state.endTimeMs ||
    JSON.stringify(progress.walletScope) !== JSON.stringify(state.wallets)
  ) {
    throw new Error(
      `Progress does not match this run: ${progressPath.pathname}. ` +
      "Nothing was overwritten."
    );
  }

  const validWallets = new Set(state.wallets);

  for (const wallet of progress.completedWallets) {
    if (!validWallets.has(wallet)) {
      throw new Error(`Unexpected wallet in progress: ${wallet}`);
    }
  }

  state.completedWallets = new Set(progress.completedWallets);
  state.completedWindows = new Set(progress.completedWindows);
  state.windowOffsets = new Map(
    Object.entries(progress.windowOffsets ?? {})
  );

  console.log(`Resuming validated version-${progress.version} progress.`);
}

async function main() {
  if (!Number.isInteger(maxOffset) || maxOffset < 2000) {
    throw new Error(
      "BACKFILL_MAX_OFFSET must be an integer of at least 2000."
    );
  }

  if (!Number.isInteger(walletLimit) || walletLimit < 0) {
    throw new Error(
      "BACKFILL_WALLET_LIMIT must be zero or a positive integer."
    );
  }

  if (selectedWallet && walletLimit > 0) {
    throw new Error(
      "Set either BACKFILL_WALLET or BACKFILL_WALLET_LIMIT, not both."
    );
  }

  if (!selectedWallet && walletLimit === 0) {
    throw new Error(
      "Safety stop: set BACKFILL_WALLET to one wallet or " +
      "BACKFILL_WALLET_LIMIT to a positive integer."
    );
  }

  const startTimeMs = parseDate(startDate, "BACKFILL_START_DATE");
  const endTimeMs = parseDate(endDate, "BACKFILL_END_DATE");

  if (endTimeMs <= startTimeMs) {
    throw new Error("BACKFILL_END_DATE must be after BACKFILL_START_DATE.");
  }

  const walletsFound = await getAllWallets();

  const wallets = selectedWallet
    ? walletsFound.filter(
        (wallet) => wallet.toLowerCase() === selectedWallet
      )
    : walletsFound.slice(0, walletLimit);

  if (wallets.length === 0) {
    throw new Error(
      selectedWallet
        ? `Selected wallet not found in wallet index: ${selectedWallet}`
        : "No wallets found to process."
    );
  }

  const state = {
    startTimeMs,
    endTimeMs,
    wallets,
    dryRun,
    completedWallets: new Set(),
    completedWindows: new Set(),
    windowOffsets: new Map(),
  };

  await loadProgress(state);

  console.log(
    `Mode: ${dryRun ? "DRY RUN — no fills API writes" : "LIVE — may write fills to Supabase"}`
  );

  console.log(`Wallets in scope: ${wallets.length}`);

  console.log(
    `Historical window: ${new Date(startTimeMs).toISOString()} to ` +
    `${new Date(endTimeMs).toISOString()}`
  );

  for (const wallet of wallets) {
    const fullWindowKey = windowKey(
      wallet,
      startTimeMs,
      endTimeMs
    );

    const walletHasCompletedWindow =
      state.completedWindows.has(fullWindowKey);

    if (
      state.completedWallets.has(wallet) &&
      walletHasCompletedWindow
    ) {
      console.log(`Skipping completed wallet: ${wallet}`);
      continue;
    }

    if (
      state.completedWallets.has(wallet) &&
      !walletHasCompletedWindow
    ) {
      console.warn(
        `Ignoring wallet completion without a completed date window: ${wallet}`
      );

      state.completedWallets.delete(wallet);
      await saveProgress(state);
    }

    const submitted = await syncWalletWithSplitting(
      wallet,
      startTimeMs,
      endTimeMs,
      state
    );

    if (!state.completedWindows.has(fullWindowKey)) {
      throw new Error(
        `Wallet sync returned without completing its full date window: ${wallet}`
      );
    }

    state.completedWallets.add(wallet);
    await saveProgress(state);

    console.log(
      `[${state.completedWallets.size}/${wallets.length}] ${wallet}: ` +
      `${submitted} fills submitted during this run`
    );

    await sleep(delayMs);
  }

  await writeFile(
    checkpointPath,
    JSON.stringify(
      {
        version: 4,
        dryRun,
        startTimeMs,
        endTimeMs,
        walletScope: wallets,
        completedWallets: [...state.completedWallets],
        completedWindows: [...state.completedWindows],
        completedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  printRunSummary("COMPLETED");
  console.log("Backfill run completed.");
  console.log(`Checkpoint: ${checkpointPath.pathname}`);
  console.log("Hourly-sync checkpoint was not modified.");
}

main().catch((error) => {
  printRunSummary("STOPPED", error.message);
  console.error("Historical backfill stopped:", error.message);
  process.exitCode = 1;
});