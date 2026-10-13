#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"
mkdir -p "${DATA_DIR}"

PORT="${REDIS_PORT:-6379}"

echo "Starting isolated Rota Redis on port ${PORT}..."
exec "${SCRIPT_DIR}/bin/redis-server" \
  --port "${PORT}" \
  --dir "${DATA_DIR}" \
  --save "" \
  --appendonly no \
  --protected-mode no
