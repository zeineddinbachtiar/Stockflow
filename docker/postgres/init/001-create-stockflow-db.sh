
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

ordered_migration_files() {
  printf '%s\n' /migrations/*.sql | LC_ALL=C sort -t/ -k3,3n
}

validate_migrations() {
  expected_version=1
  migration_count=0
  migration_files=$(ordered_migration_files)

  while IFS= read -r migration_file; do
    [ -f "$migration_file" ] || continue

    filename=${migration_file##*/}
    case "$filename" in
      *_*.sql) version=${filename%%_*} ;;
      *)
        echo "Invalid migration filename: $filename"
        exit 1
        ;;
    esac

    case "$version" in
      ''|*[!0-9]*)
        echo "Invalid migration version in filename: $filename"
        exit 1
        ;;
    esac

    description=${filename#*_}
    description=${description%.sql}
    case "$description" in
      ''|_*|*_|*__*|*[!a-z0-9_]*)
        echo "Invalid migration description in filename: $filename"
        exit 1
        ;;
    esac

    expected_filename_version=$(printf '%03d' "$expected_version")
    if [ "$version" != "$expected_filename_version" ]; then
      echo "Expected migration version $expected_filename_version, found $version."
      exit 1
    fi

    expected_version=$((expected_version + 1))
    migration_count=$((migration_count + 1))
  done <<EOF
$migration_files
EOF

  if [ "$migration_count" -eq 0 ]; then
    echo "No SQL migrations were found in /migrations."
    exit 1
  fi
}

# Validate all migrations before making changes to the fresh database.
validate_migrations

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

echo "[POSTGRES INIT] Applying StockFlow migrations..."

migration_files=$(ordered_migration_files)
while IFS= read -r migration_file; do
  [ -f "$migration_file" ] || continue

  filename=${migration_file##*/}
  echo "[POSTGRES INIT] Applying $filename..."

  psql \
    --username="$POSTGRES_APP_USER" \
    --dbname="$POSTGRES_APP_DB" \
    --set=ON_ERROR_STOP=1 \
    --single-transaction \
    --file="$migration_file"
done <<EOF
$migration_files
EOF

echo "[POSTGRES INIT] StockFlow database initialization completed."
