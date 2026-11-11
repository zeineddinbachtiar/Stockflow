
import test, { after } from "node:test";
import assert from "node:assert/strict";

import request from "supertest";

import { env } from "../../src/config/env";
import { pool } from "../../src/config/database";
import app from "../../src/app";

// Close the database connection pool after this test file.
after(async () => {
  await pool.end();
});

test("environment uses the isolated test database", () => {
  assert.equal(env.NODE_ENV, "test");
  assert.equal(env.DB_NAME, "stockflow_test_db");
  assert.notEqual(env.DB_NAME, "stockflow_db");
});

test("PostgreSQL connects to stockflow_test_db", async () => {
  const result = await pool.query<{
    database_name: string;
  }>(
    "SELECT current_database() AS database_name"
  );

  assert.equal(
    result.rows[0]?.database_name,
    "stockflow_test_db"
  );
});

test("health endpoint returns HTTP 200", async () => {
  const response = await request(app)
    .get("/api/v1/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");

  assert.equal(
    response.body.message,
    "StockFlow API is running"
  );

  assert.equal(
    typeof response.body.timestamp,
    "string"
  );
});
