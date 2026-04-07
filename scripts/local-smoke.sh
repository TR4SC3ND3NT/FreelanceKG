#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/local-smoke-backend.log"
HEALTH_URL="http://localhost:3001/health"

BACKEND_PID=""
STARTED_BACKEND="false"

cleanup() {
  if [[ "$STARTED_BACKEND" == "true" && -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    wait "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

wait_for_health() {
  local retries="${1:-40}"
  local delay="${2:-1}"

  for ((i=1; i<=retries; i++)); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

echo "[local-smoke] Preparing directories"
mkdir -p "$LOG_DIR" "$SERVER_DIR/uploads/files" "$SERVER_DIR/uploads/avatars"

echo "[local-smoke] Running backend prisma/build checks"
(
  cd "$SERVER_DIR"
  npm run db:generate
  npm run db:migrate:prod
  npm run build
)

echo "[local-smoke] Running frontend build"
(
  cd "$ROOT_DIR"
  npm run build
)

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "[local-smoke] Reusing already running backend on :3001"
else
  echo "[local-smoke] Starting backend dev server"
  (
    cd "$SERVER_DIR"
    npm run dev > "$BACKEND_LOG" 2>&1
  ) &
  BACKEND_PID=$!
  STARTED_BACKEND="true"

  if ! wait_for_health 60 1; then
    echo "[local-smoke] Backend did not become healthy. Check $BACKEND_LOG"
    exit 1
  fi
fi

echo "[local-smoke] Verifying API endpoints"
curl -fsS "$HEALTH_URL" >/dev/null
curl -fsS "http://localhost:3001/api/payments/config" >/dev/null
curl -fsS "http://localhost:3001/api/payments/methods" >/dev/null

echo "[local-smoke] OK: local setup is healthy"
