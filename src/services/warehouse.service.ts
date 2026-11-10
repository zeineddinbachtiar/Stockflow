
import {
  createWarehouse,
  deactivateWarehouse,
  findAllActiveWarehouses,
  findWarehouseByCode,
  findWarehouseById,
  reactivateWarehouse,
  updateWarehouse,
} from "../repositories/warehouse.repositories";

import type {
  WarehouseRecord,
  PublicWarehouse,
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from "../types/warehouse.types";

export type WarehouseServiceErrorCode =
  | "WAREHOUSE_NOT_FOUND"
  | "WAREHOUSE_CODE_ALREADY_EXISTS";

export class WarehouseServiceError extends Error {
  constructor(
    public readonly code: WarehouseServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "WarehouseServiceError";
  }
}

/**
 * Convert database warehouse record into public response format.
 */
function toPublicWarehouse(
  warehouse: WarehouseRecord
): PublicWarehouse {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address,
    isActive: warehouse.is_active,
    createdAt: warehouse.created_at,
    updatedAt: warehouse.updated_at,
  };
}

/**
 * Check PostgreSQL error code.
 */
function hasPostgresErrorCode(
  error: unknown,
  code: string
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

/**
 * Retrieve all active warehouses.
 */
export async function getAllWarehouses(): Promise<PublicWarehouse[]> {
  const warehouses = await findAllActiveWarehouses();

  return warehouses.map(toPublicWarehouse);
}

/**
 * Retrieve an active warehouse by ID.
 */
export async function getWarehouseById(
  id: string
): Promise<PublicWarehouse> {
  const warehouse = await findWarehouseById(id);

  if (!warehouse || !warehouse.is_active) {
    throw new WarehouseServiceError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found."
    );
  }

  return toPublicWarehouse(warehouse);
}

/**
 * Create a new warehouse.
 */
export async function createNewWarehouse(
  input: CreateWarehouseInput
): Promise<PublicWarehouse> {
  const normalizedCode = input.code.trim().toUpperCase();
  const normalizedName = input.name.trim();
  const normalizedAddress = input.address?.trim() || null;

  // Check whether the warehouse code has already been used.
  const existingWarehouse = await findWarehouseByCode(normalizedCode);

  if (existingWarehouse) {
    throw new WarehouseServiceError(
      "WAREHOUSE_CODE_ALREADY_EXISTS",
      "Warehouse code is already registered."
    );
  }

  try {
    const warehouse = await createWarehouse({
      code: normalizedCode,
      name: normalizedName,
      address: normalizedAddress,
    });

    return toPublicWarehouse(warehouse);
  } catch (error: unknown) {
    // Handle duplicate-code race conditions.
    if (hasPostgresErrorCode(error, "23505")) {
      throw new WarehouseServiceError(
        "WAREHOUSE_CODE_ALREADY_EXISTS",
        "Warehouse code is already registered."
      );
    }

    throw error;
  }
}

/**
 * Update an existing active warehouse.
 */
export async function updateExistingWarehouse(
  id: string,
  input: UpdateWarehouseInput
): Promise<PublicWarehouse> {
  const currentWarehouse = await findWarehouseById(id);

  if (!currentWarehouse || !currentWarehouse.is_active) {
    throw new WarehouseServiceError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found."
    );
  }

  const normalizedInput: UpdateWarehouseInput = {};

  // Normalize code and check uniqueness.
  if (input.code !== undefined) {
    const normalizedCode = input.code.trim().toUpperCase();

    const existingWarehouse = await findWarehouseByCode(
      normalizedCode
    );

    if (existingWarehouse && existingWarehouse.id !== id) {
      throw new WarehouseServiceError(
        "WAREHOUSE_CODE_ALREADY_EXISTS",
        "Warehouse code is already registered."
      );
    }

    normalizedInput.code = normalizedCode;
  }

  // Normalize name.
  if (input.name !== undefined) {
    normalizedInput.name = input.name.trim();
  }

  // Normalize address.
  if (input.address !== undefined) {
    normalizedInput.address =
      input.address?.trim() || null;
  }

  try {
    const updatedWarehouse = await updateWarehouse(
      id,
      normalizedInput
    );

    if (!updatedWarehouse) {
      throw new WarehouseServiceError(
        "WAREHOUSE_NOT_FOUND",
        "Warehouse not found."
      );
    }

    return toPublicWarehouse(updatedWarehouse);
  } catch (error: unknown) {
    // Handle duplicate-code race conditions.
    if (hasPostgresErrorCode(error, "23505")) {
      throw new WarehouseServiceError(
        "WAREHOUSE_CODE_ALREADY_EXISTS",
        "Warehouse code is already registered."
      );
    }

    throw error;
  }
}

/**
 * Deactivate an active warehouse.
 */
export async function deactivateExistingWarehouse(
  id: string
): Promise<PublicWarehouse> {
  const currentWarehouse = await findWarehouseById(id);

  if (!currentWarehouse || !currentWarehouse.is_active) {
    throw new WarehouseServiceError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found."
    );
  }

  const deactivatedWarehouse = await deactivateWarehouse(id);

  if (!deactivatedWarehouse) {
    throw new WarehouseServiceError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found."
    );
  }

  return toPublicWarehouse(deactivatedWarehouse);
}

/**
 * Reactivate a previously deactivated warehouse.
 */
export async function reactivateExistingWarehouse(
  id: string
): Promise<PublicWarehouse> {
  const currentWarehouse = await findWarehouseById(id);

  if (!currentWarehouse) {
    throw new WarehouseServiceError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found."
    );
  }

  // Make reactivation idempotent.
  if (currentWarehouse.is_active) {
    return toPublicWarehouse(currentWarehouse);
  }

  const reactivatedWarehouse = await reactivateWarehouse(id);

  if (!reactivatedWarehouse) {
    throw new WarehouseServiceError(
      "WAREHOUSE_NOT_FOUND",
      "Warehouse not found."
    );
  }

  return toPublicWarehouse(reactivatedWarehouse);
}
