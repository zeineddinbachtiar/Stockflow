import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error";

import type { UserRole } from "../types/user.types";

/**
 * Restrict a route to one or more allowed roles.
 */
export const authorize = (...allowedRoles: UserRole[]): RequestHandler => {
  if (allowedRoles.length === 0) {
    throw new Error("authorize middleware requires at least one role.");
  }

  return (req, _res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication is required.",
        ),
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to access this resource.",
        ),
      );
    }

    next();
  };
};
