import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";
import { env } from "../../src/config/env";
import express from "express";
import { createRateLimitMiddleware } from "../../src/middlewares/rate-limit";

test("CORS allows configured origins", async () => {
  const allowedOrigin = env.CORS_ALLOWED_ORIGINS[0];

  assert.ok(allowedOrigin);

  const response = await request(app)
    .get("/api/v1/health")
    .set("Origin", allowedOrigin);

  assert.equal(response.status, 200);
  assert.equal(response.headers["access-control-allow-origin"], allowedOrigin);
});

test("CORS does not expose responses to unapproved origins", async () => {
  const disallowedOrigin = `https://${randomUUID()}.example`;

  assert.ok(!env.CORS_ALLOWED_ORIGINS.includes(disallowedOrigin));

  const response = await request(app)
    .get("/api/v1/health")
    .set("Origin", disallowedOrigin);

  // CORS does not replace API authentication or authorization.
  // The server can respond, but the browser cannot read the response
  // because Access-Control-Allow-Origin is not provided.
  assert.equal(response.status, 200);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
});

test("Helmet sets default security headers", async () => {
  const response = await request(app).get("/api/v1/health");

  assert.equal(response.status, 200);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
});

test("rate limiter returns HTTP 429 after the configured request limit", async () => {
  const limiter = createRateLimitMiddleware({
    windowMs: 60_000,
    limit: 2,
    message: "Too many test requests.",
    skipInTest: false,
  });

  const rateLimitTestApp = express();

  rateLimitTestApp.get("/limited", limiter, (_req, res) => {
    res.status(200).json({
      status: "success",
      message: "Request allowed.",
    });
  });

  const firstRequest = await request(rateLimitTestApp).get("/limited");

  const secondRequest = await request(rateLimitTestApp).get("/limited");

  const thirdRequest = await request(rateLimitTestApp).get("/limited");

  assert.equal(firstRequest.status, 200);
  assert.equal(secondRequest.status, 200);

  assert.equal(thirdRequest.status, 429);
  assert.equal(thirdRequest.body.status, "error");
  assert.equal(thirdRequest.body.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(thirdRequest.body.message, "Too many test requests.");
  assert.ok(thirdRequest.headers["retry-after"]);
});
test("Express trusts only the configured number of proxy hops", () => {
  assert.equal(app.get("trust proxy"), env.TRUST_PROXY_HOPS);

  assert.equal(typeof env.TRUST_PROXY_HOPS, "number");
});
