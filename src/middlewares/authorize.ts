
import type { RequestHandler } from "express";
import type { UserRole } from "../types/user.types";

export const authorize = (...allowedRoles: UserRole[]): RequestHandler => {
  if (allowedRoles.length === 0) {
    throw new Error("authorize middleware requires at least one role.");
  }

  return (req, res, next) => {
    // Pastikan pengguna sudah melewati authentication.
    if (!req.user) {
      res.status(401).json({
        status: "error",
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required.",
      });
      return;
    }

    // Periksa apakah role pengguna diizinkan.
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: "error",
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource.",
      });
      return;
    }

    // Role diizinkan, lanjutkan request.
    next();
  };
};
