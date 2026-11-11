import { z } from "zod";

/**
 * Validate warehouse code.
 */
const warehouseCodeSchema = z
  .string()
  .trim()
  .min(1, "Warehouse code is required.")
  .max(30, "Warehouse code must not exceed 30 characters.");

/**
 * Validate warehouse name.
 */
const warehouseNameSchema = z
  .string()
  .trim()
  .min(1, "Warehouse name is required.")
  .max(100, "Warehouse name must not exceed 100 characters.");

/**
 * Validate warehouse address.
 */
const warehouseAddressSchema = z
  .string()
  .trim()
  .max(2000, "Warehouse address must not exceed 2000 characters.")
  .nullable()
  .optional();

/**
 * Validation schema for creating a warehouse.
 */
export const createWarehouseSchema = z
  .object({
    code: warehouseCodeSchema,
    name: warehouseNameSchema,
    address: warehouseAddressSchema,
  })
  .strict();

/**
 * Validation schema for updating a warehouse.
 */
export const updateWarehouseSchema = z
  .object({
    code: warehouseCodeSchema.optional(),
    name: warehouseNameSchema.optional(),
    address: warehouseAddressSchema,
  })
  .strict()
  .refine(
    (data) =>
      data.code !== undefined ||
      data.name !== undefined ||
      data.address !== undefined,
    {
      message: "At least one field must be provided for update.",
    },
  );
