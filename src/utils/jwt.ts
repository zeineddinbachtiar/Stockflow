import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import type { UserRole } from "../types/user.types";

// Access token lifetime: 15 minutes.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload {
  id: string;
  role: UserRole;
  sessionId: string;
}

/**
 * Generate a JWT access token bound to an authentication session.
 */
export function generateAccessToken(user: {
  id: string;
  role: UserRole;
  sessionId: string;
}): string {
  return jwt.sign(
    {
      role: user.role,
      sid: user.sessionId,
    },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: "stockflow-api",
      audience: "stockflow-client",
      jwtid: randomUUID(),
    },
  );
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "ADMIN" || value === "WAREHOUSE_STAFF" || value === "SALES_STAFF"
  );
}

/**
 * Verify JWT signature, standard claims, role, and session identity.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "stockflow-api",
    audience: "stockflow-client",
  });

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    !isUserRole(decoded.role) ||
    typeof decoded.sid !== "string" ||
    decoded.sid.length === 0
  ) {
    throw new Error("Invalid access token payload.");
  }

  return {
    id: decoded.sub,
    role: decoded.role,
    sessionId: decoded.sid,
  };
}
