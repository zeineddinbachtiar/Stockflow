
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { UserRole } from "../types/user.types";

// Access token lifetime: 15 minutes
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Generate JWT access token.
 */
export function generateAccessToken(user: {
  id: string;
  role: UserRole;
}): string {
  return jwt.sign(
    {
      role: user.role
    },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: "stockflow-api",
      audience: "stockflow-client"
    }
  );
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "ADMIN" ||
    value === "WAREHOUSE_STAFF" ||
    value === "SALES_STAFF"
  );
}

export function verifyAccessToken(
  token: string
): { id: string; role: UserRole } {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "stockflow-api",
    audience: "stockflow-client",
  });

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    !isUserRole(decoded.role)
  ) {
    throw new Error("Invalid access token payload.");
  }

  return {
    id: decoded.sub,
    role: decoded.role,
  };
}
