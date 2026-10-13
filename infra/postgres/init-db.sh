#!/usr/bin/env bash
set -e

echo "Setting up Rota local PostgreSQL databases..."

DB_USER="${POSTGRES_USER:-admin}"
DB_PORT="${POSTGRES_PORT:-5432}"

psql -U "${DB_USER}" -p "${DB_PORT}" -h localhost -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'rota_dev'" | grep -q 1 || \
  psql -U "${DB_USER}" -p "${DB_PORT}" -h localhost -d postgres -c "CREATE DATABASE rota_dev;"

psql -U "${DB_USER}" -p "${DB_PORT}" -h localhost -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'rota_test'" | grep -q 1 || \
  psql -U "${DB_USER}" -p "${DB_PORT}" -h localhost -d postgres -c "CREATE DATABASE rota_test;"

echo "Enabling btree_gist extension on rota_dev and rota_test..."
psql -U "${DB_USER}" -p "${DB_PORT}" -h localhost -d rota_dev -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
psql -U "${DB_USER}" -p "${DB_PORT}" -h localhost -d rota_test -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

echo "PostgreSQL databases rota_dev and rota_test configured successfully."
