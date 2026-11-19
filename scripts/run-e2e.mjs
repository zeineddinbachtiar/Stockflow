import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";
import { runMigrations } from "./migration-runner.mjs";
import {
  stopProcessTree,
  trackChildProcess,
  WindowsJobManager,
} from "./process-tree.mjs";

const { Client } = pg;
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const E2E_DATABASE_NAME = "stockflow_test_db";
const E2E_SCHEMA_PREFIX = "stockflow_e2e_";
const E2E_SCHEMA_NAME = `${E2E_SCHEMA_PREFIX}${randomUUID().replaceAll("-", "")}`;
const E2E_API_PORT = "3301";
const E2E_WEB_PORT = "5181";
const API_BASE_URL = `http://127.0.0.1:${E2E_API_PORT}/api/v1`;
const WEB_BASE_URL = `http://127.0.0.1:${E2E_WEB_PORT}`;
const E2E_SCHEMA_MAX_LENGTH = 63;
const GLOBAL_SHUTDOWN_TIMEOUT_MS = 30_000;
const processRecords = [];

let shutdownSignal;
let shutdownPromise;
let runnerExitCode = 1;
let windowsJobManager;

if (
  !/^stockflow_e2e_[0-9a-f]{32}$/.test(E2E_SCHEMA_NAME) ||
  Buffer.byteLength(E2E_SCHEMA_NAME, "utf8") > E2E_SCHEMA_MAX_LENGTH
) {
  throw new Error("Generated E2E schema name is invalid.");
}

dotenv.config({ path: path.join(projectRoot, ".env") });

if (process.env.NODE_ENV === "production") {
  throw new Error("E2E tests are disabled in production.");
}

for (const name of [
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
  "SEED_ADMIN_PASSWORD",
  "SEED_WAREHOUSE_PASSWORD",
  "SEED_SALES_PASSWORD",
]) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing E2E configuration: ${name}.`);
  }
}

process.env.NODE_ENV = "test";
process.env.DB_NAME = E2E_DATABASE_NAME;
process.env.E2E_SCHEMA_NAME = E2E_SCHEMA_NAME;
process.env.STOCKFLOW_E2E_RUNNER = "1";
process.env.DB_HOST ||= "localhost";
process.env.DB_PORT ||= "5432";
process.env.PGOPTIONS = `-c search_path=${E2E_SCHEMA_NAME}`;

const apiEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  DB_NAME: E2E_DATABASE_NAME,
  E2E_SCHEMA_NAME,
  STOCKFLOW_E2E_RUNNER: "1",
  PORT: E2E_API_PORT,
  CORS_ALLOWED_ORIGINS: WEB_BASE_URL,
  PGOPTIONS: process.env.PGOPTIONS,
};

const frontendEnvironment = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
  NODE_ENV: "development",
  VITE_API_BASE_URL: API_BASE_URL,
};

function createDatabaseClient(useE2ESchema = false) {
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: E2E_DATABASE_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
    application_name: "stockflow-e2e-runner",
    ...(useE2ESchema ? { options: process.env.PGOPTIONS } : {}),
  });
}

async function assertDatabaseIdentity(client, expectedSchema) {
  const result = await client.query(
    "SELECT current_database() AS database_name, current_schema() AS schema_name",
  );
  const databaseName = result.rows[0]?.database_name;
  const schemaName = result.rows[0]?.schema_name;

  if (databaseName !== E2E_DATABASE_NAME || databaseName === "stockflow_db") {
    throw new Error("E2E database guard rejected the connected database.");
  }

  if (expectedSchema && schemaName !== expectedSchema) {
    throw new Error("E2E schema guard rejected the connected schema.");
  }

  return { databaseName, schemaName };
}

async function provisionE2ESchema(onSchemaCreated, preparedSeed) {
  const setupClient = createDatabaseClient();

  try {
    await setupClient.connect();
    assertRunIsNotInterrupted();
    const identity = await assertDatabaseIdentity(setupClient);
    console.log(`[E2E] Verified isolated database: ${identity.databaseName}.`);

    const staleSchemas = await setupClient.query(
      `SELECT schema_name
       FROM information_schema.schemata
       WHERE left(schema_name, length($1)) = $1
       ORDER BY schema_name`,
      [E2E_SCHEMA_PREFIX],
    );
    if (staleSchemas.rowCount > 0) {
      console.warn(
        `[E2E] Found ${staleSchemas.rowCount} prior E2E schema(s); leaving them untouched: ${JSON.stringify(
          staleSchemas.rows.map((row) => row.schema_name),
        )}.`,
      );
    }

    const existingSchema = await setupClient.query(
      "SELECT 1 FROM information_schema.schemata WHERE schema_name = $1",
      [E2E_SCHEMA_NAME],
    );
    if (existingSchema.rowCount !== 0) {
      throw new Error(
        `E2E schema "${E2E_SCHEMA_NAME}" already exists; refusing to reuse or remove it.`,
      );
    }

    const createSchema = await setupClient.query(
      "SELECT format('CREATE SCHEMA %I AUTHORIZATION %I', $1::text, $2::text) AS command",
      [E2E_SCHEMA_NAME, process.env.DB_USER],
    );
    await setupClient.query(createSchema.rows[0].command);
    onSchemaCreated(E2E_SCHEMA_NAME);
  } finally {
    await setupClient.end();
  }
  assertRunIsNotInterrupted();

  const migrationClient = createDatabaseClient(true);

  try {
    await migrationClient.connect();
    assertRunIsNotInterrupted();
    const identity = await assertDatabaseIdentity(
      migrationClient,
      E2E_SCHEMA_NAME,
    );
    console.log(`[E2E] Preparing isolated schema: ${identity.schemaName}.`);
    await runMigrations(
      migrationClient,
      path.join(projectRoot, "database", "migrations"),
      { log: (message) => console.log(`[E2E DB] ${message}`) },
    );
    assertRunIsNotInterrupted();
  } finally {
    await migrationClient.end();
  }

  const seed =
    preparedSeed ??
    (await startProcess(
      "Database seed",
      process.execPath,
      ["--import=tsx", "src/scripts/seed.ts"],
      apiEnvironment,
    ));
  if (preparedSeed) {
    assertRunIsNotInterrupted();
    await windowsJobManager.resumeProcess(seed);
  }

  const seedExit = await seed.terminationPromise;
  assertRunIsNotInterrupted();
  if (seed.processError || seedExit.code !== 0) {
    throw new Error(
      `E2E schema seeding failed with exit code ${seedExit.code ?? "unknown"}.`,
    );
  }

  const verifyClient = createDatabaseClient(true);
  try {
    await verifyClient.connect();
    assertRunIsNotInterrupted();
    await assertDatabaseIdentity(verifyClient, E2E_SCHEMA_NAME);
    const requiredTables = await verifyClient.query(
      `SELECT count(*)::int AS table_count
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_name = ANY($2::text[])`,
      [
        E2E_SCHEMA_NAME,
        [
          "schema_migrations",
          "users",
          "auth_sessions",
          "categories",
          "products",
          "warehouses",
          "inventory",
          "customers",
          "orders",
          "order_items",
          "stock_movements",
        ],
      ],
    );
    if (requiredTables.rows[0]?.table_count !== 11) {
      throw new Error("E2E migration schema verification failed.");
    }
    assertRunIsNotInterrupted();
  } finally {
    await verifyClient.end();
  }
}

async function removeE2ESchema(schemaName) {
  if (
    schemaName !== E2E_SCHEMA_NAME ||
    !/^stockflow_e2e_[0-9a-f]{32}$/.test(schemaName) ||
    Buffer.byteLength(schemaName, "utf8") > E2E_SCHEMA_MAX_LENGTH
  ) {
    throw new Error("Refusing to remove an invalid E2E schema.");
  }

  const client = createDatabaseClient();

  try {
    await client.connect();
    await assertDatabaseIdentity(client);
    const result = await client.query(
      "SELECT format('DROP SCHEMA %I CASCADE', $1::text) AS command",
      [schemaName],
    );
    await client.query(result.rows[0].command);
    console.log(`[E2E] Removed isolated schema: ${schemaName}.`);
  } finally {
    await client.end();
  }
}

async function startProcess(name, command, args, env, cwd = projectRoot) {
  assertRunIsNotInterrupted();
  if (process.platform === "win32") {
    if (!windowsJobManager) {
      throw new Error("Windows Job Object containment is not initialized.");
    }
    return windowsJobManager.startProcess(name, command, args, env, cwd);
  }

  const startedAt = Date.now();
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: "inherit",
    detached: process.platform !== "win32",
    windowsHide: true,
  });

  const state = trackChildProcess(
    name,
    child,
    (message) => {
      console.error(`[E2E] ${message}`);
    },
    startedAt,
  );
  processRecords.push(state);
  return state;
}

async function resumeOrStartProcess(
  name,
  command,
  args,
  env,
  preparedProcess,
  cwd = projectRoot,
) {
  assertRunIsNotInterrupted();
  if (preparedProcess) {
    return windowsJobManager.resumeProcess(preparedProcess);
  }
  return startProcess(name, command, args, env, cwd);
}

function assertRunIsNotInterrupted() {
  if (shutdownSignal) {
    throw new Error(`E2E runner interrupted by ${shutdownSignal}.`);
  }
}

async function waitForReady(name, url, state, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "no response";

  while (Date.now() < deadline) {
    assertRunIsNotInterrupted();
    if (state.processError || state.exitInfo) {
      throw new Error(
        `${name} exited before readiness (code ${
          state.exitInfo?.code ?? "unknown"
        }).`,
      );
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        console.log(`[E2E] ${name} is ready.`);
        return;
      }
      lastStatus = `HTTP ${response.status}`;
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : "connection failed";
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  assertRunIsNotInterrupted();
  throw new Error(`${name} readiness timed out (${lastStatus}).`);
}

function stopAllChildProcesses() {
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      const deadline = Date.now() + GLOBAL_SHUTDOWN_TIMEOUT_MS;
      if (process.platform === "win32") {
        if (windowsJobManager) await windowsJobManager.shutdown(deadline);
        return;
      }

      const failures = [];
      for (const state of [...processRecords].reverse()) {
        try {
          await stopProcessTree(state, {
            deadline,
            onWarning: (message) => console.warn(`[E2E] ${message}`),
          });
        } catch (error) {
          failures.push(
            `${state.name}: ${
              error instanceof Error ? error.message : "Unknown error."
            }`,
          );
        }
      }

      if (failures.length > 0) {
        throw new Error(failures.join("; "));
      }
    })();
  }

  return shutdownPromise;
}

async function runE2ETests() {
  let schemaCreated = false;
  let ownedSchema;
  let testExitCode = 1;
  let windowsProcesses;

  try {
    assertRunIsNotInterrupted();
    if (process.platform === "win32") {
      windowsJobManager = new WindowsJobManager({
        cwd: projectRoot,
        env: process.env,
      });
      await windowsJobManager.start();
      console.log("[E2E] Windows Job Object containment is ready.");

      const playwrightCli = path.join(
        projectRoot,
        "node_modules",
        "@playwright",
        "test",
        "cli.js",
      );
      windowsProcesses = {
        seed: await windowsJobManager.prepareProcess(
          "Database seed",
          process.execPath,
          ["--import=tsx", "src/scripts/seed.ts"],
          apiEnvironment,
        ),
        api: await windowsJobManager.prepareProcess(
          "API",
          process.execPath,
          ["--import=tsx", "src/server.ts"],
          apiEnvironment,
        ),
        frontend: await windowsJobManager.prepareProcess(
          "Vite",
          process.execPath,
          [
            "node_modules/vite/bin/vite.js",
            "--host",
            "127.0.0.1",
            "--port",
            E2E_WEB_PORT,
            "--strictPort",
          ],
          frontendEnvironment,
          path.join(projectRoot, "frontend"),
        ),
        playwright: await windowsJobManager.prepareProcess(
          "Playwright",
          process.execPath,
          [playwrightCli, "test", "--workers=1", ...process.argv.slice(2)],
          apiEnvironment,
        ),
      };
    }

    await provisionE2ESchema(() => {
      schemaCreated = true;
      ownedSchema = E2E_SCHEMA_NAME;
    }, windowsProcesses?.seed);

    assertRunIsNotInterrupted();
    const apiServer = await resumeOrStartProcess(
      "API",
      process.execPath,
      ["--import=tsx", "src/server.ts"],
      apiEnvironment,
      windowsProcesses?.api,
    );
    const frontendServer = await resumeOrStartProcess(
      "Vite",
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        E2E_WEB_PORT,
        "--strictPort",
      ],
      frontendEnvironment,
      windowsProcesses?.frontend,
      path.join(projectRoot, "frontend"),
    );

    await waitForReady("API", `${API_BASE_URL}/ready`, apiServer);
    await waitForReady("Frontend", `${WEB_BASE_URL}/login`, frontendServer);

    assertRunIsNotInterrupted();
    const playwrightCli = path.join(
      projectRoot,
      "node_modules",
      "@playwright",
      "test",
      "cli.js",
    );
    const testProcess = await resumeOrStartProcess(
      "Playwright",
      process.execPath,
      [playwrightCli, "test", "--workers=1", ...process.argv.slice(2)],
      apiEnvironment,
      windowsProcesses?.playwright,
    );

    const testExit = await testProcess.terminationPromise;
    assertRunIsNotInterrupted();
    if (testProcess.processError) {
      throw new Error(
        `Playwright process failed: ${testProcess.processError.message}`,
      );
    }
    testExitCode = testExit.code ?? 1;
  } catch (error) {
    if (shutdownSignal) {
      console.warn(`[E2E] Shutdown requested by ${shutdownSignal}.`);
    } else {
      console.error(
        "[E2E] Run failed:",
        error instanceof Error ? error.message : "Unexpected error.",
      );
    }
  } finally {
    let processesStopped = false;
    try {
      await stopAllChildProcesses();
      processesStopped = true;
    } catch (error) {
      console.error(
        "[E2E] Could not confirm all child process trees stopped:",
        error instanceof Error ? error.message : "Unexpected error.",
      );
      testExitCode = 1;
    }

    if (schemaCreated) {
      if (!processesStopped) {
        console.error(
          `[E2E] Retaining ${ownedSchema}; process termination was not confirmed.`,
        );
        testExitCode = 1;
      } else {
        try {
          await removeE2ESchema(ownedSchema);
        } catch (error) {
          console.error(
            "[E2E] Isolated schema cleanup failed:",
            error instanceof Error ? error.message : "Unexpected error.",
          );
          testExitCode = 1;
        }
      }
    }
  }

  runnerExitCode = shutdownSignal
    ? shutdownSignal === "SIGINT"
      ? 130
      : 143
    : testExitCode;
}

function handleShutdownSignal(signal) {
  if (shutdownSignal) return;

  shutdownSignal = signal;
  console.warn(`[E2E] Received ${signal}; stopping managed process trees.`);
  void stopAllChildProcesses().catch((error) => {
    console.error(
      "[E2E] Signal shutdown failed:",
      error instanceof Error ? error.message : "Unexpected error.",
    );
  });
}

process.on("SIGINT", handleShutdownSignal);
process.on("SIGTERM", handleShutdownSignal);

runE2ETests()
  .catch((error) => {
    console.error(
      "[E2E] Runner failed:",
      error instanceof Error ? error.message : "Unexpected error.",
    );
    runnerExitCode = 1;
  })
  .finally(() => {
    process.off("SIGINT", handleShutdownSignal);
    process.off("SIGTERM", handleShutdownSignal);
    process.exitCode =
      shutdownSignal === "SIGINT"
        ? 130
        : shutdownSignal === "SIGTERM"
          ? 143
          : runnerExitCode;
  });
