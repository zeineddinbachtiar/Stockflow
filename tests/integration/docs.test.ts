import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";

test("OpenAPI endpoint exposes the complete API specification", async () => {
  const response = await request(app).get("/api/v1/openapi.json");

  assert.equal(response.status, 200);
  assert.equal(response.body.openapi, "3.1.0");
  assert.equal(response.body.info.title, "StockFlow API");

  const paths = response.body.paths as Record<string, Record<string, unknown>>;

  assert.equal(Object.keys(paths).length, 28);

  const operationCount = Object.values(paths).reduce(
    (total, pathItem) => total + Object.keys(pathItem).length,
    0,
  );

  assert.equal(operationCount, 38);

  assert.ok(paths["/orders/{id}/confirm"]);
  assert.ok(paths["/inventory/receipts"]);
  assert.ok(paths["/stock-movements"]);

  assert.equal(
    response.body.components.securitySchemes.bearerAuth.scheme,
    "bearer",
  );
});

test("Scalar documentation endpoint returns HTML with a valid CSP nonce", async () => {
  const response = await request(app).get("/api/v1/docs");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/html/);

  const csp = response.headers["content-security-policy"] as string;

  assert.ok(csp);
  assert.ok(csp.includes("https://cdn.jsdelivr.net"));

  const nonce = response.text.match(/nonce="([^"]+)"/)?.[1];

  assert.ok(nonce, "Scalar HTML should include a CSP nonce.");

  assert.ok(
    csp.includes(`'nonce-${nonce}'`),
    "The CSP header must authorize the nonce used by Scalar.",
  );

  assert.equal(response.headers["cache-control"], "no-store");
});
