import express from "express";
import jwt from "jsonwebtoken";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";
import { AppError } from "../../src/errors/app-error";
import { errorHandler } from "../../src/middlewares/error-handler";
import { env } from "../../src/config/env";
import { pool } from "../../src/config/database";

function createErrorProbeApp(error: unknown) {
  const probeApp = express();

  probeApp.get("/probe", (_req, _res, next) => {
    next(error);
  });

  probeApp.use(errorHandler);

  return probeApp;
}

function createTestToken(
  options: {
    issuer?: string;
    audience?: string;
    expiresIn?: number;
  } = {},
): string {
  return jwt.sign(
    {
      role: "ADMIN",
    },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      subject: "1",
      expiresIn: options.expiresIn ?? 300,
      issuer: options.issuer ?? "stockflow-api",
      audience: options.audience ?? "stockflow-client",
    },
  );
}

after(async () => {
  await pool.end();
});

// --------------------------------------------------
// 1. APPLICATION ERROR
// --------------------------------------------------

test("AppError returns its HTTP status, code, message, and details", async () => {
  const probeApp = createErrorProbeApp(
    new AppError(422, "TEST_VALIDATION_ERROR", "Test validation failed.", [
      {
        field: "sku",
        message: "SKU is invalid.",
      },
    ]),
  );

  const response = await request(probeApp).get("/probe");

  assert.equal(response.status, 422);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.code, "TEST_VALIDATION_ERROR");
  assert.equal(response.body.message, "Test validation failed.");

  assert.deepEqual(response.body.errors, [
    {
      field: "sku",
      message: "SKU is invalid.",
    },
  ]);
});

// --------------------------------------------------
// 2. INVALID JSON
// --------------------------------------------------

test("invalid JSON request body returns HTTP 400 INVALID_JSON", async () => {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .set("Content-Type", "application/json")
    .send("{ invalid json");

  assert.equal(response.status, 400);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.code, "INVALID_JSON");
  assert.equal(response.body.message, "Request body contains invalid JSON.");
});

// --------------------------------------------------
// 3. UNKNOWN ROUTE
// --------------------------------------------------

test("unknown route returns HTTP 404 ROUTE_NOT_FOUND", async () => {
  const response = await request(app).get(
    "/api/v1/__test__/route-that-does-not-exist",
  );

  assert.equal(response.status, 404);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.code, "ROUTE_NOT_FOUND");
  assert.match(response.body.message, /Route GET .* was not found\./);
});

// --------------------------------------------------
// 4. PAYLOAD TOO LARGE
// --------------------------------------------------

test("request body exceeding JSON parser limit returns HTTP 413", async () => {
  const largePayload = JSON.stringify({
    data: "x".repeat(110 * 1024),
  });

  const response = await request(app)
    .post("/api/v1/auth/register")
    .set("Content-Type", "application/json")
    .send(largePayload);

  assert.equal(response.status, 413);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.code, "PAYLOAD_TOO_LARGE");
  assert.equal(response.body.message, "Request body is too large.");
});

// --------------------------------------------------
// 5. POSTGRESQL SQLSTATE MAPPING
// --------------------------------------------------

test("PostgreSQL 23505 maps to DUPLICATE_RESOURCE", async () => {
  const postgresError = Object.assign(
    new Error("simulated duplicate key violation"),
    {
      code: "23505",
    },
  );

  const probeApp = createErrorProbeApp(postgresError);

  const response = await request(probeApp).get("/probe");

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "DUPLICATE_RESOURCE");
  assert.equal(
    response.body.message,
    "A resource with the same unique value already exists.",
  );
});

test("PostgreSQL 23503 maps to RELATED_RESOURCE_CONFLICT", async () => {
  const postgresError = Object.assign(
    new Error("simulated foreign key violation"),
    {
      code: "23503",
    },
  );

  const probeApp = createErrorProbeApp(postgresError);

  const response = await request(probeApp).get("/probe");

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "RELATED_RESOURCE_CONFLICT");
});

test("PostgreSQL 23514 maps to DATA_CONSTRAINT_VIOLATION", async () => {
  const postgresError = Object.assign(
    new Error("simulated check constraint violation"),
    {
      code: "23514",
    },
  );

  const probeApp = createErrorProbeApp(postgresError);

  const response = await request(probeApp).get("/probe");

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "DATA_CONSTRAINT_VIOLATION");
});

test("PostgreSQL 22P02 maps to INVALID_DATABASE_VALUE", async () => {
  const postgresError = Object.assign(
    new Error("simulated invalid text representation"),
    {
      code: "22P02",
    },
  );

  const probeApp = createErrorProbeApp(postgresError);

  const response = await request(probeApp).get("/probe");

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_DATABASE_VALUE");
  assert.equal(
    response.body.message,
    "One or more request values are invalid.",
  );
});

// --------------------------------------------------
// 6. JWT EXPIRATION AND CLAIM VALIDATION
// --------------------------------------------------

test("expired JWT returns HTTP 401 INVALID_ACCESS_TOKEN", async () => {
  const expiredToken = createTestToken({
    expiresIn: -60,
  });

  const response = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", `Bearer ${expiredToken}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_ACCESS_TOKEN");
  assert.equal(response.body.message, "Access token is invalid or expired.");
});

test("JWT with an incorrect issuer is rejected", async () => {
  const invalidIssuerToken = createTestToken({
    issuer: "another-api",
  });

  const response = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", `Bearer ${invalidIssuerToken}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_ACCESS_TOKEN");
});

test("JWT with an incorrect audience is rejected", async () => {
  const invalidAudienceToken = createTestToken({
    audience: "another-client",
  });

  const response = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", `Bearer ${invalidAudienceToken}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_ACCESS_TOKEN");
});
