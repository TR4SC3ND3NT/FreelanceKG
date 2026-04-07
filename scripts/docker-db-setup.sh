#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "running prisma migrate deploy inside backend container"
docker compose exec backend npx prisma migrate deploy

echo "running optional seed inside backend container"
docker compose exec backend npm run db:seed

echo "database setup completed"
