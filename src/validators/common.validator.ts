import { z } from "zod";

// Maximum signed BIGINT value supported by PostgreSQL.
const MAX_POSTGRES_BIGINT = 9223372036854775807n;

/**
 * Validates a positive PostgreSQL BIGINT ID represented as a string.
 */
export const positiveBigIntIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "ID must be a positive integer.")
  .refine((value) => {
    try {
      return BigInt(value) <= MAX_POSTGRES_BIGINT;
    } catch {
      return false;
    }
  }, "ID exceeds the maximum supported BIGINT value.");

/**
 * Validate pagination query parameters.
 *
 * Defaults:
 * - limit: 50
 * - offset: 0
 *
 * Maximum:
 * - limit: 100
 * - offset: 1,000,000
 */
export const paginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(1000000).default(0),
  })
  .strict();
