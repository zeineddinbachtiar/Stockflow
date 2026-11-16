import { after, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../../src/app";
import { env } from "../../src/config/env";
import { pool } from "../../src/config/database";
import { hashRefreshToken } from "../../src/utils/refresh-token";

interface AuthResponse {
  status: string;
  code?: string;
  message?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    user?: {
      id?: string;
      email?: string;
      role?: string;
      isActive?: boolean;
    };
  };
}

const createdRefreshTokenHashes: string[] = [];

async function loginSeededAdmin(): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
}> {
  assert.ok(env.SEED_ADMIN_PASSWORD, "SEED_ADMIN_PASSWORD must be configured.");

  const response = await request(app).post("/api/v1/auth/login").send({
    email: "admin@stockflow.local",
    password: env.SEED_ADMIN_PASSWORD,
  });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, "success");

  const body = response.body as AuthResponse;
  const data = body.data;

  assert.ok(data?.accessToken);
  assert.ok(data.refreshToken);
  assert.ok(data.user?.id);

  createdRefreshTokenHashes.push(hashRefreshToken(data.refreshToken));

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
  };
}

function expectRefreshSuccess(response: {
  status: number;
  body: AuthResponse;
}): {
  accessToken: string;
  refreshToken: string;
  userId: string;
} {
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, "success");

  const data = response.body.data;

  assert.ok(data?.accessToken);
  assert.ok(data.refreshToken);
  assert.ok(data.user?.id);
  assert.equal(data.tokenType, "Bearer");
  assert.equal(data.expiresIn, 900);
  assert.equal(data.user.isActive, true);

  createdRefreshTokenHashes.push(hashRefreshToken(data.refreshToken));

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
  };
}

after(async () => {
  try {
    if (createdRefreshTokenHashes.length > 0) {
      await pool.query(
        `DELETE FROM auth_sessions
         WHERE refresh_token_hash = ANY($1::char(64)[])`,
        [createdRefreshTokenHashes],
      );
    }
  } finally {
    await pool.end();
  }
});

test("refresh issues new tokens and rejects reuse of the old refresh token", async () => {
  const initialSession = await loginSeededAdmin();

  const refreshResponse = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: initialSession.refreshToken });

  const refreshedSession = expectRefreshSuccess(refreshResponse);

  assert.equal(refreshedSession.userId, initialSession.userId);
  assert.notEqual(refreshedSession.accessToken, initialSession.accessToken);
  assert.notEqual(refreshedSession.refreshToken, initialSession.refreshToken);

  const protectedResponse = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", `Bearer ${initialSession.accessToken}`);

  assert.equal(protectedResponse.status, 200);

  const replayResponse = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: initialSession.refreshToken });

  assert.equal(replayResponse.status, 401);
  assert.equal(replayResponse.body.code, "INVALID_REFRESH_TOKEN");
});

test("only one concurrent request can rotate the same refresh token", async () => {
  const initialSession = await loginSeededAdmin();

  const [firstResponse, secondResponse] = await Promise.all([
    request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: initialSession.refreshToken }),
    request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: initialSession.refreshToken }),
  ]);

  const responses = [firstResponse, secondResponse];
  const successfulResponses = responses.filter(
    (response) => response.status === 200,
  );
  const rejectedResponses = responses.filter(
    (response) => response.status === 401,
  );

  assert.equal(successfulResponses.length, 1);
  assert.equal(rejectedResponses.length, 1);

  expectRefreshSuccess(successfulResponses[0]);
  assert.equal(rejectedResponses[0].body.code, "INVALID_REFRESH_TOKEN");
});

test("logout revokes the session and invalidates existing access tokens", async () => {
  const session = await loginSeededAdmin();

  const logoutResponse = await request(app)
    .post("/api/v1/auth/logout")
    .send({ refreshToken: session.refreshToken });

  assert.equal(logoutResponse.status, 200);
  assert.equal(logoutResponse.body.status, "success");

  const protectedResponse = await request(app)
    .get("/api/v1/categories")
    .set("Authorization", `Bearer ${session.accessToken}`);

  assert.equal(protectedResponse.status, 401);
  assert.equal(protectedResponse.body.code, "INVALID_ACCESS_TOKEN");

  const refreshResponse = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: session.refreshToken });

  assert.equal(refreshResponse.status, 401);
  assert.equal(refreshResponse.body.code, "INVALID_REFRESH_TOKEN");

  const repeatedLogoutResponse = await request(app)
    .post("/api/v1/auth/logout")
    .send({ refreshToken: session.refreshToken });

  assert.equal(repeatedLogoutResponse.status, 200);
});

test("refresh rejects malformed refresh tokens", async () => {
  const response = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: "invalid-token" });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});

test("logout rejects malformed refresh tokens", async () => {
  const response = await request(app)
    .post("/api/v1/auth/logout")
    .send({ refreshToken: "invalid-token" });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});
