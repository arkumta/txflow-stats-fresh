
#!/bin/bash

PROJECT_DIR="/Users/akhileshmishra/Desktop/txflow-stats"
LOG_DIR="$PROJECT_DIR/logs"
LOCK_DIR="$LOG_DIR/market-collect.lock"

cd "$PROJECT_DIR" || exit 1
mkdir -p "$LOG_DIR"

# Prevent overlapping collection runs.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "$(date): Market collection already running; skipping." >> "$LOG_DIR/market-collect.log"
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null
}
trap cleanup EXIT

# Wait for the local Next.js server.
for i in {1..30}; do
  if curl -fsS "http://localhost:3000/api/collect-market" \
    -o "$LOG_DIR/market-collect-response.json"; then
    break
  fi
  sleep 10
done

if [ ! -s "$LOG_DIR/market-collect-response.json" ]; then
  echo "$(date): Could not reach the market collection endpoint." >> "$LOG_DIR/market-collect.log"
  exit 1
fi

# Verify the endpoint returned success before recording it.
if grep -q '"success":true' "$LOG_DIR/market-collect-response.json"; then
  echo "$(date): Snapshot collected successfully." >> "$LOG_DIR/market-collect.log"
else
  echo "$(date): Collection endpoint returned an error:" >> "$LOG_DIR/market-collect.log"
  cat "$LOG_DIR/market-collect-response.json" >> "$LOG_DIR/market-collect.log"
  echo "" >> "$LOG_DIR/market-collect.log"
  exit 1
fi
