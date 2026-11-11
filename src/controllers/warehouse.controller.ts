import type { RequestHandler } from "express";

import { parsePositiveBigIntId } from "../utils/route-params";

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
export const listWarehouses: RequestHandler = async (_req, res) => {
  const warehouses = await getAllWarehouses();

  res.status(200).json({
    status: "success",
    data: {
      warehouses,
    },
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
