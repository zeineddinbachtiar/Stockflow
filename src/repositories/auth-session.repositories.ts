import { randomUUID } from "node:crypto";

import { pool } from "../config/database";

const AUTH_SESSION_IDLE_TTL_DAYS = 30;

interface AuthSessionIdentity {
  id: string;
  user_id: string;
}

/**
 * Create a new persistent authentication session.
 *
 * Only the hashed refresh token is stored in PostgreSQL.
 */
export async function createAuthSession(
  userId: string,
  refreshTokenHash: string,
): Promise<string> {
  const sessionId = randomUUID();

  const result = await pool.query<{ id: string }>(
    `INSERT INTO auth_sessions (
       id,
       user_id,
       refresh_token_hash,
       expires_at
     )
     VALUES (
       $1,
       $2,
       $3,
       NOW() + ($4::int * INTERVAL '1 day')
     )
     RETURNING id`,
    [sessionId, userId, refreshTokenHash, AUTH_SESSION_IDLE_TTL_DAYS],
  );

  const createdSession = result.rows[0];

  if (!createdSession) {
    throw new Error("Failed to create authentication session.");
  }

  return createdSession.id;
}

/**
 * Check whether a session is still active.
 */
export async function isAuthSessionActive(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM auth_sessions
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [sessionId, userId],
  );

  return result.rowCount === 1;
}

/**
 * Rotate a refresh token atomically.
 *
 * SELECT ... FOR UPDATE ensures that concurrent refresh requests
 * cannot successfully reuse the same refresh token.
 *
 * Returns null when the token is unknown, expired, or revoked.
 */
export async function rotateAuthSession(
  currentRefreshTokenHash: string,
  nextRefreshTokenHash: string,
): Promise<AuthSessionIdentity | null> {
  const client = await pool.connect();

  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const currentResult = await client.query<AuthSessionIdentity>(
      `SELECT
         id,
         user_id
       FROM auth_sessions
       WHERE refresh_token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
      [currentRefreshTokenHash],
    );

    const currentSession = currentResult.rows[0];

    if (!currentSession) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return null;
    }

    const updateResult = await client.query<{ id: string }>(
      `UPDATE auth_sessions
       SET
         refresh_token_hash = $2,
         last_refreshed_at = NOW(),
         expires_at = NOW() + ($3::int * INTERVAL '1 day')
       WHERE id = $1
         AND revoked_at IS NULL
       RETURNING id`,
      [currentSession.id, nextRefreshTokenHash, AUTH_SESSION_IDLE_TTL_DAYS],
    );

    if (updateResult.rowCount !== 1) {
      throw new Error("Failed to rotate authentication session.");
    }

    await client.query("COMMIT");
    transactionOpen = false;

    return currentSession;
  } catch (error: unknown) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => undefined);
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Revoke a session using its current refresh token hash.
 *
 * Returns false if the session was already revoked or does not exist.
 */
export async function revokeAuthSession(
  refreshTokenHash: string,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE auth_sessions
     SET revoked_at = NOW()
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
     RETURNING id`,
    [refreshTokenHash],
  );

  return result.rowCount === 1;
}
