<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Txflow Stats state-machine rules

Before changing a feature with asynchronous work or interactive state:

1. Read `docs/state-machine-audit.md` and identify the existing workflow(s) being changed.
2. Write down its states, events, transitions, cancellation behavior, empty state, error/retry behavior, and partial-success behavior before editing.
3. Preserve current API routes and response shapes, Supabase schema/data, indexing, cron schedules/checkpoints, and business calculations unless the user explicitly authorizes a separate change.
4. Keep independent dashboard panels independent. A failure in one widget must not hide unrelated successful data.
5. Treat valid empty data as success, not as an error. Treat a failed refresh with existing data as stale data, not as a blank page.
6. Prevent overlapping polling/manual refreshes and prevent obsolete requests from committing after route/input changes. Clean up timers and abort controllers.
7. Keep derived values derived; do not store duplicate state that can contradict its source.
8. Give every user action visible pending, success or recoverable failure feedback. Make retry possible without duplicating work.
9. Do not add a state-management dependency for a local workflow. Prefer a small typed discriminated union/helper when it materially removes duplicated lifecycle logic.
10. For every change, run the relevant lint/build checks and describe exactly what was and was not verified. Never claim the app was tested locally unless it was.

### Agent handoff checklist

When continuing work, inspect the current branch and latest source before editing; do not rely on old snippets or cached assumptions. Prefer small, sequential commits. For a state-machine change, report:
- affected workflow and files;
- transitions changed;
- API/data contracts preserved;
- race/cancellation behavior;
- empty/error/partial behavior checked;
- commands run and results;
- remaining risks or unverified behavior.
