import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";

interface OpenApiOperation {
  security?: unknown[];
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: { $ref: string };
      };
    };
  };
  responses: Record<
    string,
    {
      $ref?: string;
      content?: {
        "application/json"?: {
          schema: { $ref: string };
        };
      };
    }
  >;
}

interface AuthOpenApiDocument {
  paths: Record<string, { post?: OpenApiOperation }>;
  components: {
    schemas: Record<string, Record<string, unknown>>;
  };
}

interface ProductListOpenApiDocument {
  paths: Record<
    string,
    {
      get?: {
        parameters?: Array<{
          name: string;
          in: string;
          required?: boolean;
          description?: string;
          schema?: Record<string, unknown>;
        }>;
      };
    }
  >;
}

test("OpenAPI endpoint exposes the complete API specification", async () => {
  const response = await request(app).get("/api/v1/openapi.json");

  assert.equal(response.status, 200);
  assert.equal(response.body.openapi, "3.1.0");
  assert.equal(response.body.info.title, "StockFlow API");

  const paths = response.body.paths as Record<string, Record<string, unknown>>;

  assert.equal(Object.keys(paths).length, 31);

  const operationCount = Object.values(paths).reduce(
    (total, pathItem) => total + Object.keys(pathItem).length,
    0,
  );

  assert.equal(operationCount, 41);

  assert.ok(paths["/orders/{id}/confirm"]);
  assert.ok(paths["/inventory/receipts"]);
  assert.ok(paths["/stock-movements"]);

  assert.equal(
    response.body.components.securitySchemes.bearerAuth.scheme,
    "bearer",
  );
});

test("OpenAPI documents product category filtering", async () => {
  const response = await request(app).get("/api/v1/openapi.json");
  const openApi = response.body as ProductListOpenApiDocument;
  const parameters = openApi.paths["/products"]?.get?.parameters ?? [];
  const categoryId = parameters.find(
    (parameter) => parameter.name === "categoryId",
  );

  assert.ok(categoryId);
  assert.equal(categoryId.in, "query");
  assert.equal(categoryId.required, false);
  assert.equal(categoryId.schema?.type, "string");
  assert.equal(categoryId.schema?.pattern, "^[1-9][0-9]*$");
  assert.equal(categoryId.schema?.maxLength, 19);
  assert.match(String(categoryId.description), /1 through 9223372036854775807/);
});

test("OpenAPI documents authentication session requests and responses accurately", async () => {
  const response = await request(app).get("/api/v1/openapi.json");
  const openApi = response.body as AuthOpenApiDocument;
  const { paths, components } = openApi;
  const { schemas } = components;

  const login = paths["/auth/login"]?.post;
  const refresh = paths["/auth/refresh"]?.post;
  const logout = paths["/auth/logout"]?.post;

  assert.ok(login);
  assert.ok(refresh);
  assert.ok(logout);
  assert.deepEqual(login.security, []);
  assert.deepEqual(refresh.security, []);
  assert.deepEqual(logout.security, []);

  assert.deepEqual(Object.keys(login.responses).sort(), [
    "200",
    "400",
    "401",
    "413",
    "429",
    "500",
  ]);
  assert.deepEqual(Object.keys(refresh.responses).sort(), [
    "200",
    "400",
    "401",
    "413",
    "429",
    "500",
  ]);
  assert.deepEqual(Object.keys(logout.responses).sort(), [
    "200",
    "400",
    "413",
    "500",
  ]);
  assert.equal(
    login.responses["401"]?.$ref,
    "#/components/responses/InvalidCredentials",
  );
  assert.equal(
    refresh.responses["401"]?.$ref,
    "#/components/responses/InvalidRefreshToken",
  );

  assert.equal(refresh.requestBody?.required, true);
  assert.equal(
    refresh.requestBody?.content["application/json"].schema.$ref,
    "#/components/schemas/SessionTokenRequest",
  );
  assert.equal(
    logout.requestBody?.content["application/json"].schema.$ref,
    "#/components/schemas/SessionTokenRequest",
  );

  const sessionTokenRequest = schemas.SessionTokenRequest as {
    properties: { refreshToken: { pattern: string } };
    required: string[];
    additionalProperties: boolean;
  };
  assert.equal(
    sessionTokenRequest.properties.refreshToken.pattern,
    "^[A-Za-z0-9_-]{86}$",
  );
  assert.deepEqual(sessionTokenRequest.required, ["refreshToken"]);
  assert.equal(sessionTokenRequest.additionalProperties, false);

  const authResult = schemas.AuthResult as {
    properties: Record<string, unknown>;
    required: string[];
  };
  assert.equal(
    (authResult.properties.refreshToken as { type: string }).type,
    "string",
  );
  assert.ok(authResult.required.includes("refreshToken"));
  const authResponse = schemas.AuthResponse as {
    properties: { data: { $ref: string } };
  };
  assert.equal(
    authResponse.properties.data.$ref,
    "#/components/schemas/AuthResult",
  );
  assert.equal(
    login.responses["200"]?.content?.["application/json"]?.schema.$ref,
    "#/components/schemas/AuthResponse",
  );
  assert.equal(
    refresh.responses["200"]?.content?.["application/json"]?.schema.$ref,
    "#/components/schemas/AuthResponse",
  );
  assert.equal(
    logout.responses["200"]?.content?.["application/json"]?.schema.$ref,
    "#/components/schemas/LogoutResponse",
  );

  const logoutResponse = schemas.LogoutResponse as {
    properties: { status: { const: string } } & Record<string, unknown>;
    required: string[];
  };
  assert.deepEqual(Object.keys(logoutResponse.properties).sort(), [
    "message",
    "status",
  ]);
  assert.deepEqual(logoutResponse.required, ["status", "message"]);
  assert.equal(logoutResponse.properties.status.const, "success");
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
