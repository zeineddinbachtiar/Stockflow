import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Assign a unique request ID and log completed HTTP requests.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const startedAt = Date.now();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  res.once("finish", () => {
    // Avoid unnecessary request logs during automated tests.
    if (env.NODE_ENV === "test") {
      return;
    }

    logger.info("HTTP request completed.", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
};
