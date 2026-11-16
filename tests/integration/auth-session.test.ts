import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import assert from "node:assert/strict";

import { pool } from "../../src/config/database";
import {
  createAuthSession,
  isAuthSessionActive,
  rotateAuthSession,
  revokeAuthSession,
} from "../../src/repositories/auth-session.repositories";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../src/utils/refresh-token";

const createdSessionIds: string[] = [];

async function getSeededAdminId(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM users
     WHERE email = $1
     LIMIT 1`,
    ["admin@stockflow.local"],
  );

  const userId = result.rows[0]?.id;

  if (!userId) {
    throw new Error("Seeded ADMIN user was not found.");
  }

  return userId;
}

async function createTestSession(): Promise<{
  sessionId: string;
  userId: string;
  refreshToken: string;
  refreshTokenHash: string;
}> {
  const userId = await getSeededAdminId();
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const sessionId = await createAuthSession(userId, refreshTokenHash);

  createdSessionIds.push(sessionId);

  return {
    sessionId,
    userId,
    refreshToken,
    refreshTokenHash,
  };
}

// Clean up only sessions created by this test file.
after(async () => {
  try {
    if (createdSessionIds.length > 0) {
      await pool.query(
        `DELETE FROM auth_sessions
         WHERE id = ANY($1::uuid[])`,
        [createdSessionIds],
      );
    }
  } finally {
    await pool.end();
  }
});

test("refresh tokens are random and their hashes are deterministic", () => {
  const firstToken = generateRefreshToken();
  const secondToken = generateRefreshToken();

  assert.notEqual(firstToken, secondToken);
  assert.match(firstToken, /^[A-Za-z0-9_-]{86}$/);

  const firstHash = hashRefreshToken(firstToken);

  assert.equal(hashRefreshToken(firstToken), firstHash);
  assert.match(firstHash, /^[a-f0-9]{64}$/);
  assert.notEqual(hashRefreshToken(secondToken), firstHash);
});

test("creates an active authentication session", async () => {
  const session = await createTestSession();

  assert.equal(
    await isAuthSessionActive(session.sessionId, session.userId),
    true,
  );

  assert.equal(await isAuthSessionActive(randomUUID(), session.userId), false);
});

test("rotates refresh tokens and rejects reuse of the previous token", async () => {
  const session = await createTestSession();

  const nextRefreshToken = generateRefreshToken();
  const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);

  const rotatedSession = await rotateAuthSession(
    session.refreshTokenHash,
    nextRefreshTokenHash,
  );

  assert.deepEqual(rotatedSession, {
    id: session.sessionId,
    user_id: session.userId,
  });

  assert.equal(
    await rotateAuthSession(
      session.refreshTokenHash,
      hashRefreshToken(generateRefreshToken()),
    ),
    null,
  );

  assert.equal(
    await isAuthSessionActive(session.sessionId, session.userId),
    true,
  );
});

test("revokes an authentication session and prevents reuse", async () => {
  const session = await createTestSession();

  assert.equal(await revokeAuthSession(session.refreshTokenHash), true);

  assert.equal(
    await isAuthSessionActive(session.sessionId, session.userId),
    false,
  );

  assert.equal(await revokeAuthSession(session.refreshTokenHash), false);

  assert.equal(
    await rotateAuthSession(
      session.refreshTokenHash,
      hashRefreshToken(generateRefreshToken()),
    ),
    null,
  );
});
