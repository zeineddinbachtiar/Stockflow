
import type { RequestHandler, Response } from "express";

import {
  WarehouseServiceError,
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
function getWarehouseId(
  param: unknown,
  res: Response
): string | null {
  if (
    typeof param !== "string" ||
    !/^[1-9]\d*$/.test(param)
  ) {
    res.status(400).json({
      status: "error",
      code: "INVALID_WAREHOUSE_ID",
      message: "Warehouse ID must be a positive integer.",
    });

    return null;
  }

  try {
    const id = BigInt(param);
    const maxId = 9223372036854775807n;

    if (id > maxId) {
      res.status(400).json({
        status: "error",
        code: "INVALID_WAREHOUSE_ID",
        message: "Warehouse ID exceeds the maximum supported value.",
      });

      return null;
    }
  } catch {
    res.status(400).json({
      status: "error",
      code: "INVALID_WAREHOUSE_ID",
      message: "Warehouse ID must be a positive integer.",
    });

    return null;
  }

  return param;
}

/**
 * Handle errors returned by warehouse service.
 */
function handleWarehouseError(
  error: unknown,
  res: Response
): void {
  if (error instanceof WarehouseServiceError) {
    const statusCode =
      error.code === "WAREHOUSE_NOT_FOUND" ? 404 : 409;

    res.status(statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });

    return;
  }

  console.error("Warehouse controller error:", error);

  res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
}

/**
 * GET /api/v1/warehouses
 */
export const listWarehouses: RequestHandler = async (_req, res) => {
  try {
    const warehouses = await getAllWarehouses();

    res.status(200).json({
      status: "success",
      data: {
        warehouses,
      },
    });
  } catch (error: unknown) {
    handleWarehouseError(error, res);
  }
};

/**
 * GET /api/v1/warehouses/:id
 */
export const getWarehouse: RequestHandler = async (req, res) => {
  try {
    const warehouseId = getWarehouseId(req.params.id, res);

    if (!warehouseId) return;

    const warehouse = await getWarehouseById(warehouseId);

    res.status(200).json({
      status: "success",
      data: {
        warehouse,
      },
    });
  } catch (error: unknown) {
    handleWarehouseError(error, res);
  }
};

/**
 * POST /api/v1/warehouses
 */
export const createWarehouseController: RequestHandler = async (
  req,
  res
) => {
  try {
    const input = req.body as CreateWarehouseInput;

    const warehouse = await createNewWarehouse(input);

    res.status(201).json({
      status: "success",
      message: "Warehouse created successfully.",
      data: {
        warehouse,
      },
    });
  } catch (error: unknown) {
    handleWarehouseError(error, res);
  }
};

/**
 * PATCH /api/v1/warehouses/:id
 */
export const updateWarehouseController: RequestHandler = async (
  req,
  res
) => {
  try {
    const warehouseId = getWarehouseId(req.params.id, res);

    if (!warehouseId) return;

    const input = req.body as UpdateWarehouseInput;

    const warehouse = await updateExistingWarehouse(
      warehouseId,
      input
    );

    res.status(200).json({
      status: "success",
      message: "Warehouse updated successfully.",
      data: {
        warehouse,
      },
    });
  } catch (error: unknown) {
    handleWarehouseError(error, res);
  }
};

/**
 * PATCH /api/v1/warehouses/:id/deactivate
 */
export const deactivateWarehouseController: RequestHandler = async (
  req,
  res
) => {
  try {
    const warehouseId = getWarehouseId(req.params.id, res);

    if (!warehouseId) return;

    const warehouse = await deactivateExistingWarehouse(warehouseId);

    res.status(200).json({
      status: "success",
      message: "Warehouse deactivated successfully.",
      data: {
        warehouse,
      },
    });
  } catch (error: unknown) {
    handleWarehouseError(error, res);
  }
};

/**
 * PATCH /api/v1/warehouses/:id/reactivate
 */
export const reactivateWarehouseController: RequestHandler = async (
  req,
  res
) => {
  try {
    const warehouseId = getWarehouseId(req.params.id, res);

    if (!warehouseId) return;

    const warehouse = await reactivateExistingWarehouse(warehouseId);

    res.status(200).json({
      status: "success",
      message: "Warehouse reactivated successfully.",
      data: {
        warehouse,
      },
    });
  } catch (error: unknown) {
    handleWarehouseError(error, res);
  }
};
