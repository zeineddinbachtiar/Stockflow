import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";

import { pool } from "../../src/config/database";
import {
  discoverMigrations,
  runMigrations,
} from "../../scripts/migration-runner.mjs";

const migrationsDirectory = path.resolve("database", "migrations");
const createdSchemas: string[] = [];

async function openIsolatedSchema() {
  assert.equal(
    process.env.DB_NAME,
    "stockflow_test_db",
    "Migration runner integration tests must use the dedicated test database.",
  );

  const schemaName = `sf_migration_${randomUUID().replaceAll("-", "")}`;
  await pool.query(`CREATE SCHEMA ${schemaName}`);
  createdSchemas.push(schemaName);

  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schemaName}`);
  } catch (error) {
    client.release(true);
    throw error;
  }

  return { client, schemaName };
}

after(async () => {
  for (const schemaName of createdSchemas) {
    await pool.query(`DROP SCHEMA ${schemaName} CASCADE`);
  }
});

test("migrates a fresh schema in version order and is idempotent", async () => {
  const { client } = await openIsolatedSchema();

  try {
    const firstRun = await runMigrations(client, migrationsDirectory);
    const secondRun = await runMigrations(client, migrationsDirectory);

    assert.deepEqual(firstRun, ["001", "002"]);
    assert.deepEqual(secondRun, []);

    const history = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    assert.deepEqual(
      history.rows.map((row) => row.version),
      ["001", "002"],
    );

    const authSessionsTable = await client.query(
      "SELECT to_regclass('auth_sessions') IS NOT NULL AS exists",
    );
    assert.equal(authSessionsTable.rows[0]?.exists, true);
  } finally {
    client.release(true);
  }
});

test("upgrades version 001 to 002 and preserves existing data", async () => {
  const { client } = await openIsolatedSchema();

  try {
    const migrations = await discoverMigrations(migrationsDirectory);
    const initialMigration = migrations[0];
    assert.equal(initialMigration?.version, "001");

    await client.query("BEGIN");
    await client.query(initialMigration.sql);
    await client.query("COMMIT");

    await client.query(
      `INSERT INTO categories (name, description)
       VALUES ('Migration preservation fixture', 'Existing row')`,
    );

    const appliedVersions = await runMigrations(client, migrationsDirectory);
    assert.deepEqual(appliedVersions, ["002"]);

    const category = await client.query(
      `SELECT description
       FROM categories
       WHERE name = 'Migration preservation fixture'`,
    );
    assert.equal(category.rows[0]?.description, "Existing row");

    const history = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    assert.deepEqual(
      history.rows.map((row) => row.version),
      ["001", "002"],
    );
  } finally {
    client.release(true);
  }
});

test("leaves a database already at version 002 unchanged", async () => {
  const { client } = await openIsolatedSchema();

  try {
    await runMigrations(client, migrationsDirectory);
    await client.query(
      `INSERT INTO categories (name, description)
       VALUES ('Already migrated fixture', 'Must remain')`,
    );

    const before = await client.query(
      "SELECT version, description, applied_at FROM schema_migrations ORDER BY version",
    );
    const appliedVersions = await runMigrations(client, migrationsDirectory);
    const afterRun = await client.query(
      "SELECT version, description, applied_at FROM schema_migrations ORDER BY version",
    );
    const category = await client.query(
      `SELECT description
       FROM categories
       WHERE name = 'Already migrated fixture'`,
    );

    assert.deepEqual(appliedVersions, []);
    assert.deepEqual(afterRun.rows, before.rows);
    assert.equal(category.rows[0]?.description, "Must remain");
  } finally {
    client.release(true);
  }
});

test("rolls back schema and migration history when a migration fails", async () => {
  const { client } = await openIsolatedSchema();
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "stockflow-migration-failure-"),
  );

  try {
    await client.query(
      `CREATE TABLE schema_migrations (
         version VARCHAR(100) PRIMARY KEY,
         description TEXT NOT NULL,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    await writeFile(
      path.join(temporaryDirectory, "001_force_failure.sql"),
      `CREATE TABLE migration_failure_marker (id INTEGER);
       INSERT INTO schema_migrations (version, description)
       VALUES ('001', 'Intentional test failure');
       SELECT 1 / 0;`,
    );

    await assert.rejects(
      runMigrations(client, temporaryDirectory),
      /division by zero/,
    );

    const marker = await client.query(
      "SELECT to_regclass('migration_failure_marker') IS NOT NULL AS exists",
    );
    const history = await client.query("SELECT version FROM schema_migrations");
    assert.equal(marker.rows[0]?.exists, false);
    assert.deepEqual(history.rows, []);
  } finally {
    client.release(true);
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("serializes concurrent migration runners with an advisory lock", async () => {
  const { client: firstClient, schemaName } = await openIsolatedSchema();
  const secondClient = await pool.connect();

  try {
    await secondClient.query(`SET search_path TO ${schemaName}`);

    const [firstResult, secondResult] = await Promise.all([
      runMigrations(firstClient, migrationsDirectory),
      runMigrations(secondClient, migrationsDirectory),
    ]);

    assert.equal(firstResult.length + secondResult.length, 2);
    assert.ok(
      firstResult.length === 0 || secondResult.length === 0,
      `Expected one runner to wait and see the completed migration history. First=${firstResult} Second=${secondResult}`,
    );

    const history = await firstClient.query(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    assert.deepEqual(
      history.rows.map((row) => row.version),
      ["001", "002"],
    );
  } finally {
    firstClient.release(true);
    secondClient.release(true);
  }
});

test("rejects malformed or non-contiguous migration filenames", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "stockflow-migration-discovery-"),
  );

  try {
    await writeFile(
      path.join(temporaryDirectory, "not-a-version.sql"),
      "SELECT 1;",
    );
    await assert.rejects(
      discoverMigrations(temporaryDirectory),
      /Invalid migration filename/,
    );

    await rm(temporaryDirectory, { recursive: true, force: true });
    await mkdir(temporaryDirectory);
    await writeFile(
      path.join(temporaryDirectory, "001_create_one.sql"),
      "SELECT 1;",
    );
    await writeFile(
      path.join(temporaryDirectory, "003_create_three.sql"),
      "SELECT 1;",
    );
    await assert.rejects(
      discoverMigrations(temporaryDirectory),
      /must be contiguous/,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
