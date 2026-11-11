import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error";

/**
 * Handles requests that do not match any registered route.
 */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `Route ${req.method} ${req.originalUrl} was not found.`,
    ),
  );
};
