import type { RequestHandler } from "express";

import { parsePositiveBigIntId } from "../utils/route-params";

import {
  createNewCategory,
  deactivateExistingCategory,
  getAllCategories,
  getCategoryById,
  updateExistingCategory,
} from "../services/category.service";

import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../types/category.types";
import { AppError } from "../errors/app-error";
import { paginationQuerySchema } from "../validators/common.validator";

/**
 * Validate and retrieve category ID from route parameters.
 */
function getCategoryId(param: unknown): string {
  return parsePositiveBigIntId(param, "INVALID_CATEGORY_ID", "Category");
}

/**
 * GET /api/v1/categories
 */

export const listCategories: RequestHandler = async (req, res) => {
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

  const result = await getAllCategories(parsed.data);

  res.status(200).json({
    status: "success",
    data: result,
  });
};

/**
 * GET /api/v1/categories/:id
 */
export const getCategory: RequestHandler = async (req, res) => {
  const categoryId = getCategoryId(req.params.id);

  const category = await getCategoryById(categoryId);

  res.status(200).json({
    status: "success",
    data: {
      category,
    },
  });
};

/**
 * POST /api/v1/categories
 */
export const createCategoryController: RequestHandler = async (req, res) => {
  const input = req.body as CreateCategoryInput;

  const category = await createNewCategory(input);

  res.status(201).json({
    status: "success",
    message: "Category created successfully.",
    data: {
      category,
    },
  });
};

/**
 * PATCH /api/v1/categories/:id
 */
export const updateCategoryController: RequestHandler = async (req, res) => {
  const categoryId = getCategoryId(req.params.id);
  const input = req.body as UpdateCategoryInput;

  const category = await updateExistingCategory(categoryId, input);

  res.status(200).json({
    status: "success",
    message: "Category updated successfully.",
    data: {
      category,
    },
  });
};

/**
 * PATCH /api/v1/categories/:id/deactivate
 */
export const deactivateCategoryController: RequestHandler = async (
  req,
  res,
) => {
  const categoryId = getCategoryId(req.params.id);

  const category = await deactivateExistingCategory(categoryId);

  res.status(200).json({
    status: "success",
    message: "Category deactivated successfully.",
    data: {
      category,
    },
  });
};
