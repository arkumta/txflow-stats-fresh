
const hours = Number(process.argv[2] || 24);
const limit = Number(process.argv[3] || 10);
const walletArg = process.argv[4];
const historyDays = Number(process.argv[5] || 30);

if (![24, 168, 720].includes(hours)) {
  console.error("Hours must be 24, 168, or 720.");
  process.exit(1);
}

if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  console.error("Limit must be between 1 and 100.");
  process.exit(1);
}

const baseUrl = "http://localhost:3000";

let leaderboard = { traders: [] };

if (!walletArg) {
  const leaderboardUrl =
    `${baseUrl}/api/traders?hours=168&limit=${limit}&sort=trades`;

  const leaderboardResponse = await fetch(leaderboardUrl);
  leaderboard = await leaderboardResponse.json();

  if (!leaderboardResponse.ok || !leaderboard.success) {
    console.error("Could not load traders:", leaderboard);
    process.exit(1);
  }
}

const wallets = walletArg
  ? [walletArg.toLowerCase()]
  : [
      ...new Set(
        (leaderboard.traders || [])
          .map((trader) => String(trader.wallet).toLowerCase())
          .filter((wallet) => /^0x[a-f0-9]{40}$/.test(wallet))
      ),
    ];

if (
  wallets.length === 0 ||
  wallets.some((wallet) => !/^0x[a-f0-9]{40}$/.test(wallet))
) {
  console.error("No valid trader wallets were provided or found.");
  process.exit(1);
}

console.log(`Found ${wallets.length} traders to sync.`);

let failed = 0;

const windowMs = 24 * 60 * 60 * 1000;
const historyEndMs = Date.now();
const historyStartMs = historyEndMs - historyDays * windowMs;

for (let i = 0; i < wallets.length; i++) {
  const wallet = wallets[i];

  console.log(`\n[${i + 1}/${wallets.length}] Syncing ${wallet}`);

  let walletFailed = false;

  for (
    let windowEndMs = historyEndMs;
    windowEndMs > historyStartMs;
    windowEndMs -= windowMs
  ) {
    const windowStartMs = Math.max(
      historyStartMs,
      windowEndMs - windowMs
    );
    let offset = 0;

    console.log(
      `Window: ${new Date(windowStartMs).toISOString()} to ${new Date(windowEndMs).toISOString()}`
    );

    while (true) {
      try {
        const response = await fetch(
          `${baseUrl}/api/sync-trader-fills`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet,
              hours: 24,
              offset,
              startTimeMs: windowStartMs,
              endTimeMs: windowEndMs,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          console.error("Sync failed:", result);
          failed++;
          walletFailed = true;
          break;
        }

        console.log(
          `Offset ${offset}: pages ${result.pagesFetched}, fills submitted ${result.fillsSaved}, complete ${result.complete}`
        );

        if (result.complete) {
          break;
        }

        if (
          !Number.isInteger(result.nextOffset) ||
          result.nextOffset <= offset ||
          result.nextOffset > 200000
        ) {
          console.error(
            "Offset did not advance safely. Stop this time window."
          );
          failed++;
          walletFailed = true;
          break;
        }

        offset = result.nextOffset;
      } catch (error) {
        console.error("Request failed:", error);
        failed++;
        walletFailed = true;
        break;
      }
    }

    if (walletFailed) {
      break;
    }
  }

  if (!walletFailed) {
    console.log("Historical sync finished for this wallet.");
  }
}

console.log(`\nAll done. Traders: ${wallets.length}, failed syncs: ${failed}.`);
