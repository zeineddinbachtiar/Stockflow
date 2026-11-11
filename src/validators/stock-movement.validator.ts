import { z } from "zod";

const MAX_BIGINT = 9223372036854775807n;

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

const movementTypeSchema = z.enum([
  "RECEIPT",
  "ISSUE",
  "ADJUSTMENT",
  "ORDER_CONFIRM",
  "ORDER_CANCEL",
]);

/**
 * Stock movement list filters and pagination.
 */
export const stockMovementQuerySchema = z
  .object({
    warehouseId: positiveIdSchema.optional(),
    productId: positiveIdSchema.optional(),
    movementType: movementTypeSchema.optional(),

    limit: z.coerce.number().int().min(1).max(100).default(50),

    offset: z.coerce.number().int().min(0).max(1000000).default(0),
  })
  .strict();
