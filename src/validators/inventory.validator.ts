
import { z } from "zod";

const MAX_BIGINT = 9223372036854775807n;
const MAX_INTEGER = 2147483647;

/**
 * Validate a positive PostgreSQL BIGINT ID.
 */
const positiveIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "ID must be a positive integer.")
  .refine((value) => {
    try {
      return BigInt(value) <= MAX_BIGINT;
    } catch {
      return false;
    }
  }, "ID exceeds the maximum supported value.");

const quantitySchema = z
  .number()
  .int()
  .min(1, "Quantity must be greater than zero.")
  .max(MAX_INTEGER, "Quantity exceeds the maximum supported value.");

const optionalReasonSchema = z
  .string()
  .trim()
  .max(2000, "Reason must not exceed 2000 characters.")
  .nullable()
  .optional();

/**
 * Receive stock.
 */
export const receiveStockSchema = z
  .object({
    warehouseId: positiveIdSchema,
    productId: positiveIdSchema,
    quantity: quantitySchema,
    reason: optionalReasonSchema,
  })
  .strict();

/**
 * Issue stock.
 */
export const issueStockSchema = z
  .object({
    warehouseId: positiveIdSchema,
    productId: positiveIdSchema,
    quantity: quantitySchema,
    reason: optionalReasonSchema,
  })
  .strict();

/**
 * Adjust stock.
 * The adjustment delta can be positive or negative, but not zero.
 * A reason is mandatory for auditability.
 */
export const adjustStockSchema = z
  .object({
    warehouseId: positiveIdSchema,
    productId: positiveIdSchema,
    quantityDelta: z
      .number()
      .int()
      .min(-MAX_INTEGER)
      .max(MAX_INTEGER)
      .refine((value) => value !== 0, {
        message: "Adjustment quantity must not be zero.",
      }),
    reason: z
      .string()
      .trim()
      .min(1, "Adjustment reason is required.")
      .max(2000, "Reason must not exceed 2000 characters."),
  })
  .strict();

/**
 * Update reorder level.
 */
export const reorderLevelSchema = z
  .object({
    reorderLevel: z
      .number()
      .int()
      .min(0, "Reorder level cannot be negative.")
      .max(MAX_INTEGER, "Reorder level exceeds the maximum supported value."),
  })
  .strict();

/**
 * Inventory list filters and pagination.
 */
export const inventoryQuerySchema = z
  .object({
    warehouseId: positiveIdSchema.optional(),
    productId: positiveIdSchema.optional(),

    lowStock: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),

    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50),

    offset: z.coerce
      .number()
      .int()
      .min(0)
      .max(1000000)
      .default(0),
  })
  .strict();
