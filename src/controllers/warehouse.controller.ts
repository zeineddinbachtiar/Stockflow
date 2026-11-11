import type { RequestHandler } from "express";

import { parsePositiveBigIntId } from "../utils/route-params";

import { AppError } from "../errors/app-error";
import { paginationQuerySchema } from "../validators/common.validator";

import {
  createNewWarehouse,
  deactivateExistingWarehouse,
  getAllWarehouses,
  getWarehouseById,
  reactivateExistingWarehouse,
  updateExistingWarehouse,
} from "../services/warehouse.service";

import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from "../types/warehouse.types";

/**
 * Validate warehouse ID from route parameters.
 */
function getWarehouseId(param: unknown): string {
  return parsePositiveBigIntId(param, "INVALID_WAREHOUSE_ID", "Warehouse");
}

/**
 * GET /api/v1/warehouses
 */
/**
 * GET /api/v1/warehouses
 */
export const listWarehouses: RequestHandler = async (req, res) => {
  const parsed = paginationQuerySchema.safeParse(req.query);

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

  const result = await getAllWarehouses(parsed.data);

  res.status(200).json({
    status: "success",
    data: result,
  });
};

/**
 * GET /api/v1/warehouses/:id
 */
export const getWarehouse: RequestHandler = async (req, res) => {
  const warehouseId = getWarehouseId(req.params.id);

  const warehouse = await getWarehouseById(warehouseId);

  res.status(200).json({
    status: "success",
    data: {
      warehouse,
    },
  });
};

/**
 * POST /api/v1/warehouses
 */
export const createWarehouseController: RequestHandler = async (req, res) => {
  const input = req.body as CreateWarehouseInput;

  const warehouse = await createNewWarehouse(input);

  res.status(201).json({
    status: "success",
    message: "Warehouse created successfully.",
    data: {
      warehouse,
    },
  });
};

/**
 * PATCH /api/v1/warehouses/:id
 */
export const updateWarehouseController: RequestHandler = async (req, res) => {
  const warehouseId = getWarehouseId(req.params.id);
  const input = req.body as UpdateWarehouseInput;

  const warehouse = await updateExistingWarehouse(warehouseId, input);

  res.status(200).json({
    status: "success",
    message: "Warehouse updated successfully.",
    data: {
      warehouse,
    },
  });
};

/**
 * PATCH /api/v1/warehouses/:id/deactivate
 */
export const deactivateWarehouseController: RequestHandler = async (
  req,
  res,
) => {
  const warehouseId = getWarehouseId(req.params.id);

  const warehouse = await deactivateExistingWarehouse(warehouseId);

  res.status(200).json({
    status: "success",
    message: "Warehouse deactivated successfully.",
    data: {
      warehouse,
    },
  });
};

/**
 * PATCH /api/v1/warehouses/:id/reactivate
 */
export const reactivateWarehouseController: RequestHandler = async (
  req,
  res,
) => {
  const warehouseId = getWarehouseId(req.params.id);

  const warehouse = await reactivateExistingWarehouse(warehouseId);

  res.status(200).json({
    status: "success",
    message: "Warehouse reactivated successfully.",
    data: {
      warehouse,
    },
  });
};
