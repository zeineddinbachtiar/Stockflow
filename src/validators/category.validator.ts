
import { z } from "zod";

const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Category name is required.")
  .max(100, "Category name must not exceed 100 characters.");

const categoryDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Category description must not exceed 2000 characters.")
  .nullable()
  .optional();

/**
 * Validation schema for creating a category.
 */
export const createCategorySchema = z
  .object({
    name: categoryNameSchema,
    description: categoryDescriptionSchema,
  })
  .strict();

/**
 * Validation schema for updating a category.
 */
export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    description: categoryDescriptionSchema,
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined,
    {
      message: "At least one field must be provided for update.",
    }
  );
