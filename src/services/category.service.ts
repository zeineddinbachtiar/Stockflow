import { AppError } from "../errors/app-error";
import { hasPostgresErrorCode } from "../utils/postgres-errors";
import {
  createCategory,
  deactivateCategory,
  findAllActiveCategories,
  findCategoryById,
  findCategoryByName,
  updateCategory,
} from "../repositories/category.repositories";

import type {
  CategoryRecord,
  CreateCategoryInput,
  PublicCategory,
  UpdateCategoryInput,
} from "../types/category.types";

/**
 * Convert database category record into public response format.
 */
function toPublicCategory(category: CategoryRecord): PublicCategory {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    isActive: category.is_active,
    createdAt: category.created_at,
    updatedAt: category.updated_at,
  };
}

/**
 * Retrieve all active categories.
 */
export async function getAllCategories(): Promise<PublicCategory[]> {
  const categories = await findAllActiveCategories();

  return categories.map(toPublicCategory);
}

/**
 * Retrieve an active category by ID.
 */
export async function getCategoryById(id: string): Promise<PublicCategory> {
  const category = await findCategoryById(id);

  if (!category || !category.is_active) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  return toPublicCategory(category);
}

/**
 * Create a new category.
 */
export async function createNewCategory(
  input: CreateCategoryInput,
): Promise<PublicCategory> {
  const normalizedName = input.name.trim();
  const normalizedDescription = input.description?.trim() || null;

  // Check whether the category name has already been used.
  const existingCategory = await findCategoryByName(normalizedName);

  if (existingCategory) {
    throw new AppError(
      409,
      "CATEGORY_ALREADY_EXISTS",
      "Category name is already registered.",
    );
  }

  try {
    const category = await createCategory({
      name: normalizedName,
      description: normalizedDescription,
    });

    return toPublicCategory(category);
  } catch (error: unknown) {
    // Handle a duplicate-name race condition.
    if (hasPostgresErrorCode(error, "23505")) {
      throw new AppError(
        409,
        "CATEGORY_ALREADY_EXISTS",
        "Category name is already registered.",
      );
    }

    throw error;
  }
}

/**
 * Update an existing active category.
 */
export async function updateExistingCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<PublicCategory> {
  // Ensure the category exists and is active.
  const currentCategory = await findCategoryById(id);

  if (!currentCategory || !currentCategory.is_active) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  const normalizedInput: UpdateCategoryInput = {};

  // Normalize the name if it is provided.
  if (input.name !== undefined) {
    const normalizedName = input.name.trim();

    const existingCategory = await findCategoryByName(normalizedName);

    if (existingCategory && existingCategory.id !== id) {
      throw new AppError(
        409,
        "CATEGORY_ALREADY_EXISTS",
        "Category name is already registered.",
      );
    }

    normalizedInput.name = normalizedName;
  }

  // Normalize the description if it is provided.
  if (input.description !== undefined) {
    normalizedInput.description = input.description?.trim() || null;
  }

  try {
    const updatedCategory = await updateCategory(id, normalizedInput);

    if (!updatedCategory) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    }

    return toPublicCategory(updatedCategory);
  } catch (error: unknown) {
    // Handle duplicate-name race conditions.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AppError(
        409,
        "CATEGORY_ALREADY_EXISTS",
        "Category name is already registered.",
      );
    }

    throw error;
  }
}

/**
 * Deactivate an active category without deleting it.
 */
export async function deactivateExistingCategory(
  id: string,
): Promise<PublicCategory> {
  const currentCategory = await findCategoryById(id);

  if (!currentCategory || !currentCategory.is_active) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  const deactivatedCategory = await deactivateCategory(id);

  if (!deactivatedCategory) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  }

  return toPublicCategory(deactivatedCategory);
}
