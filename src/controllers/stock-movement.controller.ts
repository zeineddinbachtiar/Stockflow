
import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error";
import { parsePositiveBigIntId } from "../utils/route-params";

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
function getMovementId(param: unknown): string {
  return parsePositiveBigIntId(
    param,
    "INVALID_STOCK_MOVEMENT_ID",
    "Stock movement"
  );
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
        throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Request validation failed.",
            parsed.error.issues.map((issue) => ({
                field: issue.path.map(String).join("."),
                message: issue.message
             }))
        );
    }

    const query: StockMovementQuery = parsed.data;

    const result = await getAllStockMovements(query);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: unknown) {
     throw error;
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
    const movementId = getMovementId(req.params.id);

    const movement = await getStockMovementById(movementId);

    if (!movement) {
        throw new AppError(
         404,
         "STOCK_MOVEMENT_NOT_FOUND",
         "Stock movement not found."
         );
    }

    res.status(200).json({
      status: "success",
      data: {
        movement,
      },
    });
  } catch (error: unknown) {
        throw error;
    }
};
