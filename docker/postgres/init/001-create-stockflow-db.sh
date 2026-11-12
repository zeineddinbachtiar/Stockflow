
#!/bin/sh
set -eu

# Validate application database configuration.
: "${POSTGRES_APP_USER:?POSTGRES_APP_USER is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"
: "${POSTGRES_APP_DB:?POSTGRES_APP_DB is required}"

# Never use the PostgreSQL administrator as the application account.
if [ "$POSTGRES_APP_USER" = "$POSTGRES_USER" ]; then
  echo "Application database user must be different from the PostgreSQL administrator."
  exit 1
fi

echo "[POSTGRES INIT] Creating StockFlow application role and database..."

# Create a restricted application role and its database.
psql \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=app_user="$POSTGRES_APP_USER" \
  --set=app_password="$POSTGRES_APP_PASSWORD" \
  --set=app_database="$POSTGRES_APP_DB" <<'SQL'
SELECT format(
  'CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'app_user',
  :'app_password'
) \gexec

SELECT format(
  'CREATE DATABASE %I OWNER %I',
  :'app_database',
  :'app_user'
) \gexec
SQL

echo "[POSTGRES INIT] Applying StockFlow schema migration..."

# Apply the schema as the application database owner.
psql \
  --username="$POSTGRES_APP_USER" \
  --dbname="$POSTGRES_APP_DB" \
  --set=ON_ERROR_STOP=1 \
  --file=/migrations/001_create_stockflow_schema.sql

echo "[POSTGRES INIT] StockFlow database initialization completed."
