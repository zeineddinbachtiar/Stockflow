
import type { Request, RequestHandler, Response } from "express";

import {
  InventoryServiceError,
  adjustStock,
  getAllInventory,
  getInventoryById,
  issueStock,
  receiveStock,
  updateReorderLevel,
} from "../services/inventory.service";

import type {
  StockOperationInput,
  StockAdjustmentInput,
  ReorderLevelInput,
  InventoryQuery,
} from "../types/inventory.types";

import {
  inventoryQuerySchema,
} from "../validators/inventory.validator";

/**
 * Validate inventory ID from route parameters.
 */
function getInventoryId(
  param: unknown,
  res: Response
): string | null {
  if (
    typeof param !== "string" ||
    !/^[1-9]\d*$/.test(param)
  ) {
    res.status(400).json({
      status: "error",
      code: "INVALID_INVENTORY_ID",
      message: "Inventory ID must be a positive integer.",
    });

    return null;
  }

  try {
    const id = BigInt(param);
    const maxId = 9223372036854775807n;

    if (id > maxId) {
      res.status(400).json({
        status: "error",
        code: "INVALID_INVENTORY_ID",
        message: "Inventory ID exceeds the maximum supported value.",
      });

      return null;
    }
  } catch {
    res.status(400).json({
      status: "error",
      code: "INVALID_INVENTORY_ID",
      message: "Inventory ID must be a positive integer.",
    });

    return null;
  }

  return param;
}

/**
 * Retrieve authenticated user ID.
 */
function getPerformedBy(
  req: Request,
  res: Response
): string | null {
  if (!req.user) {
    res.status(401).json({
      status: "error",
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
    });

    return null;
  }

  return req.user.id;
}

/**
 * Handle inventory service errors.
 */
function handleInventoryError(
  error: unknown,
  res: Response
): void {
  if (error instanceof InventoryServiceError) {
    let statusCode = 500;

    if (
      error.code === "WAREHOUSE_NOT_FOUND" ||
      error.code === "PRODUCT_NOT_FOUND" ||
      error.code === "INVENTORY_NOT_FOUND"
    ) {
      statusCode = 404;
    } else if (error.code === "INSUFFICIENT_STOCK") {
      statusCode = 409;
    } else if (
      error.code === "STOCK_QUANTITY_LIMIT_EXCEEDED"
    ) {
      statusCode = 422;
    }

    res.status(statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });

    return;
  }

  console.error("Inventory controller error:", error);

  res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
}

/**
 * Handle query validation errors.
 */
function handleQueryValidationError(
  issues: Array<{ path: PropertyKey[]; message: string }>,
  res: Response
): void {
  res.status(400).json({
    status: "error",
    message: "Request validation failed.",
    errors: issues.map((issue) => ({
      field: issue.path.map(String).join("."),
      message: issue.message,
    })),
  });
}

/**
 * GET /api/v1/inventory
 */
export const listInventory: RequestHandler = async (req, res) => {
  try {
    const parsed = inventoryQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      handleQueryValidationError(parsed.error.issues, res);
      return;
    }

    const query: InventoryQuery = parsed.data;

    const result = await getAllInventory(query);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: unknown) {
    handleInventoryError(error, res);
  }
};

/**
 * GET /api/v1/inventory/:id
 */
export const getInventory: RequestHandler = async (req, res) => {
  try {
    const inventoryId = getInventoryId(req.params.id, res);

    if (!inventoryId) return;

    const inventory = await getInventoryById(inventoryId);

    res.status(200).json({
      status: "success",
      data: {
        inventory,
      },
    });
  } catch (error: unknown) {
    handleInventoryError(error, res);
  }
};

/**
 * POST /api/v1/inventory/receipts
 */
export const receiveStockController: RequestHandler = async (
  req,
  res
) => {
  try {
    const performedBy = getPerformedBy(req, res);

    if (!performedBy) return;

    const input = req.body as StockOperationInput;

    const result = await receiveStock(input, performedBy);

    res.status(201).json({
      status: "success",
      message: "Stock received successfully.",
      data: result,
    });
  } catch (error: unknown) {
    handleInventoryError(error, res);
  }
};

/**
 * POST /api/v1/inventory/issues
 */
export const issueStockController: RequestHandler = async (
  req,
  res
) => {
  try {
    const performedBy = getPerformedBy(req, res);

    if (!performedBy) return;

    const input = req.body as StockOperationInput;

    const result = await issueStock(input, performedBy);

    res.status(201).json({
      status: "success",
      message: "Stock issued successfully.",
      data: result,
    });
  } catch (error: unknown) {
    handleInventoryError(error, res);
  }
};

/**
 * POST /api/v1/inventory/adjustments
 */
export const adjustStockController: RequestHandler = async (
  req,
  res
) => {
  try {
    const performedBy = getPerformedBy(req, res);

    if (!performedBy) return;

    const input = req.body as StockAdjustmentInput;

    const result = await adjustStock(input, performedBy);

    res.status(201).json({
      status: "success",
      message: "Stock adjusted successfully.",
      data: result,
    });
  } catch (error: unknown) {
    handleInventoryError(error, res);
  }
};

/**
 * PATCH /api/v1/inventory/:id/reorder-level
 */
export const updateReorderLevelController: RequestHandler = async (
  req,
  res
) => {
  try {
    const inventoryId = getInventoryId(req.params.id, res);

    if (!inventoryId) return;

    const input = req.body as ReorderLevelInput;

    const inventory = await updateReorderLevel(
      inventoryId,
      input.reorderLevel
    );

    res.status(200).json({
      status: "success",
      message: "Reorder level updated successfully.",
      data: {
        inventory,
      },
    });
  } catch (error: unknown) {
    handleInventoryError(error, res);
  }
};
