import { z } from "zod";
import { paginationQuerySchema } from "./common.validator";

// PostgreSQL BIGINT maximum value.
const MAX_BIGINT = 9223372036854775807n;

/**
 * Validate a positive PostgreSQL BIGINT ID represented as a string.
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

/**
 * Validate SKU.
 */
const productSkuSchema = z
  .string()
  .trim()
  .min(1, "SKU is required.")
  .max(50, "SKU must not exceed 50 characters.");

/**
 * Validate product name.
 */
const productNameSchema = z
  .string()
  .trim()
  .min(1, "Product name is required.")
  .max(150, "Product name must not exceed 150 characters.");

/**
 * Validate product description.
 */
const productDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Product description must not exceed 2000 characters.")
  .nullable()
  .optional();

/**
 * Validate and normalize product price.
 *
 * NUMERIC(14,2):
 * - Maximum 12 digits before decimal.
 * - Maximum 2 digits after decimal.
 * - Negative values are not allowed.
 */
const unitPriceSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/,
    "Unit price must be a non-negative decimal with up to 12 integer digits and 2 decimal places.",
  )
  .transform((value) => {
    const [integerPart, decimalPart = ""] = value.split(".");

    return `${integerPart}.${decimalPart.padEnd(2, "0")}`;
  });

export const productListQuerySchema = paginationQuerySchema
  .extend({
    search: z
      .string()
      .trim()
      .max(100, "Search must not exceed 100 characters.")
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();

/**
 * Validation schema for creating a product.
 */
export const createProductSchema = z
  .object({
    categoryId: positiveIdSchema,
    sku: productSkuSchema,
    name: productNameSchema,
    description: productDescriptionSchema,
    unitPrice: unitPriceSchema,
  })
  .strict();

/**
 * Validation schema for updating a product.
 */
export const updateProductSchema = z
  .object({
    categoryId: positiveIdSchema.optional(),
    sku: productSkuSchema.optional(),
    name: productNameSchema.optional(),
    description: productDescriptionSchema,
    unitPrice: unitPriceSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.categoryId !== undefined ||
      data.sku !== undefined ||
      data.name !== undefined ||
      data.description !== undefined ||
      data.unitPrice !== undefined,
    {
      message: "At least one field must be provided for update.",
    },
  );
