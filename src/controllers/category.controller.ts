
import type { RequestHandler, Response } from "express";
import { positiveBigIntIdSchema } from "../validators/common.validator";

import {
  CategoryServiceError,
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

/**
 * Validate and retrieve category ID from route parameters.
 */
/**
 * Validate and retrieve category ID from route parameters.
 */
function getCategoryId(
  param: unknown,
  res: Response
): string | null {
  const parsed = positiveBigIntIdSchema.safeParse(param);

  if (!parsed.success) {
    res.status(400).json({
      status: "error",
      code: "INVALID_CATEGORY_ID",
      message: "Category ID must be a valid positive BIGINT.",
    });

    return null;
  }

  return parsed.data;
}


/**
 * Handle errors returned by category service.
 */
function handleCategoryError(error: unknown, res: Response): void {
  if (error instanceof CategoryServiceError) {
    const statusCode =
      error.code === "CATEGORY_NOT_FOUND" ? 404 : 409;

    res.status(statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });

    return;
  }

  console.error("Category controller error:", error);

  res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
}

/**
 * GET /api/v1/categories
 */
export const listCategories: RequestHandler = async (_req, res) => {
  try {
    const categories = await getAllCategories();

    res.status(200).json({
      status: "success",
      data: {
        categories,
      },
    });
  } catch (error: unknown) {
    handleCategoryError(error, res);
  }
};

/**
 * GET /api/v1/categories/:id
 */
export const getCategory: RequestHandler = async (req, res) => {
  try {
    const categoryId = getCategoryId(req.params.id, res);

    if (!categoryId) return;

    const category = await getCategoryById(categoryId);

    res.status(200).json({
      status: "success",
      data: {
        category,
      },
    });
  } catch (error: unknown) {
    handleCategoryError(error, res);
  }
};

/**
 * POST /api/v1/categories
 */
export const createCategoryController: RequestHandler = async (
  req,
  res
) => {
  try {
    const input = req.body as CreateCategoryInput;

    const category = await createNewCategory(input);

    res.status(201).json({
      status: "success",
      message: "Category created successfully.",
      data: {
        category,
      },
    });
  } catch (error: unknown) {
    handleCategoryError(error, res);
  }
};

/**
 * PATCH /api/v1/categories/:id
 */
export const updateCategoryController: RequestHandler = async (
  req,
  res
) => {
  try {
    const input = req.body as UpdateCategoryInput;

    const categoryId = getCategoryId(req.params.id, res);

    if (!categoryId) return;

    const category = await updateExistingCategory(
    categoryId,
    input
    );

    res.status(200).json({
      status: "success",
      message: "Category updated successfully.",
      data: {
        category,
      },
    });
  } catch (error: unknown) {
    handleCategoryError(error, res);
  }
};

/**
 * PATCH /api/v1/categories/:id/deactivate
 */
export const deactivateCategoryController: RequestHandler = async (
  req,
  res
) => {
  try {
    const categoryId = getCategoryId(req.params.id, res);

    if (!categoryId) return;

    const category = await deactivateExistingCategory(categoryId);

    res.status(200).json({
      status: "success",
      message: "Category deactivated successfully.",
      data: {
        category,
      },
    });
  } catch (error: unknown) {
    handleCategoryError(error, res);
  }
};
