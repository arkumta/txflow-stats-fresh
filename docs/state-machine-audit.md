# Txflow Stats — State Machine Audit

**Audit scope:** repository source on `main`, reviewed 17 November 2026.
**Intent:** document the app's implicit workflows and define safe rules for improving UX, DX and agent experience (AX).
**Safety boundary:** this audit does not change API payloads, calculations, database schema, Supabase behavior, cron schedules, indexing, or market/trade collection.

## Executive decision

Do not replace the app with a new state-management library or perform a one-shot rewrite. The app already has useful local state and cancellation patterns, but each feature expresses the same lifecycle differently. The safest high-value move is to standardize the *contract* first, then migrate one workflow at a time with tests/build checks.

Use a small, explicit async resource state model for read-only requests:

- `idle`: not requested yet
- `loading`: first request in progress, no usable data yet
- `success`: current request succeeded (including a valid empty result)
- `refreshing`: a subsequent request is in progress while prior data remains visible
- `stale`: last known data remains visible after a refresh failed
- `error`: no usable data is available because the request failed

Keep request status separate from domain state. For example, “no open positions” is a successful empty result, not an error; “wallet has no trades” is not the same as “trades endpoint failed”. A mutation/action may additionally need `submitting`, `success`, and `failure`, but should not reuse a read-resource state blindly.

## State-machine inventory

### 1. Global navigation and wallet search
**Files:** `app/components/Navbar.tsx`

- Navigation: current route → active link; mobile menu closed/open.
- Wallet search: idle → validating → searching → one match/navigation; no matches; multiple matches; request failure.
- Existing good behavior: validates empty input, distinguishes zero/one/multiple matches, exposes an alert, disables submit while searching.
- Improvement: close mobile menu on route change as well as link click; preserve typed query/error until a new submission; use a shared search status type if search is later reused.
- Risk: low. Keep the current API contract `/api/search-traders?q=`.

### 2. Homepage overview and top traders
**Files:** `app/page.tsx`, `app/components/PnlCards.tsx`, `app/components/VolumeChart.tsx`, `app/components/MarketsTable.tsx`, `app/components/PnlLeaderboard.tsx`

Independent resources currently load separately:
- Reference market price.
- Overview metrics and trade statistics.
- Top-trader list, with period and sort controls.
- PnL summary cards.
- Volume history chart (period and metric selection).
- Market table (separate 10-second polling).
- PnL leaderboard (period, search, sorting, profitability and fill filters; copy-wallet feedback).

Observed design concern: a dashboard can be partly usable while one widget fails, which is good, but widget state conventions differ. Some widgets show a loading state, some only an error, and some can retain old data without an explicit stale/refreshing indicator. This can make “empty”, “not loaded”, and “failed” look too similar.

### 3. Markets directory
**File:** `app/markets/page.tsx`

- Initial load of market metadata + market context.
- Periodic/manual refresh.
- Search, active/inactive visibility, sort key and direction.
- Derived gainers, losers, funding leaders, volume leaders and totals.
- The two market requests are coupled with `Promise.all`: one failing can prevent the pair from being committed.
- Improve by making request lifecycle explicit, preventing older overlapping refreshes from winning, and showing “updated at / stale” while retaining last-good rows.
- Do not alter market formulas or the upstream endpoints.

### 4. Market detail
**Files:** `app/markets/[market]/page.tsx`, `app/components/PriceChart.tsx`, `app/components/VolumeChart.tsx`, `app/components/FundingRateChart.tsx`

- Route parameter → market metadata/context lookup → found/not found/error.
- Market detail supports initial load and periodic/manual refresh.
- Price chart: selected candle interval, candle loading, refresh trigger and periodic refresh.
- Volume chart: selected period + metric, historical snapshot load, retry.
- Funding chart: selected period, historical snapshot load, retry.
- Improvement: make stale data, first load, empty history and retry states visually distinct; cancel or ignore obsolete requests when market/period/interval changes; avoid overlapping polling requests.
- A chart with no snapshots is a valid empty-data state and should explain coverage rather than look broken.

### 5. Trader leaderboard and trader profile
**Files:** `app/traders/page.tsx`, `app/traders/[wallet]/page.tsx` and profile panels listed below.

Leaderboard:
- Initial load, manual refresh, period selection, sort selection, wallet search and filter.
- Search distinguishes empty, no match, ambiguous match and request failure.
- Refresh should preserve the previous ranking until the new response succeeds; avoid a late response replacing newer period/filter data.

Trader profile:
- Profile summary, recent trades, activity, and market breakdown load as independent resources.
- Profile-level loading/error is distinct from the three secondary sections.
- Copy-wallet feedback is a timed action state.
- This separation is useful: one panel failing should not hide the others.
- Improvement: label each panel's own state consistently; show retry for the failed panel; abort/ignore stale responses on wallet navigation; do not collapse a valid empty result into a generic failure.

Profile sub-machines:
- `TraderBehavior.tsx`: behavior request → loading/success/empty/error.
- `TraderDiscipline.tsx`: discipline request → loading/success/partial/error; partial-data flag is domain metadata and should remain distinct from request failure.
- `TraderMarketPerformance.tsx`: market-performance request → loading/success/empty/error.
- `TraderPerformance.tsx`: performance request → loading/success/empty/error; derived metrics/charts are computed from the returned data.
- `TraderSessionAnalysis.tsx`: session request → loading/success/empty/error.
- `TraderPerformanceCalendar.tsx`: visible month and selected date; month navigation clears selection.
- `ActivityChart.tsx`: presentational chart (no local async lifecycle found).
- `TraderIntelligence.tsx`: live positions and fill history load independently; positions refresh every 30 seconds; history has its own initial loading/error state.

### 6. Positions watchlist
**File:** `app/positions/page.tsx`

- Browser storage hydration: not-yet-loaded → loaded watchlist (or safe empty fallback).
- Watchlist editing: add validated wallet, deduplicate/lowercase, persist in localStorage.
- Live monitor: refresh watched wallets with bounded concurrency; each wallet can succeed or fail independently.
- Aggregate dashboard: exposure, PnL, positions, fills, previous-value deltas.
- Discovery: idle → scanning → results/empty/error.
- Important UX distinction: per-wallet failure must not imply every wallet failed; successful empty positions must not imply endpoint failure.
- Improvement: prevent overlapping 30-second/manual refreshes; guard against an old refresh overwriting results after the watchlist changes; show per-wallet stale/updated time; make storage write failures visible without losing the in-memory watchlist.
- Keep the existing storage key `txflow-stats-wallet-watchlist` and wallet validation unchanged unless explicitly migrated.

### 7. Market screener
**File:** `app/screener/page.tsx`

- Market metadata/context load and 30-second polling.
- Search, min volume, min OI, absolute funding, 24-hour movement, active-only, sort and direction.
- Filtered rows and aggregate totals are derived state (should not be stored separately).
- Improvement: show first-load vs refreshing vs stale vs empty-filter-results; prevent overlapping polls; retain last-good data after a transient refresh error.

### 8. Trader comparison
**File:** `app/trader-comparison/page.tsx`

- Wallet slot hydration/initialization.
- Input validation: minimum two, maximum three, valid addresses, no duplicates.
- Compare action: idle → validating → loading → results; request failure; valid per-wallet failure/result handling.
- `hasCompared` is a second flag alongside results/loading/error, creating possible redundant state combinations.
- Improvement: derive “has results” from a tagged compare state or result presence; model each wallet result independently so partial results are clear; ignore outdated comparison responses if the inputs change while a request is in flight.

### 9. Fee calculator
**File:** `app/fees/page.tsx`

- Quantity and price input; fee tier; maker/taker; single/round-trip.
- This is a synchronous derived-state machine, not an async request.
- Improvement: validate numeric input explicitly, communicate invalid/zero values and calculation assumptions, and keep all outputs derived from the source inputs (avoid duplicate stored totals).

### 10. Background data collection and synchronization
**Files:** `app/api/collect-market/route.ts`, `app/api/cron/sync-traders/route.ts`, `app/api/sync-trader-fills/route.ts`, `app/api/position-discovery/route.ts`, plus supporting API routes.

Market collector:
- Authorization → fetch metadata → validate active markets → collect contexts with rate-limit retry/backoff → partial/full failure classification → persist snapshots → response.
- Partial collection is a first-class outcome; do not simplify it to all-or-nothing success.
- Keep retry/backoff and persistence semantics intact.

Trader cron:
- Authorization/limit validation → read wallet + checkpoint state → process wallet → fetch/sync fill pages → update checkpoint/offset/completion → per-wallet success/failure → run summary.
- This is a durable workflow with persisted progress. Treat checkpoint/offset as state-machine data; never reset or reinterpret it as part of a UI refactor.
- Preserve pagination, resume semantics, concurrency limits and cron schedule.

Fill sync endpoint:
- Validate wallet/time range/page limit/offset → fetch pages → validate upstream response → write fills → complete/partial/error response.
- Preserve bounded pagination and validation exactly.

Position discovery:
- Request → scan indexed wallets → per-wallet positions → aggregated results + scope note.
- The returned scan is intentionally bounded and must not be described as a complete market-wide scan.

## Cross-cutting issues to address, in order

### P0 — correctness and race safety
1. **Overlapping polling/manual refreshes:** market table polls every 10 seconds; markets and market detail poll every 30 seconds; positions and trader intelligence also poll. Some loaders do not guard against a second request starting before the first finishes. This can create request pileups and out-of-order UI updates.
2. **Stale-response races:** route parameters, filters, wallet watchlists and chart selections can change while a request is pending. Every response must prove it still belongs to the current request before committing state.
3. **Refresh error vs no data:** preserve last-good data on refresh failure and represent it as stale; do not blank a populated dashboard due to a transient error.
4. **Independent resource boundaries:** keep unrelated panels independent; a secondary panel failure must not blank the whole trader profile/dashboard.

### P1 — UX consistency
5. Standardize first-load, refreshing, stale, empty, partial, error and retry presentation.
6. Show timestamps and data provenance where already available; do not invent freshness guarantees.
7. Make empty states actionable and distinguish “no records” from “filters returned no matches”.
8. For partial results, explain which part succeeded and which failed.

### P2 — DX and AX
9. Add a documented state vocabulary and transition rules (this document).
10. Require new async features to declare their states, retry behavior, cancellation strategy, empty state and partial-success behavior.
11. Keep derived values derived; avoid redundant booleans such as `loading + error + hasLoaded + hasCompared` when one tagged state can express the lifecycle.
12. Preserve API schemas and domain logic during UI state refactors. Keep network access in existing API routes; don't introduce direct browser-to-Supabase writes.

## Target state contracts

### Async read resource
```ts
type ResourceState<T> =
  | { status: "idle"; data: null; error: null; updatedAt: null }
  | { status: "loading"; data: null; error: null; updatedAt: null }
  | { status: "success"; data: T; error: null; updatedAt: string }
  | { status: "refreshing"; data: T; error: null; updatedAt: string }
  | { status: "stale"; data: T; error: string; updatedAt: string }
  | { status: "error"; data: null; error: string; updatedAt: null };
```

For resources where partial results are valid, model partiality in the domain payload (e.g. per-wallet errors or collector counts), not by lying about transport success.

### Action/mutation
```ts
type ActionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message?: string }
  | { status: "error"; error: string };
```

### Required transition rules
- Initial request: `idle → loading → success | error`.
- Refresh with usable data: `success → refreshing → success | stale`.
- Retry from no data: `error → loading → success | error`.
- Filter changes do not mean data is loading if filtering is local.
- A valid empty response is `success` with an empty collection.
- A failed refresh must not erase last-good data.
- Only the newest request for the current inputs may commit state.
- Abort on unmount/obsolete inputs where supported; also guard by request identity because not every API or async operation is abortable.
- Timers must be cleaned up and must not create overlapping refreshes.
- A manual refresh and an automatic poll share one in-flight guard.
- Every interactive action has disabled/loading feedback and a recoverable failure path.

## Safe implementation sequence

1. **Document and enforce the contract** (this change): no runtime behavior changes.
2. Introduce a tiny typed async-resource helper/hook and tests, with no migrations yet.
3. Migrate the simplest read-only chart widget, then market screener, then market directory/detail.
4. Migrate independent trader profile panels and watchlist monitor.
5. Treat cron/checkpoint/fill collection workflows as a separate backend project with dedicated regression tests; do not refactor them during UI migration.
6. After each step: run lint/build, verify API response shapes, check empty/error/stale states, and test rapid navigation/refresh.

## Definition of done for each migrated workflow

- [ ] Initial loading is visible and does not flash a false empty state.
- [ ] Successful empty response is clearly different from an error.
- [ ] Refresh retains last-good data and exposes refreshing/stale status.
- [ ] Retry works and does not duplicate in-flight work.
- [ ] Obsolete responses cannot overwrite current inputs.
- [ ] Timers/listeners/controllers are cleaned up.
- [ ] Partial success is represented honestly.
- [ ] Existing URL, API, Supabase and calculation contracts are unchanged.
- [ ] Keyboard and mobile interactions remain usable.
- [ ] Lint/build and manual smoke checks pass.
