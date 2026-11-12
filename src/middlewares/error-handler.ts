import type { ErrorRequestHandler } from "express";

import { ZodError } from "zod";

import { AppError } from "../errors/app-error";

import { getSafeErrorMetadata, logger } from "../utils/logger";

function getStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (!(property in value)) {
    return undefined;
  }

  const result = (value as Record<string, unknown>)[property];

  return typeof result === "string" ? result : undefined;
}

function formatZodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/**
 * Centralized Express error middleware.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  // 1. Application errors.
  if (error instanceof AppError) {
    const response: Record<string, unknown> = {
      status: "error",
      code: error.code,
      message: error.message,
    };

    if (error.details !== undefined) {
      response.errors = error.details;
    }

    return res.status(error.statusCode).json(response);
  }

  // 2. Zod validation errors.
  if (error instanceof ZodError) {
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      errors: formatZodIssues(error),
    });
  }

  // 3. Invalid JSON request body.
  const errorType = getStringProperty(error, "type");

  if (errorType === "entity.parse.failed") {
    return res.status(400).json({
      status: "error",
      code: "INVALID_JSON",
      message: "Request body contains invalid JSON.",
    });
  }

  // 4. Request body exceeds the configured parser limit.
  if (errorType === "entity.too.large") {
    return res.status(413).json({
      status: "error",
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large.",
    });
  }

  // 5. PostgreSQL errors.
  const postgresCode = getStringProperty(error, "code");

  if (postgresCode === "23505") {
    return res.status(409).json({
      status: "error",
      code: "DUPLICATE_RESOURCE",
      message: "A resource with the same unique value already exists.",
    });
  }

  if (postgresCode === "23503") {
    return res.status(409).json({
      status: "error",
      code: "RELATED_RESOURCE_CONFLICT",
      message: "The requested operation conflicts with related records.",
    });
  }

  if (postgresCode === "23514") {
    return res.status(409).json({
      status: "error",
      code: "DATA_CONSTRAINT_VIOLATION",
      message: "The requested operation violates a database constraint.",
    });
  }

  if (postgresCode === "22P02") {
    return res.status(400).json({
      status: "error",
      code: "INVALID_DATABASE_VALUE",
      message: "One or more request values are invalid.",
    });
  }

  // 6. Unexpected internal error.
  logger.error("Unhandled application error.", {
    requestId:
      typeof res.locals.requestId === "string"
        ? res.locals.requestId
        : "unavailable",
    method: req.method,
    path: req.path,
    ...getSafeErrorMetadata(error),
  });

  return res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
};
