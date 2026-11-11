import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const TEST_DATABASE_NAME = "stockflow_test_db";

const REQUIRED_TABLES = [
  "schema_migrations",
  "users",
  "categories",
  "products",
  "warehouses",
  "inventory",
  "customers",
  "orders",
  "order_items",
  "stock_movements",
];

async function prepareTestDatabase() {
  // Load local environment configuration.
  const dotenvResult = dotenv.config({
    path: path.join(projectRoot, ".env"),
  });

  if (dotenvResult.error && dotenvResult.error.code !== "ENOENT") {
    throw dotenvResult.error;
  }

  // Refuse to prepare a test database from production mode.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Test database setup is disabled in production.");
  }

  const requiredVariables = [
    "DB_USER",
    "DB_PASSWORD",
    "JWT_SECRET",
    "SEED_ADMIN_PASSWORD",
    "SEED_WAREHOUSE_PASSWORD",
    "SEED_SALES_PASSWORD",
  ];

  const missingVariables = requiredVariables.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing test configuration: ${missingVariables.join(", ")}`,
    );
  }

  if (process.env.JWT_SECRET.length < 64) {
    throw new Error("JWT_SECRET must contain at least 64 characters.");
  }

  for (const name of [
    "SEED_ADMIN_PASSWORD",
    "SEED_WAREHOUSE_PASSWORD",
    "SEED_SALES_PASSWORD",
  ]) {
    if (process.env[name].length < 12) {
      throw new Error(`${name} must contain at least 12 characters.`);
    }
  }

  // Force the dedicated test environment.
  process.env.NODE_ENV = "test";
  process.env.DB_NAME = TEST_DATABASE_NAME;
  process.env.DB_HOST ||= "localhost";
  process.env.DB_PORT ||= "5432";

  console.log("\n[TEST DB] Checking database connection...");
  console.log(`[TEST DB] Target: ${TEST_DATABASE_NAME}`);

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: TEST_DATABASE_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
    application_name: "stockflow-test-db-setup",
  });

  let connected = false;

  try {
    await client.connect();
    connected = true;

    // Confirm the actual connected database.
    const identityResult = await client.query(
      "SELECT current_database() AS database_name",
    );

    if (identityResult.rows[0]?.database_name !== TEST_DATABASE_NAME) {
      throw new Error("Connected database does not match the test database.");
    }

    // Check whether the migration history table exists.
    const migrationTableResult = await client.query(
      "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists",
    );

    const migrationTableExists = migrationTableResult.rows[0]?.exists === true;

    if (!migrationTableExists) {
      // Refuse to apply an initial migration over an unknown schema.
      const existingTables = await client.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'`,
      );

      if (existingTables.rowCount > 0) {
        throw new Error(
          "Test database contains tables but has no schema_migrations table. Inspect the database manually before continuing.",
        );
      }

      console.log("[TEST DB] Applying initial migration...");

      const migrationPath = path.join(
        projectRoot,
        "database",
        "migrations",
        "001_create_stockflow_schema.sql",
      );

      const migrationSql = await readFile(migrationPath, "utf8");

      await client.query(migrationSql);

      console.log("[TEST DB] Migration 001 applied.");
    }

    // Verify the initial migration was recorded.
    const migrationResult = await client.query(
      `SELECT version
       FROM schema_migrations
       WHERE version = $1`,
      ["001"],
    );

    if (migrationResult.rowCount !== 1) {
      throw new Error("Migration 001 is not recorded in schema_migrations.");
    }

    // Verify all required tables exist.
    const tablesResult = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );

    const existingTableNames = new Set(
      tablesResult.rows.map((row) => row.table_name),
    );

    const missingTables = REQUIRED_TABLES.filter(
      (name) => !existingTableNames.has(name),
    );

    if (missingTables.length > 0) {
      throw new Error(
        `Test database is missing tables: ${missingTables.join(", ")}`,
      );
    }

    console.log("[TEST DB] Migration and schema verified.");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "3D000"
    ) {
      throw new Error(
        `Database "${TEST_DATABASE_NAME}" does not exist. Create it once using a PostgreSQL administrator, then run this setup again.`,
        { cause: error },
      );
    }

    throw error;
  } finally {
    if (connected) {
      await client.end();
    }
  }

  // Seed only after migration verification succeeds.
  console.log("\n[TEST DB] Preparing test fixtures...");

  const seedResult = spawnSync(
    process.execPath,
    ["--import=tsx", "src/scripts/seed.ts"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DB_NAME: TEST_DATABASE_NAME,
      },
      stdio: "inherit",
    },
  );

  if (seedResult.error) {
    throw seedResult.error;
  }

  if (seedResult.status !== 0) {
    throw new Error(
      `Test database seeding failed with exit code ${seedResult.status}.`,
    );
  }

  console.log("\n[TEST DB] Test database is ready.");
}

prepareTestDatabase().catch((error) => {
  console.error(
    "\n[TEST DB] Setup failed:",
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
});
