import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a cryptographically secure refresh token.
 */
export function generateRefreshToken(): string {
  return randomBytes(64).toString("base64url");
}

/**
 * Store only the SHA-256 hash of a refresh token.
 *
 * The original token is returned to the client only once.
 */
export function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken, "utf8").digest("hex");
}
