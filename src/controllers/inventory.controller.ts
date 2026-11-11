import type { Request, RequestHandler } from "express";

import { AppError } from "../errors/app-error";
import { parsePositiveBigIntId } from "../utils/route-params";

import {
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

import { inventoryQuerySchema } from "../validators/inventory.validator";

/**
 * Validate inventory ID from route parameters.
 */
function getInventoryId(param: unknown): string {
  return parsePositiveBigIntId(param, "INVALID_INVENTORY_ID", "Inventory");
}

/**
 * Retrieve authenticated user ID.
 */
function getPerformedBy(req: Request): string {
  if (!req.user) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required.",
    );
  }

  return req.user.id;
}

/**
 * GET /api/v1/inventory
 */
export const listInventory: RequestHandler = async (req, res) => {
  const parsed = inventoryQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }

  const query: InventoryQuery = parsed.data;

  const result = await getAllInventory(query);

  res.status(200).json({
    status: "success",
    data: result,
  });
};

/**
 * GET /api/v1/inventory/:id
 */
export const getInventory: RequestHandler = async (req, res) => {
  const inventoryId = getInventoryId(req.params.id);

  const inventory = await getInventoryById(inventoryId);

  res.status(200).json({
    status: "success",
    data: {
      inventory,
    },
  });
};

/**
 * POST /api/v1/inventory/receipts
 */
export const receiveStockController: RequestHandler = async (req, res) => {
  const performedBy = getPerformedBy(req);

  const input = req.body as StockOperationInput;

  const result = await receiveStock(input, performedBy);

  res.status(201).json({
    status: "success",
    message: "Stock received successfully.",
    data: result,
  });
};

/**
 * POST /api/v1/inventory/issues
 */
export const issueStockController: RequestHandler = async (req, res) => {
  const performedBy = getPerformedBy(req);

  const input = req.body as StockOperationInput;

  const result = await issueStock(input, performedBy);

  res.status(201).json({
    status: "success",
    message: "Stock issued successfully.",
    data: result,
  });
};

/**
 * POST /api/v1/inventory/adjustments
 */
export const adjustStockController: RequestHandler = async (req, res) => {
  const performedBy = getPerformedBy(req);

  const input = req.body as StockAdjustmentInput;

  const result = await adjustStock(input, performedBy);

  res.status(201).json({
    status: "success",
    message: "Stock adjusted successfully.",
    data: result,
  });
};

/**
 * PATCH /api/v1/inventory/:id/reorder-level
 */
export const updateReorderLevelController: RequestHandler = async (
  req,
  res,
) => {
  const inventoryId = getInventoryId(req.params.id);

  const input = req.body as ReorderLevelInput;

  const inventory = await updateReorderLevel(inventoryId, input.reorderLevel);

  res.status(200).json({
    status: "success",
    message: "Reorder level updated successfully.",
    data: {
      inventory,
    },
  });
};
