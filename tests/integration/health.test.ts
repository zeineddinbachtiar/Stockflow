import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

import app from "../../src/app";
import { createReadinessHandler } from "../../src/controllers/health.controller";
import { getSafeErrorMetadata } from "../../src/utils/logger";

test("readiness endpoint returns HTTP 200 when database is available", async () => {
  const response = await request(app).get("/api/v1/ready");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");
  assert.equal(response.body.message, "StockFlow API is ready.");
  assert.equal(response.body.checks.database, "ok");
  assert.ok(response.body.timestamp);
});

test("readiness endpoint returns HTTP 503 when database is unavailable", async () => {
  const readinessTestApp = express();

  readinessTestApp.get(
    "/ready",
    createReadinessHandler(async () => {
      throw new Error("Sensitive database connection details.");
    }),
  );

  const response = await request(readinessTestApp).get("/ready");

  assert.equal(response.status, 503);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.code, "SERVICE_UNAVAILABLE");
  assert.equal(response.body.message, "StockFlow API is not ready.");
  assert.equal(response.body.checks.database, "unavailable");

  assert.ok(
    !JSON.stringify(response.body).includes(
      "Sensitive database connection details.",
    ),
  );
});

test("API responses include unique request IDs", async () => {
  const firstResponse = await request(app).get("/api/v1/health");
  const secondResponse = await request(app).get("/api/v1/health");

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);

  const firstRequestId = String(firstResponse.headers["x-request-id"] ?? "");

  const secondRequestId = String(secondResponse.headers["x-request-id"] ?? "");

  assert.match(
    firstRequestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  assert.match(
    secondRequestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  assert.notEqual(firstRequestId, secondRequestId);
});

test("error logging metadata does not expose sensitive error messages", () => {
  const error = Object.assign(
    new Error("Sensitive database password information."),
    { code: "23505" },
  );

  const metadata = getSafeErrorMetadata(error);

  assert.deepEqual(metadata, {
    errorName: "Error",
    errorCode: "23505",
  });

  assert.ok(
    !JSON.stringify(metadata).includes(
      "Sensitive database password information.",
    ),
  );
});
