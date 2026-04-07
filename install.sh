#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

OS_FAMILY=""
PKG_MANAGER=""
CACHE_CLI=""
CACHE_RUNTIME=""
ADMIN_PSQL_CMD=()

print_step() { echo -e "${BLUE}▶ $1${NC}"; }
print_ok() { echo -e "${GREEN}✅ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_err() { echo -e "${RED}❌ $1${NC}"; }

command_exists() {
  command -v "$1" >/dev/null 2>&1
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

enable_system_service() {
  local service
  for service in "$@"; do
    sudo systemctl enable "$service" >/dev/null 2>&1 || true
  done
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

detect_os() {
  if [[ "${OSTYPE:-}" == "darwin"* ]]; then
    OS_FAMILY="macos"
    PKG_MANAGER="brew"
    return
  fi

  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    case "${ID:-}" in
      ubuntu|debian|linuxmint|pop)
        OS_FAMILY="linux"
        PKG_MANAGER="apt"
        ;;
      arch|manjaro|endeavouros)
        OS_FAMILY="linux"
        PKG_MANAGER="pacman"
        ;;
      fedora|centos|rhel)
        OS_FAMILY="linux"
        PKG_MANAGER="dnf"
        ;;
      *)
        OS_FAMILY="linux"
        if command_exists apt-get; then
          PKG_MANAGER="apt"
        elif command_exists pacman; then
          PKG_MANAGER="pacman"
        elif command_exists dnf; then
          PKG_MANAGER="dnf"
        else
          print_err "Не удалось определить пакетный менеджер"
          exit 1
        fi
        ;;
    esac
    return
  fi

  if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" || "${OSTYPE:-}" == "win32" ]]; then
    print_err "Windows напрямую не поддерживается"
    echo "Используйте WSL2: wsl --install"
    exit 1
  fi

  print_err "Неизвестная ОС: ${OSTYPE:-unknown}"
  exit 1
}

ensure_brew() {
  if [[ "$PKG_MANAGER" != "brew" ]]; then
    return
  fi

  if command_exists brew; then
    return
  fi

  print_step "Устанавливаю Homebrew"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

install_package() {
  case "$PKG_MANAGER" in
    brew)
      brew install "$@"
      ;;
    apt)
      sudo apt-get update
      sudo apt-get install -y "$@"
      ;;
    pacman)
      sudo pacman -S --noconfirm "$@"
      ;;
    dnf)
      sudo dnf install -y "$@"
      ;;
    *)
      print_err "Неподдерживаемый пакетный менеджер: $PKG_MANAGER"
      exit 1
      ;;
  esac
}

ensure_node() {
  if command_exists node; then
    local major
    major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    if [[ "$major" -ge 18 ]]; then
      print_ok "Node.js $(node -v) уже установлен"
      return
    fi
  fi

  print_step "Устанавливаю Node.js 20+"
  case "$PKG_MANAGER" in
    brew)
      install_package node@20
      brew link node@20 --force --overwrite >/dev/null 2>&1 || true
      ;;
    apt)
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
      ;;
    pacman)
      install_package nodejs npm
      ;;
    dnf)
      install_package nodejs npm
      ;;
  esac

  print_ok "Node.js установлен: $(node -v)"
}

ensure_postgresql() {
  if command_exists psql; then
    print_ok "PostgreSQL уже установлен"
    return
  fi

  print_step "Устанавливаю PostgreSQL"
  case "$PKG_MANAGER" in
    brew)
      install_package postgresql@14
      ;;
    apt)
      install_package postgresql postgresql-contrib
      ;;
    pacman)
      install_package postgresql
      ;;
    dnf)
      install_package postgresql-server postgresql-contrib
      ;;
  esac

  print_ok "PostgreSQL установлен"
}

ensure_cache() {
  if command_exists valkey-server || command_exists redis-server; then
    print_ok "Valkey/Redis уже установлен"
    return
  fi

  print_step "Устанавливаю Valkey/Redis"
  case "$PKG_MANAGER" in
    brew)
      install_package valkey || install_package redis
      ;;
    apt)
      install_package valkey || install_package redis-server
      ;;
    pacman)
      install_package valkey || install_package redis
      ;;
    dnf)
      install_package valkey || install_package redis
      ;;
  esac

  print_ok "Valkey/Redis установлен"
}

start_postgresql() {
  print_step "Проверяю PostgreSQL"

  if command_exists pg_isready && pg_isready -h 127.0.0.1 -p 5432 -q >/dev/null 2>&1; then
    print_ok "PostgreSQL уже запущен"
    return
  fi

  case "$PKG_MANAGER" in
    brew)
      brew services start postgresql@18 >/dev/null 2>&1 || brew services start postgresql@14 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1 || true
      ;;
    apt|dnf|pacman)
      start_system_service postgresql postgresql-18 postgresql@18-main || sudo service postgresql start >/dev/null 2>&1 || true
      enable_system_service postgresql postgresql-18 postgresql@18-main
      ;;
  esac

  sleep 2

  if command_exists pg_isready && pg_isready -h 127.0.0.1 -p 5432 -q >/dev/null 2>&1; then
    print_ok "PostgreSQL запущен"
  else
    print_warn "Не удалось запустить PostgreSQL на :5432. Продолжаю, start.sh выполнит fallback при запуске"
  fi
}

start_cache() {
  print_step "Проверяю Valkey/Redis"
  init_cache_tools

  if cache_ping; then
    print_ok "Cache уже запущен (${CACHE_CLI})"
    return
  fi

  case "$PKG_MANAGER" in
    brew)
      brew services start valkey >/dev/null 2>&1 || brew services start redis >/dev/null 2>&1 || true
      ;;
    apt|dnf|pacman)
      if [[ "$CACHE_RUNTIME" == "valkey" ]]; then
        start_system_service valkey valkey-server redis redis-server || sudo service valkey start >/dev/null 2>&1 || sudo service redis-server start >/dev/null 2>&1 || true
        enable_system_service valkey valkey-server redis redis-server
      else
        start_system_service redis redis-server valkey valkey-server || sudo service redis-server start >/dev/null 2>&1 || sudo service valkey start >/dev/null 2>&1 || true
        enable_system_service redis redis-server valkey valkey-server
      fi
      ;;
  esac

  sleep 1
  init_cache_tools

  if cache_ping; then
    print_ok "Cache запущен (${CACHE_CLI})"
  else
    print_warn "Cache не запустился (backend использует in-memory fallback)"
  fi
}

ensure_database_from_env() {
  if [[ ! -f "server/.env" ]]; then
    print_err "server/.env не найден, невозможно определить DATABASE_URL"
    exit 1
  fi

  # shellcheck disable=SC1091
  source "server/.env"

  if [[ -z "${DATABASE_URL:-}" ]]; then
    print_err "DATABASE_URL отсутствует в server/.env"
    exit 1
  fi

  local parsed db_host db_port db_user db_pass db_name
  parsed="$(parse_database_url "$DATABASE_URL" || true)"
  if [[ -z "$parsed" ]]; then
    print_err "Не удалось распарсить DATABASE_URL: $DATABASE_URL"
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

  print_step "Проверяю БД и пользователя из DATABASE_URL (${db_user}/${db_name})"

  if psql "$DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
    print_ok "База и пользователь уже готовы"
    return
  fi

  if [[ "$db_host" != "localhost" && "$db_host" != "127.0.0.1" ]]; then
    print_warn "DATABASE_URL указывает на удаленный хост ($db_host), авто-создание пропущено"
    print_warn "Роль/БД для remote-хоста нужно подготовить вручную"
    return
  fi

  if ! resolve_admin_psql "$db_host" "$db_port"; then
    print_warn "Не удалось подключиться к PostgreSQL как администратор"
    print_warn "Продолжаю без авто-создания. start.sh попытается довести БД до рабочего состояния"
    return
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

  if psql "$DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
    print_ok "База и пользователь готовы по DATABASE_URL"
  else
    print_warn "База по DATABASE_URL недоступна после авто-настройки. start.sh выполнит fallback при запуске"
  fi
}

random_hex() {
  if command_exists openssl; then
    openssl rand -hex 32
  else
    date +%s%N
  fi
}

ensure_server_env() {
  if [[ -f "server/.env" ]]; then
    print_ok "server/.env уже существует"
    return
  fi

  print_step "Создаю server/.env"

  local db_url
  if [[ "$OS_FAMILY" == "macos" ]]; then
    db_url="postgresql://$(whoami)@127.0.0.1:5432/freelancekg"
  else
    db_url="postgresql://postgres:postgres@127.0.0.1:5432/freelancekg"
  fi

  local jwt_secret
  local session_secret
  jwt_secret="$(random_hex)"
  session_secret="$(random_hex)"

  cat > server/.env <<EOL
NODE_ENV="development"
PORT=3001

DATABASE_URL="${db_url}"
REDIS_URL="redis://127.0.0.1:6379"

JWT_SECRET="${jwt_secret}"
SESSION_SECRET="${session_secret}"
JWT_EXPIRES_IN="7d"

FRONTEND_URL="http://localhost:5173"
CORS_ORIGIN="http://localhost:5173"

EMAIL_FROM="noreply@freelancekg.kg"
EMAIL_REPLY_TO="support@freelancekg.kg"
SMTP_HOST=""
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=""
SMTP_PASS=""

ENABLE_OAUTH=true
DEV_OAUTH_MOCK=true
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GITHUB_CALLBACK_URL="http://localhost:3001/api/auth/github/callback"

UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760
EOL

  print_ok "server/.env создан"
}

install_node_modules() {
  print_step "Устанавливаю npm зависимости (frontend)"
  npm install

  print_step "Устанавливаю npm зависимости (backend)"
  (cd server && npm install)

  mkdir -p server/uploads
  print_ok "npm зависимости установлены"
}

setup_prisma() {
  print_step "Настраиваю Prisma"
  (
    cd server
    npx prisma generate
  )

  if (
    cd server
    npx prisma migrate deploy
  ); then
    print_ok "Prisma migrate deploy выполнен"
  else
    print_warn "prisma migrate deploy не прошел, пробую prisma db push"
    (
      cd server
      npx prisma db push
    )
    print_ok "Prisma db push выполнен"
  fi

  (
    cd server
    npx prisma db seed
  )
  print_ok "Prisma seed выполнен"
}

main() {
  echo -e "${CYAN}FreelanceKG install.sh${NC}"

  detect_os
  ensure_brew

  ensure_node
  ensure_postgresql
  ensure_cache

  start_postgresql
  start_cache

  ensure_server_env
  ensure_database_from_env
  install_node_modules
  setup_prisma

  echo
  print_ok "Установка завершена"
  echo -e "${CYAN}Дальше: ./start.sh${NC}"
}

main "$@"
