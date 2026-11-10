
import type { RequestHandler, Response } from "express";

import {
  getAllStockMovements,
  getStockMovementById,
} from "../services/stock-movement.service";

import type {
  StockMovementQuery,
} from "../types/stock-movement.types";

import {
  stockMovementQuerySchema,
} from "../validators/stock-movement.validator";

/**
 * Validate stock movement ID.
 */
function getMovementId(
  param: unknown,
  res: Response
): string | null {
  if (
    typeof param !== "string" ||
    !/^[1-9]\d*$/.test(param)
  ) {
    res.status(400).json({
      status: "error",
      code: "INVALID_STOCK_MOVEMENT_ID",
      message: "Stock movement ID must be a positive integer.",
    });

    return null;
  }

  try {
    const id = BigInt(param);
    const maxId = 9223372036854775807n;

    if (id > maxId) {
      res.status(400).json({
        status: "error",
        code: "INVALID_STOCK_MOVEMENT_ID",
        message: "Stock movement ID exceeds the maximum supported value.",
      });

      return null;
    }
  } catch {
    res.status(400).json({
      status: "error",
      code: "INVALID_STOCK_MOVEMENT_ID",
      message: "Stock movement ID must be a positive integer.",
    });

    return null;
  }

  return param;
}

/**
 * GET /api/v1/stock-movements
 */
export const listStockMovements: RequestHandler = async (
  req,
  res
) => {
  try {
    const parsed = stockMovementQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        status: "error",
        message: "Request validation failed.",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.map(String).join("."),
          message: issue.message,
        })),
      });

      return;
    }

    const query: StockMovementQuery = parsed.data;

    const result = await getAllStockMovements(query);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: unknown) {
    console.error("Stock movement controller error:", error);

    res.status(500).json({
      status: "error",
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
};

/**
 * GET /api/v1/stock-movements/:id
 */
export const getStockMovement: RequestHandler = async (
  req,
  res
) => {
  try {
    const movementId = getMovementId(req.params.id, res);

    if (!movementId) return;

    const movement = await getStockMovementById(movementId);

    if (!movement) {
      res.status(404).json({
        status: "error",
        code: "STOCK_MOVEMENT_NOT_FOUND",
        message: "Stock movement not found.",
      });

      return;
    }

    res.status(200).json({
      status: "success",
      data: {
        movement,
      },
    });
  } catch (error: unknown) {
    console.error("Stock movement controller error:", error);

    res.status(500).json({
      status: "error",
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
};
