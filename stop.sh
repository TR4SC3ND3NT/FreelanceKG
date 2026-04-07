#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$PROJECT_DIR/.pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

QUIET="false"
if [[ "${1:-}" == "--quiet" ]]; then
  QUIET="true"
fi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() {
  if [[ "$QUIET" == "false" ]]; then
    echo -e "$1"
  fi
}

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

kill_pid() {
  local pid="$1"
  local name="$2"

  if is_running "$pid"; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 0.5
    if is_running "$pid"; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    log "${GREEN}✅ Остановлен: $name (PID $pid)${NC}"
  fi
}

port_pid() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null | head -n1 || true
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1 || true
    return
  fi

  echo ""
}

stop_from_pid_file() {
  local file="$1"
  local name="$2"

  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file" 2>/dev/null || true)"
    if [[ -n "$pid" ]]; then
      kill_pid "$pid" "$name"
    fi
    rm -f "$file"
  fi
}

stop_by_port() {
  local port="$1"
  local name="$2"
  local pid
  pid="$(port_pid "$port")"

  if [[ -n "$pid" ]]; then
    kill_pid "$pid" "$name"
  fi
}

stop_docker_compose_if_running() {
  if ! command -v docker >/dev/null 2>&1; then
    return
  fi

  local compose_cmd=""
  if docker compose version >/dev/null 2>&1; then
    compose_cmd="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    compose_cmd="docker-compose"
  fi

  if [[ -z "$compose_cmd" ]]; then
    return
  fi

  if $compose_cmd ps --services --filter status=running >/dev/null 2>&1; then
    if $compose_cmd ps --services --filter status=running | grep -qE "backend|frontend|postgres|redis|mailpit"; then
      log "${BLUE}▶ Останавливаю Docker Compose сервисы${NC}"
      $compose_cmd down >/dev/null 2>&1 || true
      log "${GREEN}✅ Docker Compose остановлен${NC}"
    fi
  fi
}

main() {
  log "${BLUE}▶ Останавливаю FreelanceKG...${NC}"

  mkdir -p "$PID_DIR"

  stop_docker_compose_if_running

  stop_from_pid_file "$BACKEND_PID_FILE" "backend"
  stop_from_pid_file "$FRONTEND_PID_FILE" "frontend"

  stop_by_port 3001 "backend"
  stop_by_port 5173 "frontend"

  pkill -f "tsx.*src/index.ts" >/dev/null 2>&1 || true
  pkill -f "vite" >/dev/null 2>&1 || true

  if [[ "$QUIET" == "false" ]]; then
    echo -e "${GREEN}✅ Проект остановлен${NC}"
  fi
}

main "$@"
