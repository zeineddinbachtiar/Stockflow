
import type { RequestHandler } from "express";
import { z } from "zod";

/**
 * Generic request body validation middleware.
 */
export function validateBody(
  schema: z.ZodType
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }));

      res.status(400).json({
        status: "error",
        message: "Request validation failed.",
        errors
      });

      return;
    }

    // Replace request body with validated data.
    req.body = result.data;

    next();
  };
}
