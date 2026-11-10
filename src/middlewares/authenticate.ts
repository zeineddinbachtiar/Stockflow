
import type { RequestHandler } from "express";
import { findUserById } from "../repositories/user.repositories";
import { verifyAccessToken } from "../utils/jwt";

export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      status: "error",
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
    });
    return;
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    res.status(401).json({
      status: "error",
      code: "INVALID_AUTHORIZATION_FORMAT",
      message: "Authorization header must use Bearer token format.",
    });
    return;
  }

  const token = match[1];

  // Step 1: Verify JWT.
  let tokenPayload: { id: string; role: "ADMIN" | "WAREHOUSE_STAFF" | "SALES_STAFF" };

  try {
    tokenPayload = verifyAccessToken(token);
  } catch {
    res.status(401).json({
      status: "error",
      code: "INVALID_ACCESS_TOKEN",
      message: "Access token is invalid or expired.",
    });
    return;
  }

  // Step 2: Retrieve the latest user data from database.
  findUserById(tokenPayload.id)
    .then((user) => {
      if (!user || !user.is_active) {
        res.status(401).json({
          status: "error",
          code: "INVALID_ACCESS_TOKEN",
          message: "Access token is invalid or expired.",
        });
        return;
      }

      // Step 3: Use the current database role.
      req.user = {
        id: user.id,
        role: user.role,
      };

      next();
    })
    .catch((error: unknown) => {
      console.error("Authentication user lookup failed:", error);

      res.status(500).json({
        status: "error",
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
    });
};
