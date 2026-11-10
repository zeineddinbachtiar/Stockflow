
import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt";

export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Pastikan Authorization header tersedia.
  if (!authHeader) {
    res.status(401).json({
      status: "error",
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
    });
    return;
  }

  // Pastikan format header menggunakan Bearer Token.
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

  try {
    // Verifikasi signature, expiration, issuer, audience, dan payload.
    req.user = verifyAccessToken(token);

    // Teruskan request jika token valid.
    next();
  } catch {
    res.status(401).json({
      status: "error",
      code: "INVALID_ACCESS_TOKEN",
      message: "Access token is invalid or expired.",
    });
  }
};
