
import {
  readFile,
  writeFile,
  unlink,
} from "node:fs/promises";

const baseUrl = "http://localhost:3000";
const walletPageSize = 100;
const delayMs = 500;
const fallbackLookbackMs = 2 * 60 * 60 * 1000;

const testWalletLimit = Number(
  process.env.SYNC_WALLET_LIMIT || 0
);

const logDir = new URL("../logs/", import.meta.url);

const isTestRun = testWalletLimit > 0;

const checkpointPath = new URL(
  isTestRun
    ? "../logs/hourly-sync-test-checkpoint.json"
    : "../logs/hourly-sync-checkpoint.json",
  import.meta.url
);

const progressPath = new URL(
  isTestRun
    ? "../logs/hourly-sync-test-progress.json"
    : "../logs/hourly-sync-progress.json",
  import.meta.url
);

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));


async function fetchJson(url, options) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Invalid JSON response (HTTP ${response.status})`
        );
      }

      if (response.ok && data.success === true) {
        return data;
      }

      const error = new Error(
        `Request failed (${response.status}): ${JSON.stringify(data)}`
      );

      // Retry temporary server errors, but not ordinary client errors.
      if (response.status < 500 && response.status !== 429) {
        throw Object.assign(error, { noRetry: true });
      }

      throw error;
    } catch (error) {
      if (error.noRetry || attempt === maxAttempts) {
        throw error;
      }

      const delay = 1000 * attempt;

      console.warn(
        `Request attempt ${attempt}/${maxAttempts} failed: ${error.message}. Retrying in ${delay / 1000}s...`
      );

      await sleep(delay);
    }
  }

  throw new Error("Request failed after all retry attempts.");
}


async function removeFileIfExists(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function syncWallet(wallet, startTimeMs, endTimeMs) {
  let offset = 0;
  let totalSubmitted = 0;

  while (true) {
    const result = await fetchJson(
      `${baseUrl}/api/sync-trader-fills`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet,
          hours: 24,
          startTimeMs,
          endTimeMs,
          offset,
        }),
      }
    );

    totalSubmitted += result.fillsSaved ?? 0;

    if (result.complete) {
      return totalSubmitted;
    }

    if (
      !Number.isInteger(result.nextOffset) ||
      result.nextOffset <= offset
    ) {
      throw new Error(
        `Pagination did not advance for ${wallet}`
      );
    }

    offset = result.nextOffset;
  }
}

async function getAllWallets() {
  const wallets = [];
  let offset = 0;

  while (true) {
    const page = await fetchJson(
      `${baseUrl}/api/sync-wallets?limit=${walletPageSize}&offset=${offset}`
    );

    const pageWallets = page.wallets ?? [];

    wallets.push(...pageWallets);

    if (page.nextOffset === null) {
      break;
    }

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

async function main() {
  if (
    !Number.isInteger(testWalletLimit) ||
    testWalletLimit < 0
  ) {
    throw new Error("SYNC_WALLET_LIMIT must be a positive integer or zero.");
  }

  const walletsFound = await getAllWallets();

  if (walletsFound.length === 0) {
    throw new Error("No wallets were returned. Check the wallet index.");
  }

  const wallets = isTestRun
    ? walletsFound.slice(0, testWalletLimit)
    : walletsFound;

  let startTimeMs;
  let endTimeMs;
  let completedWallets = new Set();

  try {
    const progress = JSON.parse(
      await readFile(progressPath, "utf8")
    );

    if (
      Number.isFinite(progress.startTimeMs) &&
      Number.isFinite(progress.endTimeMs) &&
      Array.isArray(progress.completedWallets)
    ) {
      startTimeMs = progress.startTimeMs;
      endTimeMs = progress.endTimeMs;

      completedWallets = new Set(
        progress.completedWallets
      );

      console.log("Resuming the saved sync window.");
    }
  } catch {
    // No valid progress file exists yet.
  }

  if (
    !Number.isFinite(startTimeMs) ||
    !Number.isFinite(endTimeMs)
  ) {
    let lastSuccessfulEndTimeMs;

    try {
      const checkpoint = JSON.parse(
        await readFile(checkpointPath, "utf8")
      );

      if (
        Number.isFinite(checkpoint.lastSuccessfulEndTimeMs)
      ) {
        lastSuccessfulEndTimeMs =
          checkpoint.lastSuccessfulEndTimeMs;
      }
    } catch {
      // No checkpoint exists yet.
    }

    endTimeMs = Date.now();

    startTimeMs =
      Number.isFinite(lastSuccessfulEndTimeMs) &&
      lastSuccessfulEndTimeMs < endTimeMs
        ? lastSuccessfulEndTimeMs
        : endTimeMs - fallbackLookbackMs;

    completedWallets = new Set();
  }

  const walletsToProcess = wallets.filter(
    (wallet) => !completedWallets.has(wallet)
  );

  console.log(
    `Wallets in scope: ${wallets.length}; already completed in this window: ${completedWallets.size}`
  );

  console.log(
    `Window: ${new Date(startTimeMs).toISOString()} to ${new Date(endTimeMs).toISOString()}`
  );

  let processed = 0;
  let failed = 0;
  let totalSubmitted = 0;

  for (const wallet of walletsToProcess) {
    try {
      const submitted = await syncWallet(
        wallet,
        startTimeMs,
        endTimeMs
      );

      totalSubmitted += submitted;
      processed++;
      completedWallets.add(wallet);

      await writeFile(
        progressPath,
        JSON.stringify(
          {
            startTimeMs,
            endTimeMs,
            completedWallets: [...completedWallets],
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      console.log(
        `[${completedWallets.size}/${wallets.length}] Synced ${wallet}; fills submitted: ${submitted}`
      );
    } catch (error) {
      failed++;

      console.error(
        `Failed ${wallet}:`,
        error.message
      );

      console.error(
        "Stopping this run. The next run can resume this window."
      );

      break;
    }

    await sleep(delayMs);
  }

  const allWalletsCompleted = wallets.every(
    (wallet) => completedWallets.has(wallet)
  );

  console.log("\nSync finished.");
  console.log(`Wallets in scope: ${wallets.length}`);
  console.log(`Newly processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Fills submitted: ${totalSubmitted}`);

  if (failed > 0 || !allWalletsCompleted) {
    process.exitCode = 1;
    console.log("Progress retained; checkpoint not advanced.");
    return;
  }

  await writeFile(
    checkpointPath,
    JSON.stringify(
      { lastSuccessfulEndTimeMs: endTimeMs },
      null,
      2
    ) + "\n",
    "utf8"
  );

  await removeFileIfExists(progressPath);

  console.log(
    `Checkpoint saved: ${new Date(endTimeMs).toISOString()}`
  );

  if (isTestRun) {
    console.log(
      "Test run complete. Production checkpoint was not modified."
    );
  }
}

main().catch((error) => {
  console.error("Sync job stopped:", error.message);
  process.exitCode = 1;
});
