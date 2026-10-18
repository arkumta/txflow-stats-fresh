#!/bin/bash

PROJECT_DIR="/Users/akhileshmishra/Desktop/txflow-stats"
LOCK_DIR="$PROJECT_DIR/logs/hourly-sync.lock"

cd "$PROJECT_DIR" || exit 1

# Prevent overlapping sync runs.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "$(date): Sync already running; skipping."
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null
}
trap cleanup EXIT

# Wait for the local API to become available.
for i in {1..30}; do
  if curl -fsS "http://localhost:3000/api/sync-wallets?limit=1&offset=0" >/dev/null; then
    break
  fi
  sleep 10
done

if ! curl -fsS "http://localhost:3000/api/sync-wallets?limit=1&offset=0" >/dev/null; then
  echo "$(date): Local server is unavailable; skipping sync."
  exit 1
fi

node scripts/sync-all-traders.mjs >> logs/hourly-sync.log 2>&1
STATUS=$?
echo "$(date): Sync finished with exit code $STATUS" >> logs/hourly-sync.log
exit "$STATUS"