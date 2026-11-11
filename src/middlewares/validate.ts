
import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../errors/app-error";

/**
 * Convert Zod issues into a consistent validation response.
 */
function createValidationError(error: z.ZodError): AppError {
  const details = error.issues.map((issue) => ({
    field: issue.path.map(String).join("."),
    message: issue.message
  }));

  return new AppError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed.",
    details
  );
}

/**
 * Generic request body validation middleware.
 */
export function validateBody(
  schema: z.ZodType
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(createValidationError(result.error));
    }

    req.body = result.data;

    next();
  };
}
