#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Idempotent Database Reset
# =============================================================================
# Drops and recreates the mmf database, then applies all migrations via dbmate.
# Safe to run repeatedly.
# =============================================================================

echo "Resetting database..."

# Parse connection details from DATABASE_URL
# Format: postgres://user:password@host:port/dbname?sslmode=disable
DB_URL="${DATABASE_URL:?DATABASE_URL is required}"

# Extract host, port, user, password from the URL
DB_USER=$(echo "${DB_URL}" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_HOST=$(echo "${DB_URL}" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "${DB_URL}" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "${DB_URL}" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_PASS=$(echo "${DB_URL}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

export PGPASSWORD="${DB_PASS}"

# Drop and recreate the database
echo "Dropping database ${DB_NAME} (if exists)..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};"

echo "Creating database ${DB_NAME}..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
    -c "CREATE DATABASE ${DB_NAME};"

# Apply migrations
echo "Running dbmate migrations..."
dbmate --url "${DB_URL}" up

echo "Database reset complete."
