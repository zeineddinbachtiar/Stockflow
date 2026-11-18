import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { runMigrations } from "./migration-runner.mjs";

const { Client } = pg;
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const migrationsDirectory = path.join(projectRoot, "database", "migrations");

const dotenvResult = dotenv.config({
  path: path.join(projectRoot, ".env"),
});

if (dotenvResult.error && dotenvResult.error.code !== "ENOENT") {
  throw dotenvResult.error;
}

const requiredVariables = ["DB_NAME", "DB_USER", "DB_PASSWORD"];
const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing database configuration: ${missingVariables.join(", ")}`,
  );
}

const client = new Client({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5_000,
  application_name: "stockflow-db-migrate",
});

let connected = false;

try {
  await client.connect();
  connected = true;

  const identity = await client.query(
    "SELECT current_database() AS database_name",
  );

  if (identity.rows[0]?.database_name !== process.env.DB_NAME) {
    throw new Error("Connected database does not match DB_NAME.");
  }

  const appliedVersions = await runMigrations(client, migrationsDirectory, {
    log: (message) => console.log(`[DB MIGRATE] ${message}`),
  });

  if (appliedVersions.length === 0) {
    console.log("[DB MIGRATE] Database is already up to date.");
  } else {
    console.log(
      `[DB MIGRATE] Applied versions: ${appliedVersions.join(", ")}.`,
    );
  }
} catch (error) {
  console.error(
    "[DB MIGRATE] Migration failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  if (connected) {
    await client.end();
  }
}
