
import type { ErrorRequestHandler } from "express";

import { ZodError } from "zod";

import { AppError } from "../errors/app-error";

interface DomainErrorDefinition {
  statusCode: number;
  message: string;
}

/**
 * Maps existing service error codes to HTTP responses.
 *
 * This keeps compatibility with service-specific error
 * classes while centralizing HTTP response formatting.
 */
const DOMAIN_ERRORS: Record<string, DomainErrorDefinition> = {
  // Authentication
  EMAIL_ALREADY_REGISTERED: {
    statusCode: 409,
    message: "Email is already registered."
  },
  INVALID_CREDENTIALS: {
    statusCode: 401,
    message: "Invalid email or password."
  },
  INVALID_INPUT: {
    statusCode: 400,
    message: "Invalid input."
  },

  // Category
  CATEGORY_NOT_FOUND: {
    statusCode: 404,
    message: "Category not found."
  },
  CATEGORY_ALREADY_EXISTS: {
    statusCode: 409,
    message: "Category already exists."
  },

  // Customer
  CUSTOMER_NOT_FOUND: {
    statusCode: 404,
    message: "Customer not found."
  },
  CUSTOMER_CODE_ALREADY_EXISTS: {
    statusCode: 409,
    message: "Customer code already exists."
  },

  // Product
  PRODUCT_NOT_FOUND: {
    statusCode: 404,
    message: "Product not found."
  },
  PRODUCT_NOT_FOUND_OR_INACTIVE: {
    statusCode: 404,
    message: "Product was not found or is inactive."
  },
  PRODUCT_SKU_ALREADY_EXISTS: {
    statusCode: 409,
    message: "Product SKU already exists."
  },

  // Warehouse
  WAREHOUSE_NOT_FOUND: {
    statusCode: 404,
    message: "Warehouse not found."
  },
  WAREHOUSE_CODE_ALREADY_EXISTS: {
    statusCode: 409,
    message: "Warehouse code already exists."
  },

  // Inventory
  INVENTORY_NOT_FOUND: {
    statusCode: 404,
    message: "Inventory record not found."
  },
  INSUFFICIENT_STOCK: {
    statusCode: 409,
    message: "Insufficient stock."
  },
  STOCK_QUANTITY_LIMIT_EXCEEDED: {
    statusCode: 422,
    message: "Stock quantity exceeds the supported limit."
  },

  // Orders
  ORDER_NOT_FOUND: {
    statusCode: 404,
    message: "Order was not found."
  },
  ORDER_ACCESS_DENIED: {
    statusCode: 403,
    message: "You are not allowed to access this order."
  },
  ORDER_NOT_DRAFT: {
    statusCode: 409,
    message: "Only draft orders can be updated or confirmed."
  },
  ORDER_ALREADY_CANCELLED: {
    statusCode: 409,
    message: "Order has already been cancelled."
  },
  ORDER_HAS_NO_ITEMS: {
    statusCode: 409,
    message: "Order must contain at least one item."
  },
  ORDER_PRODUCT_INACTIVE: {
    statusCode: 409,
    message: "One or more products are inactive."
  },
  ORDER_WAREHOUSE_NOT_FOUND: {
    statusCode: 404,
    message: "Order warehouse no longer exists."
  },
  ORDER_PRODUCT_NOT_FOUND: {
    statusCode: 404,
    message: "One or more order products no longer exist."
  },
  INVALID_ORDER_STATUS: {
    statusCode: 409,
    message: "Order status does not allow this operation."
  },

  // General
  STOCK_MOVEMENT_NOT_FOUND: {
    statusCode: 404,
    message: "Stock movement not found."
  }
};

function getStringProperty(
  value: unknown,
  property: string
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
    message: issue.message
  }));
}

/**
 * Centralized Express error middleware.
 */
export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next
) => {
  if (res.headersSent) {
    return next(error);
  }

  // 1. Application errors.
  if (error instanceof AppError) {
    const response: Record<string, unknown> = {
      status: "error",
      code: error.code,
      message: error.message
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
      errors: formatZodIssues(error)
    });
  }

  // 3. Invalid JSON request body.
  const errorType = getStringProperty(error, "type");

  if (errorType === "entity.parse.failed") {
    return res.status(400).json({
      status: "error",
      code: "INVALID_JSON",
      message: "Request body contains invalid JSON."
    });
  }

  // 4. Request body exceeds the configured parser limit.
  if (errorType === "entity.too.large") {
    return res.status(413).json({
      status: "error",
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large."
    });
  }

  // 5. PostgreSQL errors.
  const postgresCode = getStringProperty(error, "code");

  if (postgresCode === "23505") {
    const isOrderEndpoint =
      req.originalUrl.split("?")[0].startsWith("/api/v1/orders");

    return res.status(409).json({
      status: "error",
      code: isOrderEndpoint
        ? "DUPLICATE_ORDER"
        : "DUPLICATE_RESOURCE",
      message: "A resource with the same unique value already exists."
    });
  }

  if (postgresCode === "23503") {
    return res.status(409).json({
      status: "error",
      code: "RELATED_RESOURCE_CONFLICT",
      message: "The requested operation conflicts with related records."
    });
  }

  if (postgresCode === "23514") {
    return res.status(409).json({
      status: "error",
      code: "DATA_CONSTRAINT_VIOLATION",
      message: "The requested operation violates a database constraint."
    });
  }

  if (postgresCode === "22P02") {
    return res.status(400).json({
      status: "error",
      code: "INVALID_DATABASE_VALUE",
      message: "One or more request values are invalid."
    });
  }

  // 6. Existing service errors.
  // CategoryServiceError, ProductServiceError, etc.
  // expose their domain code through error.code.
  // Order service currently uses Error(message = domain code).
  const domainCode =
    getStringProperty(error, "code") ??
    getStringProperty(error, "message");

  if (domainCode && DOMAIN_ERRORS[domainCode]) {
    const definition = DOMAIN_ERRORS[domainCode];

    const originalMessage =
      getStringProperty(error, "message");

    const message =
      originalMessage && originalMessage !== domainCode
        ? originalMessage
        : definition.message;

    return res.status(definition.statusCode).json({
      status: "error",
      code: domainCode,
      message
    });
  }

  // 7. Unexpected internal error.
  console.error("Unhandled application error:", error);

  return res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred."
  });
};
