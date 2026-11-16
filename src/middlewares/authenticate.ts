import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error";

import { findUserById } from "../repositories/user.repositories";
import { isAuthSessionActive } from "../repositories/auth-session.repositories";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Authenticate a request using its JWT access token.
 *
 * Every authenticated request validates:
 * 1. JWT signature and expiration.
 * 2. Backend authentication session state.
 * 3. Current user existence and active status.
 * 4. Current user role from PostgreSQL.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required.",
    );
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    throw new AppError(
      401,
      "INVALID_AUTHORIZATION_FORMAT",
      "Authorization header must use Bearer token format.",
    );
  }

  const token = match[1];

  let tokenPayload: ReturnType<typeof verifyAccessToken>;

  try {
    tokenPayload = verifyAccessToken(token);
  } catch {
    throw new AppError(
      401,
      "INVALID_ACCESS_TOKEN",
      "Access token is invalid or expired.",
    );
  }

  const sessionIsActive = await isAuthSessionActive(
    tokenPayload.sessionId,
    tokenPayload.id,
  );

  if (!sessionIsActive) {
    throw new AppError(
      401,
      "INVALID_ACCESS_TOKEN",
      "Access token is invalid or expired.",
    );
  }

  // Always use the latest user state and role from PostgreSQL.
  const user = await findUserById(tokenPayload.id);

  if (!user || !user.is_active) {
    throw new AppError(
      401,
      "INVALID_ACCESS_TOKEN",
      "Access token is invalid or expired.",
    );
  }

  req.user = {
    id: user.id,
    role: user.role,
  };

  next();
};
