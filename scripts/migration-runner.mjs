import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_FILE_PATTERN = /^(\d{3,})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const ADVISORY_LOCK_NAMESPACE = 1_397_914_193;
const ADVISORY_LOCK_ID = 1;

export async function discoverMigrations(migrationsDirectory) {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.name.endsWith(".sql"));

  if (files.length === 0) {
    throw new Error("No SQL migrations were found.");
  }

  const migrations = files.map((entry) => {
    const match = MIGRATION_FILE_PATTERN.exec(entry.name);

    if (!entry.isFile() || !match) {
      throw new Error(`Invalid migration filename: ${entry.name}`);
    }

    const versionNumber = Number(match[1]);
    const normalizedVersion = String(versionNumber).padStart(3, "0");

    if (
      !Number.isSafeInteger(versionNumber) ||
      versionNumber < 1 ||
      normalizedVersion !== match[1]
    ) {
      throw new Error(`Invalid migration version in filename: ${entry.name}`);
    }

    return {
      version: match[1],
      versionNumber,
      filename: entry.name,
      filePath: path.join(migrationsDirectory, entry.name),
    };
  });

  migrations.sort(
    (first, second) => first.versionNumber - second.versionNumber,
  );

  for (let index = 0; index < migrations.length; index += 1) {
    const migration = migrations[index];
    const expectedVersion = index + 1;

    if (migration.versionNumber !== expectedVersion) {
      throw new Error(
        `Migration versions must be contiguous and start at 001; expected ${String(
          expectedVersion,
        ).padStart(3, "0")}, found ${migration.version}.`,
      );
    }

    migration.sql = await readFile(migration.filePath, "utf8");

    if (!migration.sql.trim()) {
      throw new Error(`Migration file is empty: ${migration.filename}`);
    }
  }

  return migrations;
}

async function getCurrentSchema(client) {
  const result = await client.query("SELECT current_schema() AS schema_name");
  const schemaName = result.rows[0]?.schema_name;

  if (typeof schemaName !== "string" || schemaName.length === 0) {
    throw new Error("The database connection has no active schema.");
  }

  return schemaName;
}

async function getTableNames(client, schemaName) {
  const result = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schemaName],
  );

  return result.rows.map((row) => row.table_name);
}

async function validateMigrationHistory(client, migrations, schemaName) {
  const migrationTable = await client.query(
    "SELECT to_regclass('schema_migrations') IS NOT NULL AS exists",
  );
  const historyExists = migrationTable.rows[0]?.exists === true;
  const tables = await getTableNames(client, schemaName);

  if (!historyExists) {
    if (tables.length > 0) {
      throw new Error(
        `Schema "${schemaName}" has tables but no schema_migrations history; refusing to guess its version.`,
      );
    }

    return { historyExists: false, appliedVersions: [] };
  }

  const requiredColumns = new Set(["version", "description", "applied_at"]);
  const columnResult = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'schema_migrations'`,
    [schemaName],
  );
  const foundColumns = new Set(columnResult.rows.map((row) => row.column_name));

  for (const column of requiredColumns) {
    if (!foundColumns.has(column)) {
      throw new Error(
        `schema_migrations is missing required column "${column}".`,
      );
    }
  }

  const appliedResult = await client.query(
    `SELECT version
     FROM schema_migrations
     ORDER BY version`,
  );
  const appliedVersions = appliedResult.rows
    .map((row) => row.version)
    .sort((first, second) => Number(first) - Number(second));

  for (let index = 0; index < appliedVersions.length; index += 1) {
    if (appliedVersions[index] !== migrations[index]?.version) {
      throw new Error(
        `Recorded migration history is not a prefix of available migrations (unexpected version ${appliedVersions[index]}).`,
      );
    }
  }

  if (
    appliedVersions.length === 0 &&
    tables.some((tableName) => tableName !== "schema_migrations")
  ) {
    throw new Error(
      `Schema "${schemaName}" has application tables but no applied migration history.`,
    );
  }

  return { historyExists: true, appliedVersions };
}

async function applyMigration(client, migration) {
  await client.query("BEGIN");

  try {
    await client.query(migration.sql);

    const historyResult = await client.query(
      `SELECT version, description, applied_at
       FROM schema_migrations
       WHERE version = $1`,
      [migration.version],
    );

    if (
      historyResult.rowCount !== 1 ||
      typeof historyResult.rows[0]?.description !== "string" ||
      historyResult.rows[0].description.trim().length === 0
    ) {
      throw new Error(
        `Migration ${migration.filename} did not record its version and description.`,
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        `Migration ${migration.filename} failed and rollback also failed.`,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Migration ${migration.filename} failed: ${message}`, {
      cause: error,
    });
  }
}

export async function runMigrations(
  client,
  migrationsDirectory,
  { log = () => undefined } = {},
) {
  const migrations = await discoverMigrations(migrationsDirectory);

  await client.query("SELECT pg_advisory_lock($1, $2)", [
    ADVISORY_LOCK_NAMESPACE,
    ADVISORY_LOCK_ID,
  ]);

  try {
    const schemaName = await getCurrentSchema(client);
    const { appliedVersions } = await validateMigrationHistory(
      client,
      migrations,
      schemaName,
    );
    const appliedSet = new Set(appliedVersions);
    const newlyApplied = [];

    for (const migration of migrations) {
      if (appliedSet.has(migration.version)) {
        continue;
      }

      log(`Applying migration ${migration.filename}...`);
      await applyMigration(client, migration);
      appliedSet.add(migration.version);
      newlyApplied.push(migration.version);
      log(`Applied migration ${migration.version}.`);
    }

    return newlyApplied;
  } finally {
    const unlockResult = await client.query(
      "SELECT pg_advisory_unlock($1, $2) AS unlocked",
      [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_ID],
    );

    if (unlockResult.rows[0]?.unlocked !== true) {
      throw new Error("Failed to release the database migration lock.");
    }
  }
}
