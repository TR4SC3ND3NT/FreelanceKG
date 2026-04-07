#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

LOG_DIR="$PROJECT_DIR/logs"
PID_DIR="$PROJECT_DIR/.pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKEND_PID=""
FRONTEND_PID=""

CACHE_CLI=""
CACHE_RUNTIME=""
ADMIN_PSQL_CMD=()
SYSTEM_DB_READY="false"
EFFECTIVE_DATABASE_URL=""
LOCAL_PG_DIR="$PROJECT_DIR/.local-postgres"
LOCAL_PG_PORT="${LOCAL_PG_PORT:-55432}"
LOCAL_PG_LOG="$LOG_DIR/local-postgres.log"

print_step() { echo -e "${BLUE}▶ $1${NC}"; }
print_ok() { echo -e "${GREEN}✅ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_err() { echo -e "${RED}❌ $1${NC}"; }

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

port_pid() {
  local port="$1"

  if command_exists lsof; then
    lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null | head -n1 || true
    return
  fi

  if command_exists ss; then
    ss -ltnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1 || true
    return
  fi

  echo ""
}

is_pid_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

ensure_requirements() {
  for cmd in node npm curl; do
    if ! command_exists "$cmd"; then
      print_err "Не найдено: $cmd"
      print_err "Сначала выполните ./install.sh"
      exit 1
    fi
  done

  if ! command_exists psql; then
    print_err "Не найдено: psql"
    print_err "Установите PostgreSQL клиент (postgresql / postgresql-client)"
    exit 1
  fi

  if [[ ! -f "server/.env" ]]; then
    print_err "Файл server/.env не найден"
    print_err "Сначала выполните ./install.sh"
    exit 1
  fi

  if [[ ! -d "node_modules" ]]; then
    print_warn "node_modules отсутствует, выполняю npm install"
    npm install
  fi

  if [[ ! -d "server/node_modules" ]]; then
    print_warn "server/node_modules отсутствует, выполняю npm install в server"
    (cd server && npm install)
  fi
}

load_server_env() {
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/server/.env"
  set +a
}

parse_database_url() {
  local db_url="$1"
  node - "$db_url" <<'NODE'
const raw = process.argv[2];
try {
  const parsed = new URL(raw);
  const dbName = (parsed.pathname || '').replace(/^\/+/, '');
  process.stdout.write(`${parsed.hostname || '127.0.0.1'}\n`);
  process.stdout.write(`${parsed.port || '5432'}\n`);
  process.stdout.write(`${decodeURIComponent(parsed.username || '')}\n`);
  process.stdout.write(`${decodeURIComponent(parsed.password || '')}\n`);
  process.stdout.write(`${dbName}\n`);
} catch (error) {
  process.exit(1);
}
NODE
}

sql_escape_literal() {
  printf '%s' "$1" | sed "s/'/''/g"
}

sql_escape_identifier() {
  printf '%s' "$1" | sed 's/"/""/g'
}

init_cache_tools() {
  if command_exists valkey-cli; then
    CACHE_CLI="valkey-cli"
  elif command_exists redis-cli; then
    CACHE_CLI="redis-cli"
  else
    CACHE_CLI=""
  fi

  if command_exists valkey-server; then
    CACHE_RUNTIME="valkey"
  elif command_exists redis-server; then
    CACHE_RUNTIME="redis"
  else
    CACHE_RUNTIME=""
  fi
}

cache_ping() {
  if [[ -z "$CACHE_CLI" ]]; then
    return 1
  fi

  [[ "$("$CACHE_CLI" -h 127.0.0.1 -p 6379 ping 2>/dev/null || true)" == "PONG" ]]
}

start_system_service() {
  local service
  for service in "$@"; do
    if sudo systemctl start "$service" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

start_postgresql_if_needed() {
  if ! command_exists pg_isready; then
    print_warn "pg_isready не найден, пропускаю авто-проверку PostgreSQL"
    return
  fi

  if pg_isready -h 127.0.0.1 -p 5432 -q >/dev/null 2>&1; then
    print_ok "PostgreSQL работает"
    SYSTEM_DB_READY="true"
    return
  fi

  print_step "Пробую запустить PostgreSQL"
  if [[ "${OSTYPE:-}" == "darwin"* ]]; then
    brew services start postgresql@18 >/dev/null 2>&1 || brew services start postgresql@14 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1 || true
  else
    start_system_service postgresql postgresql-18 postgresql@18-main || sudo service postgresql start >/dev/null 2>&1 || true
  fi

  sleep 2

  if pg_isready -h 127.0.0.1 -p 5432 -q >/dev/null 2>&1; then
    print_ok "PostgreSQL запущен"
    SYSTEM_DB_READY="true"
  else
    print_warn "PostgreSQL на :5432 недоступен. При необходимости будет поднят локальный dev-кластер"
  fi
}

start_cache_if_needed() {
  init_cache_tools

  if [[ -z "$CACHE_CLI" ]]; then
    print_warn "Не найден valkey-cli/redis-cli, пропускаю проверку cache"
    return
  fi

  if cache_ping; then
    print_ok "Cache работает (${CACHE_CLI})"
    return
  fi

  print_step "Пробую запустить cache runtime"
  if [[ "${OSTYPE:-}" == "darwin"* ]]; then
    brew services start valkey >/dev/null 2>&1 || brew services start redis >/dev/null 2>&1 || true
  else
    if [[ "$CACHE_RUNTIME" == "valkey" ]]; then
      start_system_service valkey valkey-server redis redis-server || sudo service valkey start >/dev/null 2>&1 || sudo service redis-server start >/dev/null 2>&1 || true
    else
      start_system_service redis redis-server valkey valkey-server || sudo service redis-server start >/dev/null 2>&1 || sudo service valkey start >/dev/null 2>&1 || true
    fi
  fi

  sleep 1

  if cache_ping; then
    print_ok "Cache запущен (${CACHE_CLI})"
  else
    print_warn "Cache не запущен. Backend продолжит работу с in-memory fallback"
  fi
}

resolve_admin_psql() {
  local db_host="$1"
  local db_port="$2"

  ADMIN_PSQL_CMD=()

  if command_exists sudo && sudo -n -u postgres psql -w -h "$db_host" -p "$db_port" -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
    ADMIN_PSQL_CMD=(sudo -n -u postgres psql -w -h "$db_host" -p "$db_port" -d postgres -v ON_ERROR_STOP=1)
    return 0
  fi

  if command_exists sudo && [[ -t 0 ]]; then
    ADMIN_PSQL_CMD=(sudo -u postgres psql -w -h "$db_host" -p "$db_port" -d postgres -v ON_ERROR_STOP=1)
    return 0
  fi

  if psql "postgresql://postgres:postgres@${db_host}:${db_port}/postgres" -tAc "SELECT 1" >/dev/null 2>&1; then
    ADMIN_PSQL_CMD=(psql "postgresql://postgres:postgres@${db_host}:${db_port}/postgres" -v ON_ERROR_STOP=1)
    return 0
  fi

  if psql -w -h "$db_host" -p "$db_port" -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
    ADMIN_PSQL_CMD=(psql -w -h "$db_host" -p "$db_port" -d postgres -v ON_ERROR_STOP=1)
    return 0
  fi

  return 1
}

admin_query() {
  "${ADMIN_PSQL_CMD[@]}" -qtAX -c "$1"
}

admin_exec() {
  "${ADMIN_PSQL_CMD[@]}" -q -c "$1" >/dev/null
}

build_database_url() {
  local db_user="$1"
  local db_pass="$2"
  local db_host="$3"
  local db_port="$4"
  local db_name="$5"
  node - "$db_user" "$db_pass" "$db_host" "$db_port" "$db_name" <<'NODE'
const [dbUser, dbPass, dbHost, dbPort, dbName] = process.argv.slice(2);
const user = encodeURIComponent(dbUser);
const pass = dbPass ? `:${encodeURIComponent(dbPass)}` : '';
const db = encodeURIComponent(dbName);
process.stdout.write(`postgresql://${user}${pass}@${dbHost}:${dbPort}/${db}`);
NODE
}

is_local_pg_ready() {
  if ! command_exists pg_isready; then
    return 1
  fi
  pg_isready -h 127.0.0.1 -p "$LOCAL_PG_PORT" -q >/dev/null 2>&1
}

ensure_local_postgres_cluster() {
  if is_local_pg_ready; then
    print_ok "Локальный PostgreSQL dev-кластер уже работает (127.0.0.1:${LOCAL_PG_PORT})"
    return 0
  fi

  if ! command_exists initdb || ! command_exists pg_ctl; then
    print_err "Нужны initdb и pg_ctl для локального PostgreSQL fallback"
    return 1
  fi

  if [[ ! -f "$LOCAL_PG_DIR/PG_VERSION" ]]; then
    print_step "Инициализирую локальный PostgreSQL dev-кластер"
    initdb -D "$LOCAL_PG_DIR" -U postgres --auth=trust >/dev/null
  fi

  print_step "Запускаю локальный PostgreSQL dev-кластер на порту ${LOCAL_PG_PORT}"
  pg_ctl -D "$LOCAL_PG_DIR" -l "$LOCAL_PG_LOG" -o "-p ${LOCAL_PG_PORT} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${LOCAL_PG_DIR}" start >/dev/null 2>&1 || true

  local i
  for ((i=1; i<=20; i++)); do
    if is_local_pg_ready; then
      print_ok "Локальный PostgreSQL запущен"
      return 0
    fi
    sleep 1
  done

  print_err "Не удалось запустить локальный PostgreSQL. Лог: ${LOCAL_PG_LOG}"
  return 1
}

provision_database() {
  local db_host="$1"
  local db_port="$2"
  local db_user="$3"
  local db_pass="$4"
  local db_name="$5"

  if ! resolve_admin_psql "$db_host" "$db_port"; then
    return 1
  fi

  local esc_user esc_pass esc_db esc_user_id esc_db_id
  esc_user="$(sql_escape_literal "$db_user")"
  esc_pass="$(sql_escape_literal "$db_pass")"
  esc_db="$(sql_escape_literal "$db_name")"
  esc_user_id="$(sql_escape_identifier "$db_user")"
  esc_db_id="$(sql_escape_identifier "$db_name")"

  local role_exists db_exists
  role_exists="$(admin_query "SELECT 1 FROM pg_roles WHERE rolname='${esc_user}' LIMIT 1;" || true)"
  if [[ "$role_exists" != "1" ]]; then
    if [[ -n "$db_pass" ]]; then
      admin_exec "CREATE ROLE \"${esc_user_id}\" LOGIN PASSWORD '${esc_pass}';"
    else
      admin_exec "CREATE ROLE \"${esc_user_id}\" LOGIN;"
    fi
    print_ok "Создан PostgreSQL пользователь: ${db_user}"
  fi

  db_exists="$(admin_query "SELECT 1 FROM pg_database WHERE datname='${esc_db}' LIMIT 1;" || true)"
  if [[ "$db_exists" != "1" ]]; then
    admin_exec "CREATE DATABASE \"${esc_db_id}\" OWNER \"${esc_user_id}\";"
    print_ok "Создана PostgreSQL база: ${db_name}"
  fi

  return 0
}

ensure_database_from_env() {
  load_server_env

  if [[ -z "${DATABASE_URL:-}" ]]; then
    print_err "DATABASE_URL не задан в server/.env"
    exit 1
  fi

  EFFECTIVE_DATABASE_URL="$DATABASE_URL"

  local parsed db_host db_port db_user db_pass db_name
  parsed="$(parse_database_url "$DATABASE_URL" || true)"
  if [[ -z "$parsed" ]]; then
    print_err "Не удалось распарсить DATABASE_URL"
    exit 1
  fi

  mapfile -t _db_parts <<<"$parsed"
  db_host="${_db_parts[0]:-127.0.0.1}"
  db_port="${_db_parts[1]:-5432}"
  db_user="${_db_parts[2]:-}"
  db_pass="${_db_parts[3]:-}"
  db_name="${_db_parts[4]:-}"

  if [[ -z "$db_user" || -z "$db_name" ]]; then
    print_err "DATABASE_URL должен содержать user и database"
    exit 1
  fi

  if [[ "$db_host" != "localhost" && "$db_host" != "127.0.0.1" ]]; then
    print_warn "DATABASE_URL указывает на удаленный хост ($db_host), авто-создание БД пропущено"
    return
  fi

  if psql "$EFFECTIVE_DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
    print_ok "База данных доступна (${db_name})"
    export DATABASE_URL="$EFFECTIVE_DATABASE_URL"
    return
  fi

  if [[ "$SYSTEM_DB_READY" == "true" ]]; then
    print_step "Создаю пользователя и БД по DATABASE_URL на системном PostgreSQL"
    if provision_database "$db_host" "$db_port" "$db_user" "$db_pass" "$db_name"; then
      if psql "$EFFECTIVE_DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
        print_ok "База готова по DATABASE_URL"
        export DATABASE_URL="$EFFECTIVE_DATABASE_URL"
        return
      fi
      print_warn "Системный PostgreSQL не дал доступ по DATABASE_URL после provisioning"
    else
      print_warn "Недостаточно прав для авто-настройки системного PostgreSQL, переключаюсь на локальный fallback"
    fi
  fi

  if ! ensure_local_postgres_cluster; then
    print_err "Не удалось подготовить ни системный, ни локальный PostgreSQL"
    exit 1
  fi

  print_step "Создаю пользователя и БД в локальном PostgreSQL fallback"
  if ! provision_database "127.0.0.1" "$LOCAL_PG_PORT" "$db_user" "$db_pass" "$db_name"; then
    print_err "Не удалось создать роль/БД в локальном PostgreSQL"
    exit 1
  fi

  EFFECTIVE_DATABASE_URL="$(build_database_url "$db_user" "$db_pass" "127.0.0.1" "$LOCAL_PG_PORT" "$db_name")"
  if ! psql "$EFFECTIVE_DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
    print_err "Локальная БД недоступна после настройки"
    exit 1
  fi

  export DATABASE_URL="$EFFECTIVE_DATABASE_URL"
  print_ok "Используется локальный PostgreSQL fallback: ${db_user}@127.0.0.1:${LOCAL_PG_PORT}/${db_name}"
}

bootstrap_prisma() {
  print_step "Синхронизирую Prisma (generate + migrate)"

  (
    cd server
    DATABASE_URL="$EFFECTIVE_DATABASE_URL" npm run db:generate >/dev/null
  )

  if (
    cd server
    DATABASE_URL="$EFFECTIVE_DATABASE_URL" npm run db:migrate:prod >/dev/null 2>&1
  ); then
    print_ok "Prisma migrate deploy выполнен"
  else
    print_warn "prisma migrate deploy не прошел, пробую prisma db push"
    (
      cd server
      DATABASE_URL="$EFFECTIVE_DATABASE_URL" npx prisma db push >/dev/null
    )
    print_ok "Prisma db push выполнен"
  fi
}

ensure_port_free() {
  local port="$1"
  local name="$2"
  local pid

  pid="$(port_pid "$port")"
  if [[ -z "$pid" ]]; then
    return
  fi

  print_err "Порт $port занят (PID $pid, $name)"
  print_err "Остановите процессы: ./stop.sh"
  exit 1
}

wait_for_http() {
  local url="$1"
  local retries="${2:-40}"
  local delay="${3:-1}"

  local i
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

cleanup() {
  echo
  print_step "Остановка процессов"
  "$PROJECT_DIR/stop.sh" --quiet || true
  echo -e "${GREEN}✅ Остановлено${NC}"
  exit 0
}

start_backend() {
  print_step "Запускаю backend (порт 3001)"

  (
    cd server
    DATABASE_URL="$EFFECTIVE_DATABASE_URL" npm run dev > "$LOG_DIR/backend.log" 2>&1
  ) &

  BACKEND_PID=$!
  echo "$BACKEND_PID" > "$BACKEND_PID_FILE"

  if wait_for_http "http://localhost:3001/health" 60 1; then
    print_ok "Backend запущен (PID $BACKEND_PID)"
  else
    print_err "Backend не поднялся. Проверьте logs/backend.log"
    "$PROJECT_DIR/stop.sh" --quiet || true
    exit 1
  fi
}

start_frontend() {
  print_step "Запускаю frontend (порт 5173)"

  npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"

  if wait_for_http "http://localhost:5173" 60 1; then
    print_ok "Frontend запущен (PID $FRONTEND_PID)"
  else
    print_err "Frontend не поднялся. Проверьте logs/frontend.log"
    "$PROJECT_DIR/stop.sh" --quiet || true
    exit 1
  fi
}

print_summary() {
  echo
  echo -e "${GREEN}FreelanceKG запущен${NC}"
  echo -e "${CYAN}Frontend:${NC} http://localhost:5173"
  echo -e "${CYAN}Backend API:${NC} http://localhost:3001/api"
  echo -e "${CYAN}Health:${NC} http://localhost:3001/health"
  echo
  echo -e "${CYAN}Тестовые аккаунты:${NC}"
  echo "  client@test.kg / password123"
  echo "  aibek@test.kg / password123"
  echo
  echo -e "${CYAN}Логи:${NC}"
  echo "  tail -f logs/backend.log"
  echo "  tail -f logs/frontend.log"
  echo
  echo -e "${YELLOW}Для остановки:${NC} ./stop.sh"
  echo
}

monitor_processes() {
  while true; do
    if [[ ! -f "$BACKEND_PID_FILE" && ! -f "$FRONTEND_PID_FILE" ]]; then
      print_step "Получена внешняя команда остановки"
      exit 0
    fi

    if [[ -n "$BACKEND_PID" ]] && ! is_pid_running "$BACKEND_PID"; then
      sleep 1
      if [[ ! -f "$BACKEND_PID_FILE" ]]; then
        print_step "Backend остановлен внешней командой"
        exit 0
      fi
      print_err "Backend процесс завершился"
      "$PROJECT_DIR/stop.sh" --quiet || true
      exit 1
    fi

    if [[ -n "$FRONTEND_PID" ]] && ! is_pid_running "$FRONTEND_PID"; then
      sleep 1
      if [[ ! -f "$FRONTEND_PID_FILE" ]]; then
        print_step "Frontend остановлен внешней командой"
        exit 0
      fi
      print_err "Frontend процесс завершился"
      "$PROJECT_DIR/stop.sh" --quiet || true
      exit 1
    fi

    sleep 2
  done
}

main() {
  mkdir -p "$LOG_DIR" "$PID_DIR"

  print_step "Проверка окружения"
  ensure_requirements

  print_step "Проверка сервисов"
  start_postgresql_if_needed
  start_cache_if_needed

  print_step "Проверка БД и Prisma"
  ensure_database_from_env
  bootstrap_prisma

  ensure_port_free 3001 "backend"
  ensure_port_free 5173 "frontend"

  trap cleanup SIGINT SIGTERM

  start_backend
  start_frontend
  print_summary

  monitor_processes
}

main "$@"
