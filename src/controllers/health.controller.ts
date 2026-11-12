import type { RequestHandler } from "express";

import { pool } from "../config/database";

/**
 * Create a database readiness handler.
 *
 * The injectable callback allows the readiness behavior
 * to be tested without disconnecting the real database.
 */
export function createReadinessHandler(
  checkDatabase: () => Promise<unknown> = () => pool.query("SELECT 1"),
): RequestHandler {
  return async (_req, res) => {
    try {
      await checkDatabase();

      return res.status(200).json({
        status: "success",
        message: "StockFlow API is ready.",
        checks: {
          database: "ok",
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Do not expose internal database errors to API clients.
      return res.status(503).json({
        status: "error",
        code: "SERVICE_UNAVAILABLE",
        message: "StockFlow API is not ready.",
        checks: {
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

export const readinessCheck = createReadinessHandler();
